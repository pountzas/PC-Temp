use std::io::Read;
use std::path::{Path, PathBuf};

pub const TASK_NAME: &str = "PC-Temp";

pub fn create_xml_args(xml_path: &Path) -> Vec<String> {
    vec![
        "/Create".into(),
        "/TN".into(),
        TASK_NAME.into(),
        "/XML".into(),
        xml_path.display().to_string(),
        "/F".into(),
    ]
}

fn xml_escape(raw: &str) -> String {
    raw.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// Task Scheduler XML for a logon trigger with battery/time-limit settings (OQ-21).
pub fn logon_task_xml(exe: &Path, run_as_user: &str) -> String {
    let command = xml_escape(&exe.display().to_string());
    let user = xml_escape(run_as_user);
    format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>{user}</UserId>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>{user}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>true</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{command}</Command>
    </Exec>
  </Actions>
</Task>
"#
    )
}

#[cfg(windows)]
fn write_utf16_xml(path: &Path, content: &str) -> Result<std::fs::File, String> {
    use std::fs::OpenOptions;
    use std::io::Write;
    use std::os::windows::fs::OpenOptionsExt;

    const FILE_SHARE_READ: u32 = 0x0000_0001;
    const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x0020_0000;

    let mut bytes = Vec::with_capacity(2 + content.len() * 2);
    bytes.extend_from_slice(&[0xFF, 0xFE]);
    for unit in content.encode_utf16() {
        bytes.extend_from_slice(&unit.to_le_bytes());
    }

    {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .share_mode(0)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
            .open(path)
            .map_err(|e| format!("failed to create task XML: {e}"))?;
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|e| format!("failed to write task XML: {e}"))?;
    }

    let mut lock = OpenOptions::new()
        .read(true)
        .share_mode(FILE_SHARE_READ)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path)
        .map_err(|e| format!("failed to lock task XML: {e}"))?;
    let mut on_disk = Vec::with_capacity(bytes.len());
    lock.read_to_end(&mut on_disk)
        .map_err(|e| format!("failed to verify task XML: {e}"))?;
    if on_disk != bytes {
        return Err("task XML was modified before registration".into());
    }
    Ok(lock)
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
    let xml = logon_task_xml(&exe, &run_as);
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default();
    let xml_path = std::env::temp_dir().join(format!(
        "{TASK_NAME}-{}-{nonce}.xml",
        std::process::id()
    ));
    let result = (|| {
        let _lock = write_utf16_xml(&xml_path, &xml)?;
        let output = run_schtasks(&create_xml_args(&xml_path))?;
        if output.status.success() {
            Ok(())
        } else {
            Err(schtasks_failure("create", &output))
        }
    })();
    let _ = std::fs::remove_file(&xml_path);
    result
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
    fn create_xml_args_match_spec() {
        let xml_path = Path::new(r"C:\Temp\pc-temp-task.xml");
        assert_eq!(
            create_xml_args(xml_path),
            vec![
                "/Create",
                "/TN",
                "PC-Temp",
                "/XML",
                r"C:\Temp\pc-temp-task.xml",
                "/F",
            ]
        );
    }

    #[test]
    fn logon_task_xml_allows_battery_and_no_time_limit() {
        let exe = Path::new(r"C:\Program Files\PC-Temp\pc-temp.exe");
        let xml = logon_task_xml(exe, r"WORKGROUP\nik");
        assert!(
            xml.contains("<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>"),
            "task must start on battery power"
        );
        assert!(
            xml.contains("<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>"),
            "task must not stop on battery"
        );
        assert!(
            xml.contains("<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>"),
            "task must have no execution time limit"
        );
    }

    #[test]
    fn logon_task_xml_includes_logon_trigger_and_privileges() {
        let exe = Path::new(r"C:\pc-temp.exe");
        let xml = logon_task_xml(exe, r"WORKGROUP\nik");
        assert!(xml.contains("<LogonTrigger>"));
        assert!(xml.contains("<UserId>WORKGROUP\\nik</UserId>"));
        assert!(xml.contains("<LogonType>InteractiveToken</LogonType>"));
        assert!(xml.contains("<RunLevel>HighestAvailable</RunLevel>"));
    }

    #[test]
    fn logon_task_xml_command_uses_exe_path_and_escapes_xml() {
        let exe = Path::new(r"C:\Program Files\PC-Temp\pc-temp.exe");
        let xml = logon_task_xml(exe, r"WORKGROUP\nik");
        assert!(
            xml.contains(r"<Command>C:\Program Files\PC-Temp\pc-temp.exe</Command>"),
            "XML action command must reference the install exe path"
        );

        let amp = logon_task_xml(
            Path::new(r"C:\Tools & Apps\<pc>\pc-temp.exe"),
            r"R&D\o'neil",
        );
        assert!(amp.contains(
            r"<Command>C:\Tools &amp; Apps\&lt;pc&gt;\pc-temp.exe</Command>"
        ));
        assert!(amp.contains(r"<UserId>R&amp;D\o&apos;neil</UserId>"));
        assert!(
            !amp.contains("Tools & Apps"),
            "raw & must never reach the XML"
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

    #[test]
    #[cfg(windows)]
    fn write_utf16_xml_refuses_existing_path() {
        let dir = std::env::temp_dir();
        let path = dir.join(format!(
            "PC-Temp-test-{}-{}.xml",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let _ = std::fs::remove_file(&path);
        let xml = logon_task_xml(Path::new(r"C:\pc-temp.exe"), r"WORKGROUP\nik");
        write_utf16_xml(&path, &xml).expect("first create");
        let err = write_utf16_xml(&path, &xml).expect_err("must refuse existing path");
        assert!(
            err.contains("failed to create task XML"),
            "unexpected error: {err}"
        );
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    #[cfg(windows)]
    fn write_utf16_xml_allows_shared_read_while_locked() {
        use std::fs::OpenOptions;
        use std::os::windows::fs::OpenOptionsExt;

        const FILE_SHARE_READ: u32 = 0x0000_0001;
        const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x0020_0000;

        let dir = std::env::temp_dir();
        let path = dir.join(format!(
            "PC-Temp-share-{}-{}.xml",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let _ = std::fs::remove_file(&path);
        let xml = logon_task_xml(Path::new(r"C:\pc-temp.exe"), r"WORKGROUP\nik");
        let _lock = write_utf16_xml(&path, &xml).expect("write");
        let mut reader = OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
            .open(&path)
            .expect("shared read open while lock held");
        let mut buf = Vec::new();
        reader
            .read_to_end(&mut buf)
            .expect("read XML while lock held");
        assert!(buf.starts_with(&[0xFF, 0xFE]));
        let _ = std::fs::remove_file(&path);
    }
}