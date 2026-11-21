mod schtasks;

#[cfg(windows)]
pub fn is_enabled() -> bool {
    schtasks::query_task_registered()
}

#[cfg(windows)]
pub fn set_enabled(enabled: bool) -> Result<(), String> {
    if enabled {
        let exe = std::env::current_exe().map_err(|e| format!("current_exe: {e}"))?;
        schtasks::create_logon_task(exe)
    } else {
        schtasks::delete_logon_task()
    }
}

#[cfg(not(windows))]
pub fn is_enabled() -> bool {
    false
}

#[cfg(not(windows))]
pub fn set_enabled(_enabled: bool) -> Result<(), String> {
    Err("autostart is only supported on Windows".to_string())
}
