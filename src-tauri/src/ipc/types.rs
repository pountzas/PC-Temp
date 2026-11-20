use serde::{Deserialize, Serialize};

pub type Pct = f64;
pub type Celsius = f64;
pub type Watts = f64;
pub type MHz = f64;

/// Poll interval in milliseconds (`1000`, `2000`, or `5000`).
pub type IntervalMs = u32;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuCoreReading {
    pub index: u8,
    pub temp_c: Option<Celsius>,
    pub load_pct: Option<Pct>,
    pub clock_mhz: Option<MHz>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuThreadReading {
    pub index: u32,
    pub load_pct: Option<Pct>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuSnapshot {
    pub name: String,
    pub load_pct: Option<Pct>,
    pub package_temp_c: Option<Celsius>,
    pub package_power_w: Option<Watts>,
    pub clock_mhz: Option<MHz>,
    #[serde(rename = "baseClockMHz")]
    pub base_clock_mhz: u32,
    pub cores: Vec<CpuCoreReading>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub threads: Option<Vec<CpuThreadReading>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuSnapshot {
    pub name: String,
    pub load_pct: Option<Pct>,
    pub core_temp_c: Option<Celsius>,
    pub core_clock_mhz: Option<MHz>,
    pub fan_pct: Option<Pct>,
    pub vram_used_mib: Option<u32>,
    pub vram_total_mib: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SensorAlert {
    pub component: AlertComponent,
    pub level: AlertLevel,
    pub temp_c: Celsius,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertComponent {
    Cpu,
    Gpu,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertLevel {
    Warm,
    Hot,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SensorHistory {
    pub cpu_load: Vec<Option<Pct>>,
    pub gpu_load: Vec<Option<Pct>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SensorTick {
    pub ts: u64,
    pub interval_ms: IntervalMs,
    pub cpu: CpuSnapshot,
    pub gpu: GpuSnapshot,
    pub history: SensorHistory,
    pub alerts: Vec<SensorAlert>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ViewMode {
    Compact,
    Expanded,
    Pill,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UndockedView {
    Compact,
    Expanded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Units {
    #[serde(rename = "C")]
    Celsius,
    #[serde(rename = "F")]
    Fahrenheit,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub version: u32,
    pub opacity_pct: f64,
    pub click_through: bool,
    pub always_on_top: bool,
    pub units: Units,
    pub interval_ms: IntervalMs,
    pub start_with_windows: bool,
    pub accent: String,
    pub view: ViewMode,
    pub last_undocked_view: UndockedView,
    pub position: Option<WindowPosition>,
}

impl Settings {
    pub fn default_v1() -> Self {
        Self {
            version: 1,
            opacity_pct: 72.0,
            click_through: false,
            always_on_top: true,
            units: Units::Celsius,
            interval_ms: 1000,
            start_with_windows: true,
            accent: "#22E5FF".to_string(),
            view: ViewMode::Compact,
            last_undocked_view: UndockedView::Compact,
            position: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn fixture_path(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("crate root")
            .join("src/ipc/fixtures")
            .join(name)
    }

    #[test]
    fn sensor_tick_round_trips_compact_fixture() {
        let raw = fs::read_to_string(fixture_path("compact.json")).expect("read compact");
        let first: SensorTick = serde_json::from_str(&raw).expect("deserialize compact");
        let json = serde_json::to_string(&first).expect("serialize");
        let second: SensorTick = serde_json::from_str(&json).expect("re-deserialize");
        assert_eq!(first, second);
    }

    #[test]
    fn null_readings_stay_null_not_zero() {
        let raw = fs::read_to_string(fixture_path("no-pawnio.json")).expect("read fixture");
        let tick: SensorTick = serde_json::from_str(&raw).expect("deserialize");
        assert!(tick.cpu.package_temp_c.is_none());
        assert!(tick.cpu.package_power_w.is_none());
        assert!(tick.cpu.clock_mhz.is_none());
        let json = serde_json::to_string(&tick).expect("serialize");
        assert!(json.contains(r#""packageTempC":null"#));
        let again: SensorTick = serde_json::from_str(&json).expect("round-trip");
        assert!(again.cpu.package_temp_c.is_none());
    }

    #[test]
    fn gpu_snapshot_has_no_power_field() {
        let raw = fs::read_to_string(fixture_path("compact.json")).expect("read compact");
        let value: serde_json::Value = serde_json::from_str(&raw).expect("parse json");
        let gpu = value.get("gpu").and_then(|g| g.as_object()).expect("gpu object");
        assert!(!gpu.contains_key("powerW"));
        assert!(!gpu.contains_key("packagePowerW"));
    }
}