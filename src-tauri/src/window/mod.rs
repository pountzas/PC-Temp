use crate::ipc::types::ViewMode;

pub fn init() {
    log::info!("window::init (stub)");
}

pub fn set_view(view: ViewMode) -> Result<(), String> {
    log::info!("window::set_view {:?}", view);
    Ok(())
}

pub fn apply_always_on_top(_enabled: bool) -> Result<(), String> {
    log::info!("window::apply_always_on_top (stub)");
    Ok(())
}

pub fn apply_click_through(enabled: bool) -> Result<(), String> {
    log::info!("window::apply_click_through enabled={enabled}");
    Ok(())
}

pub fn open_settings() -> Result<(), String> {
    log::info!("window::open_settings (stub)");
    Ok(())
}

pub fn close_settings() -> Result<(), String> {
    log::info!("window::close_settings (stub)");
    Ok(())
}

pub fn hide_widget() -> Result<(), String> {
    log::info!("window::hide_widget (stub)");
    Ok(())
}