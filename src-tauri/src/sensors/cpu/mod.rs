mod failures;
mod lhm_client;
mod load;

use crate::ipc::types::{CpuCoreReading, CpuSnapshot, CpuThreadReading};
use crate::sensors::source::{CpuReading, CpuSource};
use failures::FailureTracker;
use lhm_client::{LhmClient, LhmCpuData, LhmReader};
#[cfg(test)]
use lhm_client::MockLhmClient;
use load::{CpuLoadReading, SysInfoLoadCollector};

const BASE_CLOCK_MHZ: u32 = 3500;

/// Live CPU sensor source: LHM sidecar for temps/power/clocks, `sysinfo` for load.
pub struct RealCpuSource {
    lhm: Option<Box<dyn LhmReader>>,
    load_collector: SysInfoLoadCollector,
    name: FailureTracker<String>,
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
            load_collector: SysInfoLoadCollector::new(),
            name: FailureTracker::new(),
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
        let mut source = Self::with_lhm(Some(Box::new(MockLhmClient::new())));
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

        self.name.apply_reading(Some(cpu.name));
        self.package_temp_c.apply_reading(cpu.package_temp_c);
        self.package_power_w.apply_reading(cpu.package_power_w);
        self.clock_mhz.apply_reading(max_clock);

        for core in cpu.cores {
            let idx = core.index as usize;
            if idx < 4 {
                self.core_temp[idx].apply_reading(core.temp_c);
                self.core_clock[idx].apply_reading(core.clock_mhz);
            }
        }
    }

    fn ingest_lhm_failure(&mut self) {
        self.name.apply_reading(None);
        self.package_temp_c.apply_reading(None);
        self.package_power_w.apply_reading(None);
        self.clock_mhz.apply_reading(None);
        for tracker in &mut self.core_temp {
            tracker.apply_reading(None);
        }
        for tracker in &mut self.core_clock {
            tracker.apply_reading(None);
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
        match self.lhm.as_mut().map(|lhm| lhm.read()) {
            Some(Ok(cpu)) => self.ingest_lhm(cpu),
            Some(Err(err)) => {
                log::debug!("lhm read failed: {err}");
                self.ingest_lhm_failure();
            }
            None => self.ingest_lhm_failure(),
        }

        let load = self.sample_load();
        let _ = self.total_load.apply_reading(Some(load.load_pct));

        let mut threads = Vec::with_capacity(8);
        for (i, raw) in load.thread_loads.iter().enumerate() {
            let _ = self.thread_load[i].apply_reading(Some(*raw));
            threads.push(CpuThreadReading {
                index: i as u32,
                load_pct: self.thread_load[i].snapshot_value(),
            });
        }

        let mut cores = Vec::with_capacity(4);
        for i in 0..4 {
            let _ = self.core_load[i].apply_reading(Some(load.core_loads[i]));
            cores.push(CpuCoreReading {
                index: i as u8,
                temp_c: self.core_temp[i].snapshot_value(),
                load_pct: self.core_load[i].snapshot_value(),
                clock_mhz: self.core_clock[i].snapshot_value(),
            });
        }

        let name = self
            .name
            .snapshot_value()
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
        let thread_loads = [30.0, 26.0, 32.0, 28.0, 35.0, 38.0, 29.0, 33.0];
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
        assert_eq!(snap.base_clock_mhz, BASE_CLOCK_MHZ);
        assert_eq!(snap.cores[0].temp_c, Some(50.0));
        assert_eq!(snap.cores[0].clock_mhz, Some(3900.0));
        assert_eq!(snap.cores[0].load_pct, Some(28.0));
        let threads = snap.threads.as_ref().expect("threads");
        assert_eq!(threads.len(), 8);
        assert_eq!(threads[0].load_pct, Some(30.0));
    }

    #[test]
    fn without_sidecar_loads_still_populate_temps_none() {
        let mut cpu = RealCpuSource::without_lhm_with_load(compact_load());
        let reading = cpu.read();
        let snap = &reading.snapshot;
        assert!(snap.package_temp_c.is_none());
        assert!(snap.package_power_w.is_none());
        assert!(snap.clock_mhz.is_none());
        assert_eq!(snap.load_pct, Some(34.0));
        assert!(snap.cores.iter().all(|c| c.temp_c.is_none()));
        assert!(snap.cores.iter().all(|c| c.clock_mhz.is_none()));
        assert_eq!(snap.cores[0].load_pct, Some(28.0));
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
        assert!(cpu.read().snapshot.package_temp_c.is_none());
        assert!(cpu.read().snapshot.package_temp_c.is_none());
        assert!(cpu.read().snapshot.package_temp_c.is_none());
        let fourth = cpu.read();
        assert!(fourth.snapshot.package_temp_c.is_none());
        assert_ne!(fourth.snapshot.package_temp_c, Some(0.0));
        assert_eq!(fourth.snapshot.load_pct, Some(34.0));
    }
}