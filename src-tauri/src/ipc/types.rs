use serde::{Deserialize, Serialize};

pub type Pct = f64;
pub type Celsius = f64;
pub type Watts = f64;
pub type MHz = f64;

/// Poll interval in milliseconds (`1000`, `2000`, or `5000`).
pub type IntervalMs = u32;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CpuCoreReading {
    pub index: u8,
    pub temp_c: Option<Celsius>,
    pub load_pct: Option<Pct>,
    #[serde(rename = "clockMHz")]
    pub clock_mhz: Option<MHz>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CpuThreadReading {
    pub index: u32,
    pub load_pct: Option<Pct>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CpuSnapshot {
    pub name: String,
    pub load_pct: Option<Pct>,
    pub package_temp_c: Option<Celsius>,
    pub package_power_w: Option<Watts>,
    #[serde(rename = "clockMHz")]
    pub clock_mhz: Option<MHz>,
    #[serde(rename = "baseClockMHz")]
    pub base_clock_mhz: u32,
    pub cores: Vec<CpuCoreReading>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub threads: Option<Vec<CpuThreadReading>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GpuSnapshot {
    pub name: String,
    pub load_pct: Option<Pct>,
    pub core_temp_c: Option<Celsius>,
    #[serde(rename = "coreClockMHz")]
    pub core_clock_mhz: Option<MHz>,
    pub fan_pct: Option<Pct>,
    #[serde(rename = "vramUsedMiB")]
    pub vram_used_mib: Option<u32>,
    #[serde(rename = "vramTotalMiB")]
    pub vram_total_mib: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
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
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SensorHistory {
    pub cpu_load: Vec<Option<Pct>>,
    pub gpu_load: Vec<Option<Pct>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
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

    const SENSOR_FIXTURES: &[&str] = &[
        "compact.json",
        "expanded.json",
        "warn.json",
        "hot.json",
        "no-nvml.json",
        "no-pawnio.json",
    ];

    fn json_values_equal(a: &serde_json::Value, b: &serde_json::Value) -> bool {
        use serde_json::Value;
        match (a, b) {
            (Value::Number(na), Value::Number(nb)) => match (na.as_f64(), nb.as_f64()) {
                (Some(x), Some(y)) => x == y,
                _ => na == nb,
            },
            (Value::Object(map_a), Value::Object(map_b)) => {
                map_a.len() == map_b.len()
                    && map_a.keys().all(|k| {
                        map_b
                            .get(k)
                            .map(|v| json_values_equal(&map_a[k], v))
                            .unwrap_or(false)
                    })
            }
            (Value::Array(arr_a), Value::Array(arr_b)) => {
                arr_a.len() == arr_b.len()
                    && arr_a
                        .iter()
                        .zip(arr_b.iter())
                        .all(|(x, y)| json_values_equal(x, y))
            }
            _ => a == b,
        }
    }

    #[test]
    fn sensor_tick_serialises_to_identical_json_for_every_fixture() {
        for name in SENSOR_FIXTURES {
            let raw = fs::read_to_string(fixture_path(name))
                .unwrap_or_else(|e| panic!("read {name}: {e}"));
            let fixture: serde_json::Value =
                serde_json::from_str(&raw).unwrap_or_else(|e| panic!("parse {name}: {e}"));
            let tick: SensorTick =
                serde_json::from_str(&raw).unwrap_or_else(|e| panic!("deserialize {name}: {e}"));
            let serialised =
                serde_json::to_value(&tick).unwrap_or_else(|e| panic!("serialize {name}: {e}"));
            assert!(
                json_values_equal(&serialised, &fixture),
                "{name}: serialised SensorTick must match fixture JSON"
            );
        }
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
        let gpu = value
            .get("gpu")
            .and_then(|g| g.as_object())
            .expect("gpu object");
        assert!(!gpu.contains_key("powerW"));
        assert!(!gpu.contains_key("packagePowerW"));
    }

    #[test]
    fn compact_fixture_populates_mhz_and_mib_fields() {
        let raw = fs::read_to_string(fixture_path("compact.json")).expect("read compact");
        let tick: SensorTick = serde_json::from_str(&raw).expect("deserialize");
        assert_eq!(tick.cpu.clock_mhz, Some(3900.0));
        assert!(tick.cpu.cores.iter().all(|c| c.clock_mhz.is_some()));
        assert_eq!(tick.gpu.core_clock_mhz, Some(1150.0));
        assert_eq!(tick.gpu.vram_used_mib, Some(512));
        assert_eq!(tick.gpu.vram_total_mib, Some(6144));
    }

    #[test]
    fn serialised_tick_uses_contract_mhz_mib_key_names() {
        let raw = fs::read_to_string(fixture_path("compact.json")).expect("read compact");
        let tick: SensorTick = serde_json::from_str(&raw).expect("deserialize");
        let json = serde_json::to_string(&tick).expect("serialize");
        assert!(json.contains(r#""clockMHz""#));
        assert!(json.contains(r#""coreClockMHz""#));
        assert!(json.contains(r#""vramUsedMiB""#));
        assert!(json.contains(r#""vramTotalMiB""#));
        assert!(!json.contains(r#""clockMhz""#));
        assert!(!json.contains(r#""coreClockMhz""#));
        assert!(!json.contains(r#""vramUsedMib""#));
        assert!(!json.contains(r#""vramTotalMib""#));
    }

    #[test]
    fn unknown_cpu_field_fails_deserialize() {
        let raw = fs::read_to_string(fixture_path("compact.json")).expect("read compact");
        let mut value: serde_json::Value = serde_json::from_str(&raw).expect("parse");
        value["cpu"]["unexpectedField"] = serde_json::json!(1);
        let err = serde_json::from_value::<SensorTick>(value);
        assert!(err.is_err());
    }
}
