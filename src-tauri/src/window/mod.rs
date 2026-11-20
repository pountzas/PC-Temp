use crate::ipc::types::ViewMode;
use tauri::AppHandle;

pub fn init(_app: &AppHandle) {
    log::info!("window::init (stub)");
}

pub fn set_view(_app: &AppHandle, view: ViewMode) -> Result<(), String> {
    log::info!("window::set_view {:?}", view);
    Ok(())
}

pub fn apply_always_on_top(_app: &AppHandle, _enabled: bool) -> Result<(), String> {
    log::info!("window::apply_always_on_top (stub)");
    Ok(())
}

pub fn apply_click_through(_app: &AppHandle, enabled: bool) -> Result<(), String> {
    log::info!("window::apply_click_through enabled={enabled}");
    Ok(())
}

pub fn open_settings(_app: &AppHandle) -> Result<(), String> {
    log::info!("window::open_settings (stub)");
    Ok(())
}

pub fn close_settings(_app: &AppHandle) -> Result<(), String> {
    log::info!("window::close_settings (stub)");
    Ok(())
}

pub fn hide_widget(_app: &AppHandle) -> Result<(), String> {
    log::info!("window::hide_widget (stub)");
    Ok(())
}