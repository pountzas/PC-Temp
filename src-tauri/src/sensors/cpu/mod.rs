mod failures;
mod lhm_client;
mod load;

use crate::ipc::types::{CpuCoreReading, CpuSnapshot, CpuThreadReading};
use crate::sensors::source::{CpuReading, CpuSource};
use failures::FailureTracker;
use lhm_client::{LhmClient, LhmCpuData, LhmReader};
#[cfg(test)]
use lhm_client::LhmCoreData;
#[cfg(test)]
use lhm_client::MockLhmClient;
use load::{CpuLoadReading, SysInfoLoadCollector};

const BASE_CLOCK_MHZ: u32 = 3500;

/// Live CPU sensor source: LHM sidecar for temps/power/clocks, `sysinfo` for load.
pub struct RealCpuSource {
    lhm: Option<Box<dyn LhmReader>>,
    lhm_health: FailureTracker<()>,
    load_collector: SysInfoLoadCollector,
    cpu_name: Option<String>,
    package_temp_c: FailureTracker<f64>,
    package_power_w: FailureTracker<f64>,
    clock_mhz: FailureTracker<f64>,
    core_temp: [FailureTracker<f64>; 4],
    core_clock: [FailureTracker<f64>; 4],
    total_load: FailureTracker<f64>,
    thread_load: [FailureTracker<f64>; 8],
    core_load: [FailureTracker<f64>; 4],
    load_override: Option<CpuLoadReading>,
}

impl RealCpuSource {
    pub fn new() -> Self {
        let lhm = LhmClient::try_spawn().map(|c| Box::new(c) as Box<dyn LhmReader>);
        Self::with_lhm(lhm)
    }

    fn with_lhm(lhm: Option<Box<dyn LhmReader>>) -> Self {
        Self {
            lhm,
            lhm_health: FailureTracker::new(),
            load_collector: SysInfoLoadCollector::new(),
            cpu_name: None,
            package_temp_c: FailureTracker::new(),
            package_power_w: FailureTracker::new(),
            clock_mhz: FailureTracker::new(),
            core_temp: std::array::from_fn(|_| FailureTracker::new()),
            core_clock: std::array::from_fn(|_| FailureTracker::new()),
            total_load: FailureTracker::new(),
            thread_load: std::array::from_fn(|_| FailureTracker::new()),
            core_load: std::array::from_fn(|_| FailureTracker::new()),
            load_override: None,
        }
    }

    #[cfg(test)]
    fn with_mock_lhm_and_load(load: CpuLoadReading) -> Self {
        let mut source = Self::with_lhm(Some(Box::new(MockLhmClient::from_fixture())));
        source.load_override = Some(load);
        source
    }

    #[cfg(test)]
    fn without_lhm_with_load(load: CpuLoadReading) -> Self {
        let mut source = Self::with_lhm(None);
        source.load_override = Some(load);
        source
    }

    fn sample_load(&mut self) -> CpuLoadReading {
        if let Some(fixed) = self.load_override {
            return fixed;
        }
        self.load_collector.sample()
    }

    fn ingest_lhm(&mut self, cpu: LhmCpuData) {
        let max_clock = cpu
            .cores
            .iter()
            .filter_map(|c| c.clock_mhz)
            .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        self.cpu_name = Some(cpu.name);
        self.package_temp_c.apply_reading(cpu.package_temp_c);
        self.package_power_w.apply_reading(cpu.package_power_w);
        self.clock_mhz.apply_reading(max_clock);

        let mut temps = [None; 4];
        let mut clocks = [None; 4];
        for core in cpu.cores {
            let idx = core.index as usize;
            if idx < 4 {
                temps[idx] = core.temp_c;
                clocks[idx] = core.clock_mhz;
            }
        }
        for i in 0..4 {
            self.core_temp[i].apply_reading(temps[i]);
            self.core_clock[i].apply_reading(clocks[i]);
        }
    }

    fn ingest_lhm_failure(&mut self) {
        self.package_temp_c.apply_reading(None);
        self.package_power_w.apply_reading(None);
        self.clock_mhz.apply_reading(None);
        for i in 0..4 {
            self.core_temp[i].apply_reading(None);
            self.core_clock[i].apply_reading(None);
        }
    }

    fn poll_lhm(&mut self) {
        let Some(lhm) = self.lhm.as_mut() else {
            return;
        };
        match lhm.read() {
            Ok(cpu) => {
                self.lhm_health.apply_reading(Some(()));
                self.ingest_lhm(cpu);
            }
            Err(err) => {
                log::debug!("lhm read failed: {err}");
                self.ingest_lhm_failure();
                self.lhm_health.apply_reading(None);
                if self.lhm_health.is_latched() {
                    self.lhm = None;
                }
            }
        }
    }
}

impl Default for RealCpuSource {
    fn default() -> Self {
        Self::new()
    }
}

impl CpuSource for RealCpuSource {
    fn read(&mut self) -> CpuReading {
        self.poll_lhm();

        let load = self.sample_load();
        let _ = self.total_load.apply_reading(Some(load.load_pct));

        let mut threads = Vec::with_capacity(8);
        for (i, raw) in load.thread_loads.iter().enumerate() {
            let _ = self.thread_load[i].apply_reading(*raw);
            threads.push(CpuThreadReading {
                index: i as u32,
                load_pct: self.thread_load[i].snapshot_value(),
            });
        }

        let mut cores = Vec::with_capacity(4);
        for i in 0..4 {
            let _ = self.core_load[i].apply_reading(load.core_loads[i]);
            cores.push(CpuCoreReading {
                index: i as u8,
                temp_c: self.core_temp[i].snapshot_value(),
                load_pct: self.core_load[i].snapshot_value(),
                clock_mhz: self.core_clock[i].snapshot_value(),
            });
        }

        let name = self
            .cpu_name
            .clone()
            .or_else(|| self.load_collector.brand())
            .unwrap_or_else(|| "CPU".to_string());

        let snapshot = CpuSnapshot {
            name,
            load_pct: self.total_load.snapshot_value(),
            package_temp_c: self.package_temp_c.snapshot_value(),
            package_power_w: self.package_power_w.snapshot_value(),
            clock_mhz: self.clock_mhz.snapshot_value(),
            base_clock_mhz: BASE_CLOCK_MHZ,
            cores,
            threads: Some(threads),
        };

        CpuReading { snapshot }
    }
}

pub fn create() -> Box<dyn CpuSource> {
    log::info!("sensors::cpu::create (real)");
    Box::new(RealCpuSource::new())
}

#[cfg(test)]
mod real_cpu_tests {
    use super::*;
    use load::cores_from_thread_loads;

    fn compact_load() -> CpuLoadReading {
        let thread_loads = [
            Some(30.0),
            Some(26.0),
            Some(32.0),
            Some(28.0),
            Some(35.0),
            Some(38.0),
            Some(29.0),
            Some(33.0),
        ];
        CpuLoadReading {
            load_pct: 34.0,
            thread_loads,
            core_loads: cores_from_thread_loads(&thread_loads),
        }
    }

    #[test]
    fn mock_sidecar_fixture_merges_with_load() {
        let mut cpu = RealCpuSource::with_mock_lhm_and_load(compact_load());
        let reading = cpu.read();
        let snap = &reading.snapshot;
        assert_eq!(snap.name, "Intel Core i7-3770K");
        assert_eq!(snap.package_temp_c, Some(52.0));
        assert_eq!(snap.package_power_w, Some(41.0));
        assert_eq!(snap.clock_mhz, Some(3900.0));
        assert_eq!(snap.load_pct, Some(34.0));
        assert_eq!(snap.cores[0].load_pct, Some(28.0));
    }

    #[test]
    fn without_sidecar_loads_still_populate_temps_none() {
        let mut cpu = RealCpuSource::without_lhm_with_load(compact_load());
        let reading = cpu.read();
        let snap = &reading.snapshot;
        assert!(snap.package_temp_c.is_none());
        assert_eq!(snap.load_pct, Some(34.0));
        assert_eq!(snap.cores[0].load_pct, Some(28.0));
    }

    #[test]
    fn missing_core_two_leaves_none_for_that_slot() {
        let partial = LhmCpuData {
            name: "Intel Core i7-3770K".into(),
            package_temp_c: Some(52.0),
            package_power_w: Some(41.0),
            cores: vec![
                LhmCoreData {
                    index: 0,
                    temp_c: Some(50.0),
                    clock_mhz: Some(3900.0),
                },
                LhmCoreData {
                    index: 1,
                    temp_c: Some(51.0),
                    clock_mhz: Some(3900.0),
                },
                LhmCoreData {
                    index: 3,
                    temp_c: Some(52.0),
                    clock_mhz: Some(3900.0),
                },
            ],
        };
        let mut cpu = RealCpuSource::with_lhm(Some(Box::new(MockLhmClient::with_data(partial))));
        cpu.load_override = Some(compact_load());
        let snap = cpu.read().snapshot;
        assert_eq!(snap.cores[2].temp_c, None);
        assert_eq!(snap.cores[2].clock_mhz, None);
        assert_eq!(snap.cores[0].temp_c, Some(50.0));
    }

    #[test]
    fn lhm_reader_invoked_only_three_times_then_dropped() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::sync::Arc;
        let counter = Arc::new(AtomicUsize::new(0));
        struct Wrapper(Arc<AtomicUsize>);
        impl LhmReader for Wrapper {
            fn read(&mut self) -> Result<LhmCpuData, lhm_client::LhmClientError> {
                self.0.fetch_add(1, Ordering::SeqCst);
                Err(lhm_client::LhmClientError::Sidecar("x".into()))
            }
        }
        let mut cpu = RealCpuSource::with_lhm(Some(Box::new(Wrapper(Arc::clone(&counter)))));
        cpu.load_override = Some(compact_load());
        for _ in 0..5 {
            let _ = cpu.read();
        }
        assert_eq!(counter.load(Ordering::SeqCst), 3);
    }

    struct OnceOkThenFail {
        calls: std::cell::Cell<usize>,
        good: LhmCpuData,
    }

    impl LhmReader for OnceOkThenFail {
        fn read(&mut self) -> Result<LhmCpuData, lhm_client::LhmClientError> {
            self.calls.set(self.calls.get() + 1);
            if self.calls.get() == 1 {
                Ok(self.good.clone())
            } else {
                Err(lhm_client::LhmClientError::Sidecar("x".into()))
            }
        }
    }

    #[test]
    fn cpu_name_survives_three_lhm_failures() {
        let good = MockLhmClient::from_fixture()
            .read()
            .expect("fixture");
        let mut cpu = RealCpuSource::with_lhm(Some(Box::new(OnceOkThenFail {
            calls: std::cell::Cell::new(0),
            good,
        })));
        cpu.load_override = Some(compact_load());
        assert_eq!(cpu.read().snapshot.name, "Intel Core i7-3770K");
        for _ in 0..4 {
            let _ = cpu.read();
        }
        assert_eq!(cpu.read().snapshot.name, "Intel Core i7-3770K");
    }

    struct FailingLhm;

    impl LhmReader for FailingLhm {
        fn read(&mut self) -> Result<LhmCpuData, lhm_client::LhmClientError> {
            Err(lhm_client::LhmClientError::Sidecar("unavailable".into()))
        }
    }

    #[test]
    fn three_lhm_failures_latch_package_temp_without_emitting_zero() {
        let mut cpu = RealCpuSource::with_lhm(Some(Box::new(FailingLhm)));
        cpu.load_override = Some(compact_load());
        for _ in 0..3 {
            let _ = cpu.read();
        }
        let fourth = cpu.read();
        assert!(fourth.snapshot.package_temp_c.is_none());
        assert_ne!(fourth.snapshot.package_temp_c, Some(0.0));
        assert_eq!(fourth.snapshot.load_pct, Some(34.0));
    }
}