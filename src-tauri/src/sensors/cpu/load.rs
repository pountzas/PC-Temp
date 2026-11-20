//! Per-thread and per-core CPU load via `sysinfo`, with SMT pairing for core aggregates.

use sysinfo::{CpuRefreshKind, RefreshKind, System};

/// Reading from one sysinfo sample: total load, eight logical threads, four core means.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CpuLoadReading {
    pub load_pct: f64,
    pub thread_loads: [f64; 8],
    pub core_loads: [f64; 4],
}

/// Core *n* is the arithmetic mean of logical threads `2n` and `2n + 1` (SMT pairing).
pub fn cores_from_thread_loads(thread_loads: &[f64; 8]) -> [f64; 4] {
    let mut cores = [0.0; 4];
    for (core_idx, core) in cores.iter_mut().enumerate() {
        let t0 = thread_loads[core_idx * 2];
        let t1 = thread_loads[core_idx * 2 + 1];
        *core = (t0 + t1) / 2.0;
    }
    cores
}

/// Samples CPU usage through `sysinfo::System` (diff-based; requires sleep between refreshes).
pub struct SysInfoLoadCollector {
    system: System,
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
        Self { system }
    }

    pub fn sample(&mut self) -> CpuLoadReading {
        std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
        self.system.refresh_cpu_usage();

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

fn thread_loads_from_cpus(cpus: &[sysinfo::Cpu]) -> [f64; 8] {
    let mut loads = [0.0_f64; 8];
    for (i, cpu) in cpus.iter().take(8).enumerate() {
        loads[i] = f64::from(cpu.usage());
    }
    loads
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_f64_slice_eq(actual: &[f64], expected: &[f64]) {
        assert_eq!(actual.len(), expected.len());
        for (a, e) in actual.iter().zip(expected.iter()) {
            assert!((a - e).abs() < 1e-9, "expected {e}, got {a}");
        }
    }

    #[test]
    fn cores_from_thread_loads_matches_compact_fixture_pairing() {
        // Thread 0/1 loads from compact fixture → core 0 mean 28.
        let threads = [30.0, 26.0, 12.0, 8.0, 40.0, 60.0, 0.0, 100.0];
        let cores = cores_from_thread_loads(&threads);
        assert_f64_slice_eq(&cores, &[28.0, 10.0, 50.0, 50.0]);
    }

    #[test]
    fn cores_from_thread_loads_all_zeros() {
        let threads = [0.0; 8];
        let cores = cores_from_thread_loads(&threads);
        assert_f64_slice_eq(&cores, &[0.0; 4]);
    }

    #[test]
    fn cores_from_thread_loads_saturated_pairs() {
        let threads = [100.0; 8];
        let cores = cores_from_thread_loads(&threads);
        assert_f64_slice_eq(&cores, &[100.0; 4]);
    }

    #[test]
    fn cores_from_thread_loads_asymmetric_within_pair() {
        let threads = [0.0, 100.0, 100.0, 0.0, 25.0, 75.0, 50.0, 50.0];
        let cores = cores_from_thread_loads(&threads);
        assert_f64_slice_eq(&cores, &[50.0, 50.0, 50.0, 50.0]);
    }

    #[test]
    fn cores_from_thread_loads_each_core_uses_adjacent_thread_indices() {
        let threads = [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0];
        let cores = cores_from_thread_loads(&threads);
        assert_f64_slice_eq(&cores, &[15.0, 35.0, 55.0, 75.0]);
    }
}