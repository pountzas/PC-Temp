pub fn is_enabled() -> bool {
    log::info!("autostart::is_enabled (stub)");
    false
}

pub fn set_enabled(_enabled: bool) -> Result<(), String> {
    log::info!("autostart::set_enabled (stub)");
    Ok(())
}