use std::path::{Path, PathBuf};

pub const TASK_NAME: &str = "PC-Temp";

/// `/TR` value for schtasks: quoted executable path (`"C:\path with spaces\app.exe"`).
pub fn task_run_tr(exe: &Path) -> String {
    format!("\"{}\"", exe.display())
}

pub fn create_args(exe: &Path, run_as_user: &str) -> Vec<String> {
    vec![
        "/Create".into(),
        "/SC".into(),
        "ONLOGON".into(),
        "/TN".into(),
        TASK_NAME.into(),
        "/TR".into(),
        task_run_tr(exe),
        "/RL".into(),
        "HIGHEST".into(),
        "/IT".into(),
        "/RU".into(),
        run_as_user.into(),
        "/F".into(),
    ]
}

pub fn delete_args() -> Vec<String> {
    vec![
        "/Delete".into(),
        "/TN".into(),
        TASK_NAME.into(),
        "/F".into(),
    ]
}

pub fn query_args() -> Vec<String> {
    vec!["/Query".into(), "/TN".into(), TASK_NAME.into()]
}

#[cfg(windows)]
pub fn interactive_run_as() -> Result<String, String> {
    let user = std::env::var("USERNAME").map_err(|e| format!("USERNAME: {e}"))?;
    let domain = std::env::var("USERDOMAIN").map_err(|e| format!("USERDOMAIN: {e}"))?;
    Ok(format!("{domain}\\{user}"))
}

pub fn schtasks_exe_from(system_root: Option<PathBuf>) -> PathBuf {
    match system_root {
        Some(root) if root.is_absolute() => root.join("System32").join("schtasks.exe"),
        _ => PathBuf::from(r"C:\Windows\System32\schtasks.exe"),
    }
}

/// Absolute path to `schtasks.exe` under `%SystemRoot%\System32`.
#[cfg(windows)]
pub fn schtasks_exe() -> PathBuf {
    schtasks_exe_from(std::env::var_os("SystemRoot").map(PathBuf::from))
}

#[cfg(windows)]
pub fn run_schtasks(args: &[String]) -> Result<std::process::Output, String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    Command::new(schtasks_exe())
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("failed to run schtasks: {e}"))
}

#[cfg(windows)]
pub fn query_task_registered() -> bool {
    match run_schtasks(&query_args()) {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

#[cfg(windows)]
fn schtasks_failure(verb: &str, output: &std::process::Output) -> String {
    let code = output
        .status
        .code()
        .map(|c| c.to_string())
        .unwrap_or_else(|| "?".into());
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let detail = if !stderr.is_empty() {
        stderr.into_owned()
    } else if !stdout.is_empty() {
        stdout.into_owned()
    } else {
        "(no output)".into()
    };
    format!("schtasks {verb} failed (exit {code}): {detail}")
}

#[cfg(windows)]
pub fn create_logon_task(exe: PathBuf) -> Result<(), String> {
    let run_as = interactive_run_as()?;
    let args = create_args(&exe, &run_as);
    let output = run_schtasks(&args)?;
    if output.status.success() {
        return Ok(());
    }
    Err(schtasks_failure("create", &output))
}

#[cfg(windows)]
pub fn delete_logon_task() -> Result<(), String> {
    let args = delete_args();
    let output = run_schtasks(&args)?;
    if output.status.success() {
        return Ok(());
    }
    Err(schtasks_failure("delete", &output))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn task_run_tr_quotes_paths_with_spaces() {
        let exe = Path::new(r"C:\Program Files\PC-Temp\pc-temp.exe");
        assert_eq!(
            task_run_tr(exe),
            r#""C:\Program Files\PC-Temp\pc-temp.exe""#
        );
    }

    #[test]
    fn task_run_tr_quotes_simple_path() {
        let exe = Path::new(r"C:\pc-temp.exe");
        assert_eq!(task_run_tr(exe), r#""C:\pc-temp.exe""#);
    }

    #[test]
    fn create_args_match_spec() {
        let exe = Path::new(r"C:\Program Files\PC-Temp\pc-temp.exe");
        let args = create_args(exe, r"WORKGROUP\nik");
        assert_eq!(
            args,
            vec![
                "/Create",
                "/SC",
                "ONLOGON",
                "/TN",
                "PC-Temp",
                "/TR",
                r#""C:\Program Files\PC-Temp\pc-temp.exe""#,
                "/RL",
                "HIGHEST",
                "/IT",
                "/RU",
                r"WORKGROUP\nik",
                "/F",
            ]
        );
    }

    #[test]
    fn delete_args_match_spec() {
        assert_eq!(delete_args(), vec!["/Delete", "/TN", "PC-Temp", "/F"]);
    }

    #[test]
    fn query_args_match_spec() {
        assert_eq!(query_args(), vec!["/Query", "/TN", "PC-Temp"]);
    }

    #[test]
    fn schtasks_exe_falls_back_when_root_missing_or_relative() {
        let fallback = PathBuf::from(r"C:\Windows\System32\schtasks.exe");
        assert_eq!(schtasks_exe_from(None), fallback);
        assert_eq!(schtasks_exe_from(Some(PathBuf::new())), fallback);
        assert_eq!(
            schtasks_exe_from(Some(PathBuf::from("Windows"))),
            fallback
        );
    }

    #[test]
    #[cfg(windows)]
    fn schtasks_exe_uses_absolute_system_root() {
        let exe = schtasks_exe_from(Some(PathBuf::from(r"D:\Win")));
        assert_eq!(exe, PathBuf::from(r"D:\Win\System32\schtasks.exe"));
    }

    #[test]
    #[cfg(windows)]
    fn schtasks_exe_is_absolute_system32_path() {
        let exe = super::schtasks_exe();
        assert!(exe.is_absolute(), "schtasks path must be absolute: {exe:?}");
        let path = exe.to_string_lossy();
        assert!(
            path.ends_with(r"\System32\schtasks.exe"),
            "expected System32 schtasks.exe, got {path}"
        );
        assert!(
            exe.components().count() >= 3,
            "must not launch schtasks by bare name: {path}"
        );
    }
}
