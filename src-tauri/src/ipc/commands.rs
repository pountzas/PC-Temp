use crate::ipc::types::{Settings, SensorTick, ViewMode};
use crate::settings;
use crate::state::{AppState, PollerMsg};
use serde::Deserialize;
use std::sync::Arc;
use tauri::State;

#[tauri::command(rename_all = "snake_case")]
pub fn get_snapshot(state: State<'_, Arc<AppState>>) -> Option<SensorTick> {
    state
        .last_tick
        .read()
        .ok()
        .and_then(|guard| guard.clone())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_settings() -> Settings {
    settings::get()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
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
    pub position: Option<crate::ipc::types::WindowPosition>,
}

#[tauri::command(rename_all = "snake_case")]
pub fn update_settings(
    patch: SettingsPatch,
    state: State<'_, Arc<AppState>>,
) -> Result<Settings, String> {
    let interval_ms = patch.interval_ms;
    let updated = settings::update(patch)?;
    if let Some(interval_ms) = interval_ms {
        let _ = state
            .poller
            .tx
            .blocking_send(PollerMsg::SetInterval(interval_ms));
    }
    Ok(updated)
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_view(view: ViewMode) -> Result<(), String> {
    crate::window::set_view(view)
}

#[tauri::command(rename_all = "snake_case")]
pub fn open_settings() -> Result<(), String> {
    crate::window::open_settings()
}

#[tauri::command(rename_all = "snake_case")]
pub fn close_settings() -> Result<(), String> {
    crate::window::close_settings()
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_click_through(enabled: bool) -> Result<(), String> {
    crate::window::apply_click_through(enabled)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_autostart() -> bool {
    crate::autostart::is_enabled()
}

#[tauri::command(rename_all = "snake_case")]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}