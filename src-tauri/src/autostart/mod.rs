#[cfg(windows)]
mod install_dir;
mod schtasks;

#[cfg(windows)]
pub fn is_enabled() -> bool {
    if !schtasks::query_task_registered() {
        return false;
    }
    let exe = match std::env::current_exe() {
        Ok(exe) => exe,
        Err(e) => {
            log::warn!("autostart: current_exe: {e}");
            return false;
        }
    };
    match install_dir::ensure_autostart_install_dir(&exe) {
        Ok(()) => true,
        Err(reason) => {
            log::warn!("autostart disabled: {reason}");
            if let Err(del_err) = schtasks::delete_logon_task() {
                log::warn!("autostart: could not remove unsafe logon task: {del_err}");
            }
            false
        }
    }
}

#[cfg(windows)]
pub fn set_enabled(enabled: bool) -> Result<(), String> {
    if enabled {
        let exe = std::env::current_exe().map_err(|e| format!("current_exe: {e}"))?;
        install_dir::ensure_autostart_install_dir(&exe)?;
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

/// When a logon task exists but the install path is no longer safe, autostart is reported as off.
#[cfg(all(test, windows))]
pub(crate) fn autostart_enabled_for_registered_task(
    registered: bool,
    exe: &std::path::Path,
) -> bool {
    if !registered {
        return false;
    }
    install_dir::ensure_autostart_install_dir(exe).is_ok()
}

#[cfg(all(test, windows))]
mod reconcile_tests {
    use super::autostart_enabled_for_registered_task;
    use std::path::Path;

    #[test]
    fn unsafe_install_path_reports_autostart_off() {
        let exe = Path::new(r"C:\Users\nik\Downloads\pc-temp\pc-temp.exe");
        assert!(!autostart_enabled_for_registered_task(true, exe));
        assert!(!autostart_enabled_for_registered_task(false, exe));
    }
}