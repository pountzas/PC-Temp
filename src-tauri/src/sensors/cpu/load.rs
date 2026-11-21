//! Per-thread and per-core CPU load via `sysinfo`, with SMT pairing for core aggregates.

use std::time::Instant;
use sysinfo::{CpuRefreshKind, RefreshKind, System};

/// Reading from one sysinfo sample: total load, eight logical threads, four core means.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CpuLoadReading {
    pub load_pct: f64,
    pub thread_loads: [Option<f64>; 8],
    pub core_loads: [Option<f64>; 4],
}

/// Core *n* is the mean of threads `2n` and `2n + 1` when both are present.
pub fn cores_from_thread_loads(thread_loads: &[Option<f64>; 8]) -> [Option<f64>; 4] {
    let mut cores = [None; 4];
    for core_idx in 0..4 {
        let t0 = thread_loads[core_idx * 2];
        let t1 = thread_loads[core_idx * 2 + 1];
        cores[core_idx] = match (t0, t1) {
            (Some(a), Some(b)) => Some((a + b) / 2.0),
            _ => None,
        };
    }
    cores
}

/// Samples CPU usage through `sysinfo::System` (diff-based; requires spacing between refreshes).
pub struct SysInfoLoadCollector {
    system: System,
    last_refresh: Option<Instant>,
}

impl Default for SysInfoLoadCollector {
    fn default() -> Self {
        Self::new()
    }
}

impl SysInfoLoadCollector {
    pub fn new() -> Self {
        let mut system = System::new_with_specifics(
            RefreshKind::nothing().with_cpu(CpuRefreshKind::nothing().with_usage()),
        )
        .expect("sysinfo System");
        system.refresh_cpu_usage();
        Self {
            system,
            last_refresh: Some(Instant::now()),
        }
    }

    pub fn brand(&self) -> Option<String> {
        self.system
            .cpus()
            .first()
            .map(|cpu| cpu.brand().to_string())
    }

    pub fn sample(&mut self) -> CpuLoadReading {
        let min_interval = sysinfo::MINIMUM_CPU_UPDATE_INTERVAL;
        if let Some(last) = self.last_refresh {
            let elapsed = last.elapsed();
            if elapsed < min_interval {
                std::thread::sleep(min_interval - elapsed);
            }
        }
        self.system.refresh_cpu_usage();
        self.last_refresh = Some(Instant::now());

        let load_pct = f64::from(self.system.global_cpu_usage());
        let thread_loads = thread_loads_from_cpus(self.system.cpus());
        let core_loads = cores_from_thread_loads(&thread_loads);

        CpuLoadReading {
            load_pct,
            thread_loads,
            core_loads,
        }
    }
}

static WARN_NON_EIGHT_CPUS: std::sync::Once = std::sync::Once::new();

pub fn thread_loads_from_cpus(cpus: &[sysinfo::Cpu]) -> [Option<f64>; 8] {
    if cpus.len() != 8 {
        WARN_NON_EIGHT_CPUS.call_once(|| {
            log::warn!(
                "expected 8 logical CPUs for load mapping, found {}",
                cpus.len()
            );
        });
    }
    let mut loads = [None; 8];
    for (i, cpu) in cpus.iter().take(8).enumerate() {
        loads[i] = Some(f64::from(cpu.usage()));
    }
    loads
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_option_f64_slice_eq(actual: &[Option<f64>], expected: &[Option<f64>]) {
        assert_eq!(actual.len(), expected.len());
        for (a, e) in actual.iter().zip(expected.iter()) {
            match (a, e) {
                (Some(av), Some(ev)) => assert!((av - ev).abs() < 1e-9, "expected {ev}, got {av}"),
                (None, None) => {}
                other => panic!("mismatch: {other:?}"),
            }
        }
    }

    #[test]
    fn cores_from_thread_loads_matches_compact_fixture_pairing() {
        let threads = [
            Some(30.0),
            Some(26.0),
            Some(12.0),
            Some(8.0),
            Some(40.0),
            Some(60.0),
            Some(0.0),
            Some(100.0),
        ];
        let cores = cores_from_thread_loads(&threads);
        assert_option_f64_slice_eq(&cores, &[Some(28.0), Some(10.0), Some(50.0), Some(50.0)]);
    }

    #[test]
    fn cores_from_thread_loads_all_zeros() {
        let threads = [Some(0.0); 8];
        let cores = cores_from_thread_loads(&threads);
        assert_option_f64_slice_eq(&cores, &[Some(0.0); 4]);
    }

    #[test]
    fn cores_from_thread_loads_saturated_pairs() {
        let threads = [Some(100.0); 8];
        let cores = cores_from_thread_loads(&threads);
        assert_option_f64_slice_eq(&cores, &[Some(100.0); 4]);
    }

    #[test]
    fn cores_from_thread_loads_asymmetric_within_pair() {
        let threads = [
            Some(0.0),
            Some(100.0),
            Some(100.0),
            Some(0.0),
            Some(25.0),
            Some(75.0),
            Some(50.0),
            Some(50.0),
        ];
        let cores = cores_from_thread_loads(&threads);
        assert_option_f64_slice_eq(&cores, &[Some(50.0); 4]);
    }

    #[test]
    fn cores_from_thread_loads_each_core_uses_adjacent_thread_indices() {
        let threads = [
            Some(10.0),
            Some(20.0),
            Some(30.0),
            Some(40.0),
            Some(50.0),
            Some(60.0),
            Some(70.0),
            Some(80.0),
        ];
        let cores = cores_from_thread_loads(&threads);
        assert_option_f64_slice_eq(&cores, &[Some(15.0), Some(35.0), Some(55.0), Some(75.0)]);
    }

    #[test]
    fn cores_from_thread_loads_none_when_either_thread_missing() {
        let threads = [
            Some(10.0),
            None,
            Some(30.0),
            Some(40.0),
            None,
            None,
            Some(70.0),
            Some(80.0),
        ];
        let cores = cores_from_thread_loads(&threads);
        assert_eq!(cores[0], None);
        assert_eq!(cores[1], Some(35.0));
        assert_eq!(cores[2], None);
        assert_eq!(cores[3], Some(75.0));
    }

    #[test]
    fn thread_loads_from_cpus_leaves_tail_none_with_six_cpus() {
        let loads = {
            let mut loads = [None; 8];
            for (i, slot) in loads.iter_mut().enumerate().take(6) {
                *slot = Some(10.0 + i as f64);
            }
            loads
        };
        assert!(loads[5].is_some());
        assert!(loads[6].is_none());
        assert_eq!(cores_from_thread_loads(&loads)[3], None);

        let empty = thread_loads_from_cpus(&[]);
        assert!(empty.iter().all(|l| l.is_none()));
    }
}
