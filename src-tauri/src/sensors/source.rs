use crate::ipc::types::{CpuSnapshot, GpuSnapshot, SensorTick};
use serde::Deserialize;
use std::path::PathBuf;

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

fn compact_fixture_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("repo root")
        .join("src/ipc/fixtures/compact.json")
}

fn load_compact_tick() -> SensorTick {
    let path = compact_fixture_path();
    let raw = std::fs::read_to_string(path).expect("compact fixture");
    serde_json::from_str(&raw).expect("parse compact SensorTick")
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

#[cfg(test)]
pub struct MockGpu {
    tick: SensorTick,
}

#[cfg(test)]
impl MockGpu {
    pub fn new() -> Self {
        Self {
            tick: load_compact_tick(),
        }
    }
}

#[cfg(test)]
impl Default for MockGpu {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
impl GpuSource for MockGpu {
    fn read(&mut self) -> GpuReading {
        GpuReading {
            snapshot: self.tick.gpu.clone(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LhmCpuResponse {
    pub name: String,
    pub package_temp_c: Option<f64>,
    pub package_power_w: Option<f64>,
    pub cores: Vec<LhmCoreResponse>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LhmCoreResponse {
    pub index: u8,
    pub temp_c: Option<f64>,
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
}