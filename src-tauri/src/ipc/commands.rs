use crate::ipc::events;
use crate::ipc::types::{SensorTick, Settings, ViewMode, WindowPosition};
use crate::settings;
use crate::state::{AppState, PollerMsg};
use serde::Deserialize;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

#[tauri::command(rename_all = "snake_case")]
pub fn get_snapshot(state: State<'_, Arc<AppState>>) -> Option<SensorTick> {
    state.last_tick.read().ok().and_then(|guard| guard.clone())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_settings() -> Settings {
    settings::get()
}

fn deserialize_some<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Ok(Some(T::deserialize(deserializer)?))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SettingsPatch {
    pub opacity_pct: Option<f64>,
    pub click_through: Option<bool>,
    pub always_on_top: Option<bool>,
    pub units: Option<crate::ipc::types::Units>,
    pub interval_ms: Option<u32>,
    pub start_with_windows: Option<bool>,
    pub accent: Option<String>,
    pub view: Option<ViewMode>,
    pub last_undocked_view: Option<crate::ipc::types::UndockedView>,
    #[serde(default, deserialize_with = "deserialize_some")]
    pub position: Option<Option<WindowPosition>>,
}

const ALLOWED_INTERVALS: &[u32] = &[1000, 2000, 5000];
const ALLOWED_ACCENTS: &[&str] = &["#22E5FF", "#B65CFF", "#3DFFA8", "#FFB020"];

pub fn validate(patch: &SettingsPatch) -> Result<(), String> {
    if let Some(interval_ms) = patch.interval_ms {
        if !ALLOWED_INTERVALS.contains(&interval_ms) {
            return Err(format!("invalid interval_ms: {interval_ms}"));
        }
    }
    if let Some(ref accent) = patch.accent {
        if !ALLOWED_ACCENTS.contains(&accent.as_str()) {
            return Err(format!("invalid accent: {accent}"));
        }
    }
    if let Some(opacity_pct) = patch.opacity_pct {
        if !(0.0..=100.0).contains(&opacity_pct) {
            return Err(format!("invalid opacity_pct: {opacity_pct}"));
        }
    }
    Ok(())
}

#[derive(Clone, serde::Serialize)]
struct ViewChangedPayload {
    view: ViewMode,
}

#[tauri::command(rename_all = "snake_case")]
pub fn update_settings(
    app: AppHandle,
    patch: SettingsPatch,
    state: State<'_, Arc<AppState>>,
) -> Result<Settings, String> {
    validate(&patch)?;
    let interval_ms = patch.interval_ms;
    let updated = settings::update(patch)?;
    if let Some(interval_ms) = interval_ms {
        if let Err(e) = state
            .poller
            .tx
            .try_send(PollerMsg::SetInterval(interval_ms))
        {
            log::warn!("poller interval update dropped: {e}");
        }
    }
    if let Err(e) = app.emit(events::SETTINGS_CHANGED, &updated) {
        log::warn!("emit settings-changed failed: {e}");
    }
    Ok(updated)
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_view(app: AppHandle, view: ViewMode) -> Result<(), String> {
    crate::window::set_view(&app, view)?;
    app.emit(events::VIEW_CHANGED, ViewChangedPayload { view })
        .map_err(|e| format!("emit view-changed: {e}"))?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn open_settings(app: AppHandle) -> Result<(), String> {
    crate::window::open_settings(&app)
}

#[tauri::command(rename_all = "snake_case")]
pub fn close_settings(app: AppHandle) -> Result<(), String> {
    crate::window::close_settings(&app)
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_click_through(app: AppHandle, enabled: bool) -> Result<(), String> {
    crate::window::apply_click_through(&app, enabled)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_autostart() -> bool {
    crate::autostart::is_enabled()
}

#[tauri::command(rename_all = "snake_case")]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_patch() -> SettingsPatch {
        SettingsPatch {
            opacity_pct: None,
            click_through: None,
            always_on_top: None,
            units: None,
            interval_ms: None,
            start_with_windows: None,
            accent: None,
            view: None,
            last_undocked_view: None,
            position: None,
        }
    }

    #[test]
    fn validate_rejects_bad_interval() {
        let mut patch = empty_patch();
        patch.interval_ms = Some(0);
        assert!(validate(&patch).is_err());
        patch.interval_ms = Some(1500);
        assert!(validate(&patch).is_err());
        patch.interval_ms = Some(1000);
        assert!(validate(&patch).is_ok());
    }

    #[test]
    fn validate_rejects_bad_accent() {
        let mut patch = empty_patch();
        patch.accent = Some("#FFFFFF".to_string());
        assert!(validate(&patch).is_err());
        patch.accent = Some("#22E5FF".to_string());
        assert!(validate(&patch).is_ok());
    }

    #[test]
    fn validate_rejects_bad_opacity() {
        let mut patch = empty_patch();
        patch.opacity_pct = Some(-1.0);
        assert!(validate(&patch).is_err());
        patch.opacity_pct = Some(101.0);
        assert!(validate(&patch).is_err());
        patch.opacity_pct = Some(72.0);
        assert!(validate(&patch).is_ok());
    }

    #[test]
    fn settings_patch_position_null_means_clear() {
        let patch: SettingsPatch =
            serde_json::from_str(r#"{"position":null}"#).expect("deserialize");
        assert_eq!(patch.position, Some(None));
    }

    #[test]
    fn settings_patch_omitted_position_stays_none() {
        let patch: SettingsPatch = serde_json::from_str(r#"{}"#).expect("deserialize");
        assert_eq!(patch.position, None);
    }

    #[test]
    fn settings_patch_rejects_misspelled_interval_field() {
        let err = serde_json::from_str::<SettingsPatch>(r#"{"interval":2000}"#);
        assert!(err.is_err());
    }
}
