use crate::ipc::types::Settings;
use serde_json::Value as JsonValue;

pub const STORE_PATH: &str = "settings.json";
pub const STORE_KEY: &str = "settings";

fn merge_json(base: JsonValue, overlay: JsonValue) -> JsonValue {
    match (base, overlay) {
        (JsonValue::Object(mut b), JsonValue::Object(o)) => {
            for (k, v) in o {
                let entry = b.remove(&k).unwrap_or(JsonValue::Null);
                b.insert(k, merge_json(entry, v));
            }
            JsonValue::Object(b)
        }
        (_, overlay) => overlay,
    }
}

/// Merge stored JSON into defaults; corrupt or unknown shape → full defaults.
pub fn hydrate_settings(value: JsonValue) -> Settings {
    let defaults = settings_to_json(&Settings::default_v1());
    let merged = merge_json(defaults, value);
    match serde_json::from_value::<Settings>(merged) {
        Ok(s) if s.version == 1 => s,
        _ => Settings::default_v1(),
    }
}

pub fn settings_to_json(settings: &Settings) -> JsonValue {
    serde_json::to_value(settings).unwrap_or(JsonValue::Null)
}

/// Startup policy: never restore click-through as enabled (tray must exist first).
pub fn sanitize_for_startup(mut settings: Settings) -> Settings {
    if settings.click_through {
        settings.click_through = false;
    }
    settings
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ipc::types::{UndockedView, Units, ViewMode};

    #[test]
    fn hydrate_accepts_valid_v1_document() {
        let json = serde_json::json!({
            "version": 1,
            "opacityPct": 50.0,
            "clickThrough": false,
            "alwaysOnTop": true,
            "units": "C",
            "intervalMs": 2000,
            "startWithWindows": false,
            "accent": "#22E5FF",
            "view": "compact",
            "lastUndockedView": "compact",
            "position": null
        });
        let s = hydrate_settings(json);
        assert_eq!(s.opacity_pct, 50.0);
        assert_eq!(s.interval_ms, 2000);
        assert_eq!(s.units, Units::Celsius);
        assert_eq!(s.view, ViewMode::Compact);
        assert_eq!(s.last_undocked_view, UndockedView::Compact);
    }

    #[test]
    fn hydrate_partial_object_fills_missing_keys_from_defaults() {
        let s = hydrate_settings(serde_json::json!({ "intervalMs": 5000 }));
        assert_eq!(s.interval_ms, 5000);
        assert_eq!(s.opacity_pct, Settings::default_v1().opacity_pct);
        assert_eq!(s.version, 1);
    }

    #[test]
    fn hydrate_corrupt_value_returns_defaults() {
        let s = hydrate_settings(serde_json::json!("not-an-object"));
        assert_eq!(s, Settings::default_v1());
    }

    #[test]
    fn hydrate_wrong_version_returns_defaults() {
        let mut json = settings_to_json(&Settings::default_v1());
        json["version"] = serde_json::json!(99);
        let s = hydrate_settings(json);
        assert_eq!(s, Settings::default_v1());
    }

    #[test]
    fn sanitize_for_startup_clears_click_through() {
        let mut s = Settings::default_v1();
        s.click_through = true;
        let sanitized = sanitize_for_startup(s);
        assert!(!sanitized.click_through);
    }
}
