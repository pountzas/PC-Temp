use crate::ipc::types::{CpuSnapshot, GpuSnapshot, SensorTick};
use serde::Deserialize;

const COMPACT_FIXTURE: &str = include_str!("../../../src/ipc/fixtures/compact.json");

#[derive(Debug, Clone)]
pub struct CpuReading {
    pub snapshot: CpuSnapshot,
}

#[derive(Debug, Clone)]
pub struct GpuReading {
    pub snapshot: GpuSnapshot,
}

pub trait CpuSource: Send {
    fn read(&mut self) -> CpuReading;
}

pub trait GpuSource: Send {
    fn read(&mut self) -> GpuReading;
}

fn load_compact_tick() -> SensorTick {
    serde_json::from_str(COMPACT_FIXTURE).expect("parse compact SensorTick")
}

pub struct MockCpu {
    tick: SensorTick,
}

impl MockCpu {
    pub fn new() -> Self {
        Self {
            tick: load_compact_tick(),
        }
    }
}

impl Default for MockCpu {
    fn default() -> Self {
        Self::new()
    }
}

impl CpuSource for MockCpu {
    fn read(&mut self) -> CpuReading {
        CpuReading {
            snapshot: self.tick.cpu.clone(),
        }
    }
}

pub struct MockGpu {
    tick: SensorTick,
}

impl MockGpu {
    pub fn new() -> Self {
        Self {
            tick: load_compact_tick(),
        }
    }
}

impl Default for MockGpu {
    fn default() -> Self {
        Self::new()
    }
}

impl GpuSource for MockGpu {
    fn read(&mut self) -> GpuReading {
        GpuReading {
            snapshot: self.tick.gpu.clone(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LhmCpuResponse {
    pub name: String,
    pub package_temp_c: Option<f64>,
    pub package_power_w: Option<f64>,
    pub cores: Vec<LhmCoreResponse>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LhmCoreResponse {
    pub index: u8,
    pub temp_c: Option<f64>,
    #[serde(rename = "clockMHz")]
    pub clock_mhz: Option<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_cpu_returns_compact_sample() {
        let mut cpu = MockCpu::new();
        let reading = cpu.read();
        assert_eq!(reading.snapshot.load_pct, Some(34.0));
        assert_eq!(reading.snapshot.package_temp_c, Some(52.0));
    }

    #[test]
    fn mock_gpu_has_no_power_field_in_snapshot() {
        let mut gpu = MockGpu::new();
        let reading = gpu.read();
        assert_eq!(reading.snapshot.load_pct, Some(58.0));
        assert_eq!(reading.snapshot.core_temp_c, Some(64.0));
    }

    #[test]
    fn mock_cpu_returns_clocks_from_compact_fixture() {
        let mut cpu = MockCpu::new();
        let reading = cpu.read();
        assert_eq!(reading.snapshot.clock_mhz, Some(3900.0));
        assert!(reading.snapshot.cores.iter().all(|c| c.clock_mhz.is_some()));
    }

    #[test]
    fn mock_gpu_returns_clock_and_vram_from_compact_fixture() {
        let mut gpu = MockGpu::new();
        let reading = gpu.read();
        assert_eq!(reading.snapshot.core_clock_mhz, Some(1150.0));
        assert_eq!(reading.snapshot.vram_used_mib, Some(512));
        assert_eq!(reading.snapshot.vram_total_mib, Some(6144));
    }
}