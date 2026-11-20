//! Spawns and talks to the `lhm-reader` JSON-lines sidecar (HW-05).

use crate::ipc::lhm_protocol::{parse_response, LhmReadCmd, LhmResponse};
use std::io::{self, BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

const READ_TIMEOUT: Duration = Duration::from_millis(500);
const QUIT_WAIT: Duration = Duration::from_millis(500);
const DEV_BINARY: &str = "binaries/lhm-reader-x86_64-pc-windows-msvc.exe";
const BUNDLED_BINARY: &str = "lhm-reader.exe";

#[derive(Debug, thiserror::Error)]
pub enum LhmClientError {
    #[error("failed to spawn lhm-reader: {0}")]
    Spawn(#[from] io::Error),
    #[error("lhm-reader binary not found at {0}")]
    BinaryNotFound(PathBuf),
    #[error("read timed out after {0:?}")]
    Timeout(Duration),
    #[error("protocol error: {0}")]
    Protocol(#[from] serde_json::Error),
    #[error("sidecar error: {0}")]
    Sidecar(String),
    #[error("empty response from sidecar")]
    EmptyResponse,
    #[error("sidecar pipe configuration error: {0}")]
    Pipe(String),
}

/// Resolves the sidecar executable: bundled next to the host exe, else dev binary in debug builds only.
pub fn resolve_binary_path() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let bundled = dir.join(BUNDLED_BINARY);
            if bundled.is_file() {
                return bundled;
            }
        }
    }
    #[cfg(debug_assertions)]
    {
        return PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(DEV_BINARY);
    }
    #[cfg(not(debug_assertions))]
    {
        PathBuf::from(BUNDLED_BINARY)
    }
}

#[cfg(test)]
pub(crate) fn lhm_fixture_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/ipc/fixtures/lhm_read.json")
}

/// CPU block from the sidecar with correct `clockMHz` field naming (host `source` types omit it).
#[derive(Debug, Clone, PartialEq)]
pub struct LhmCpuData {
    pub name: String,
    pub package_temp_c: Option<f64>,
    pub package_power_w: Option<f64>,
    pub cores: Vec<LhmCoreData>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LhmCoreData {
    pub index: u8,
    pub temp_c: Option<f64>,
    pub clock_mhz: Option<f64>,
}

pub trait LhmReader: Send {
    fn read(&mut self) -> Result<LhmCpuData, LhmClientError>;
}

fn parse_cpu_data(resp: &LhmResponse, raw_line: &str) -> Result<LhmCpuData, LhmClientError> {
    if !resp.ok {
        return Err(LhmClientError::Sidecar(
            resp.error
                .clone()
                .unwrap_or_else(|| "unknown error".into()),
        ));
    }
    parse_cpu_from_line(raw_line)
}

/// Parses the `cpu` object from a full JSON-lines response (fixture uses `clockMHz`).
pub fn parse_cpu_from_line(line: &str) -> Result<LhmCpuData, LhmClientError> {
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LineCpu {
        name: String,
        package_temp_c: Option<f64>,
        package_power_w: Option<f64>,
        cores: Vec<LineCore>,
    }

    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LineCore {
        index: u8,
        temp_c: Option<f64>,
        #[serde(rename = "clockMHz")]
        clock_mhz: Option<f64>,
    }

    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LineRoot {
        ok: bool,
        cpu: Option<LineCpu>,
        error: Option<String>,
    }

    let root: LineRoot = serde_json::from_str(line.trim())?;
    if !root.ok {
        return Err(LhmClientError::Sidecar(
            root.error.unwrap_or_else(|| "unknown error".into()),
        ));
    }
    let cpu = root.cpu.ok_or(LhmClientError::EmptyResponse)?;
    Ok(LhmCpuData {
        name: cpu.name,
        package_temp_c: cpu.package_temp_c,
        package_power_w: cpu.package_power_w,
        cores: cpu
            .cores
            .into_iter()
            .map(|c| LhmCoreData {
                index: c.index,
                temp_c: c.temp_c,
                clock_mhz: c.clock_mhz,
            })
            .collect(),
    })
}

struct StdoutPump {
    rx: mpsc::Receiver<io::Result<String>>,
}

impl StdoutPump {
    fn spawn(stdout: impl io::Read + Send + 'static) -> Self {
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            loop {
                let mut line = String::new();
                match reader.read_line(&mut line) {
                    Ok(0) => {
                        let _ = tx.send(Err(io::Error::new(
                            io::ErrorKind::UnexpectedEof,
                            "stdout closed",
                        )));
                        break;
                    }
                    Ok(_) => {
                        if tx.send(Ok(line)).is_err() {
                            break;
                        }
                    }
                    Err(err) => {
                        let _ = tx.send(Err(err));
                        break;
                    }
                }
            }
        });
        Self { rx }
    }

    fn drain_stale(&self) {
        while self.rx.try_recv().is_ok() {}
    }

    fn recv_line(
        &self,
        timeout: Duration,
        broken: &mut bool,
    ) -> Result<String, LhmClientError> {
        self.drain_stale();
        match self.rx.recv_timeout(timeout) {
            Ok(Ok(line)) => Ok(line),
            Ok(Err(err)) => {
                *broken = true;
                Err(LhmClientError::Spawn(err))
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                *broken = true;
                Err(LhmClientError::Timeout(timeout))
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                *broken = true;
                Err(LhmClientError::EmptyResponse)
            }
        }
    }
}

pub(crate) struct LhmChild {
    child: Child,
    stdin: ChildStdin,
    stdout_pump: StdoutPump,
    broken: bool,
    #[cfg(windows)]
    job_handle: JobHandle,
    #[cfg(not(windows))]
    _job_placeholder: (),
}

#[cfg(windows)]
struct JobHandle(windows_sys::Win32::Foundation::HANDLE);

#[cfg(windows)]
unsafe impl Send for JobHandle {}

impl LhmChild {
    pub(crate) fn spawn(binary: &Path) -> Result<Self, LhmClientError> {
        if !binary.is_file() {
            return Err(LhmClientError::BinaryNotFound(binary.to_path_buf()));
        }
        let mut cmd = Command::new(binary);
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        Self::spawn_command(cmd)
    }

    pub(crate) fn spawn_command(mut cmd: Command) -> Result<Self, LhmClientError> {
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = cmd.spawn().map_err(LhmClientError::Spawn)?;
        #[cfg(windows)]
        let job_handle = JobHandle(assign_kill_on_job_close(&child)?);
        #[cfg(not(windows))]
        let _job_placeholder = ();

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| LhmClientError::Pipe("stdin not piped".into()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| LhmClientError::Pipe("stdout not piped".into()))?;
        let stdout_pump = StdoutPump::spawn(stdout);

        Ok(Self {
            child,
            stdin,
            stdout_pump,
            broken: false,
            #[cfg(windows)]
            job_handle,
            #[cfg(not(windows))]
            _job_placeholder,
        })
    }

    fn request_read(&mut self) -> Result<LhmCpuData, LhmClientError> {
        if self.broken || self.child.try_wait().ok().flatten().is_some() {
            self.broken = true;
            return Err(LhmClientError::EmptyResponse);
        }
        self.stdin
            .write_all(LhmReadCmd::read_line().as_bytes())
            .map_err(LhmClientError::Spawn)?;
        self.stdin.flush().map_err(LhmClientError::Spawn)?;
        let line = self.stdout_pump.recv_line(READ_TIMEOUT, &mut self.broken)?;
        let resp = parse_response(&line)?;
        parse_cpu_data(&resp, &line)
    }

    fn send_quit(&mut self) {
        let _ = self.stdin.write_all(LhmReadCmd::quit_line().as_bytes());
        let _ = self.stdin.flush();
        let deadline = Instant::now() + QUIT_WAIT;
        loop {
            match self.child.try_wait() {
                Ok(Some(_)) => return,
                Ok(None) => {
                    if Instant::now() >= deadline {
                        let _ = self.child.kill();
                        let _ = self.child.wait();
                        return;
                    }
                    std::thread::sleep(Duration::from_millis(10));
                }
                Err(_) => {
                    let _ = self.child.kill();
                    let _ = self.child.wait();
                    return;
                }
            }
        }
    }

    fn kill_and_wait(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        self.broken = true;
    }

    fn needs_respawn(&mut self) -> bool {
        self.broken || self.child.try_wait().ok().flatten().is_some()
    }
}

impl Drop for LhmChild {
    fn drop(&mut self) {
        self.send_quit();
        #[cfg(windows)]
        {
            if !self.job_handle.0.is_null() {
                unsafe {
                    windows_sys::Win32::Foundation::CloseHandle(self.job_handle.0);
                }
            }
        }
    }
}

#[cfg(windows)]
fn assign_kill_on_job_close(
    child: &Child,
) -> Result<windows_sys::Win32::Foundation::HANDLE, LhmClientError> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    unsafe {
        let job: HANDLE = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return Err(LhmClientError::Spawn(io::Error::last_os_error()));
        }

        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let ok = SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            (&info as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        if ok == 0 {
            let err = io::Error::last_os_error();
            CloseHandle(job);
            return Err(LhmClientError::Spawn(err));
        }

        let process: HANDLE = child.as_raw_handle() as HANDLE;
        if AssignProcessToJobObject(job, process) == 0 {
            let err = io::Error::last_os_error();
            CloseHandle(job);
            return Err(LhmClientError::Spawn(err));
        }
        Ok(job)
    }
}

pub struct LhmClient {
    binary: PathBuf,
    child: Option<LhmChild>,
}

impl LhmClient {
    pub fn try_spawn() -> Option<Self> {
        let path = resolve_binary_path();
        if !path.is_file() {
            log::info!("lhm-reader not found at {}", path.display());
            return None;
        }
        match LhmChild::spawn(&path) {
            Ok(child) => Some(Self {
                binary: path,
                child: Some(child),
            }),
            Err(err) => {
                log::warn!("failed to spawn lhm-reader: {err}");
                None
            }
        }
    }

    fn respawn_if_needed(&mut self) {
        let needs = self
            .child
            .as_mut()
            .map(|c| c.needs_respawn())
            .unwrap_or(true);
        if !needs {
            return;
        }
        if let Some(mut old) = self.child.take() {
            old.kill_and_wait();
        }
        if self.binary.is_file() {
            match LhmChild::spawn(&self.binary) {
                Ok(child) => self.child = Some(child),
                Err(err) => {
                    log::warn!("lhm-reader respawn failed: {err}");
                    self.child = None;
                }
            }
        } else {
            self.child = None;
        }
    }
}

impl LhmReader for LhmClient {
    fn read(&mut self) -> Result<LhmCpuData, LhmClientError> {
        self.respawn_if_needed();
        let Some(child) = self.child.as_mut() else {
            return Err(LhmClientError::BinaryNotFound(self.binary.clone()));
        };
        child.request_read()
    }
}

impl Drop for LhmClient {
    fn drop(&mut self) {
        let _ = self.child.take();
    }
}

#[cfg(test)]
pub struct MockLhmClient {
    data: Option<LhmCpuData>,
}

#[cfg(test)]
impl MockLhmClient {
    pub fn new() -> Self {
        Self { data: None }
    }

    pub fn with_data(data: LhmCpuData) -> Self {
        Self { data: Some(data) }
    }

    pub fn from_fixture() -> Self {
        let raw = std::fs::read_to_string(lhm_fixture_path()).expect("fixture");
        Self {
            data: Some(parse_cpu_from_line(&raw).expect("parse fixture")),
        }
    }
}

#[cfg(test)]
impl Default for MockLhmClient {
    fn default() -> Self {
        Self::from_fixture()
    }
}

#[cfg(test)]
impl LhmReader for MockLhmClient {
    fn read(&mut self) -> Result<LhmCpuData, LhmClientError> {
        self.data
            .clone()
            .ok_or_else(|| LhmClientError::EmptyResponse)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn fixture_path_resolves_and_parses() {
        let path = lhm_fixture_path();
        assert!(path.is_file(), "expected fixture at {}", path.display());
        let raw = fs::read_to_string(&path).expect("read fixture");
        let resp = parse_response(&raw).expect("parse fixture");
        assert!(resp.ok);
        let cpu = parse_cpu_from_line(&raw).expect("cpu block");
        assert_eq!(cpu.name, "Intel Core i7-3770K");
    }

    #[test]
    fn dev_fallback_binary_path_when_bundled_missing() {
        let path = resolve_binary_path();
        #[cfg(debug_assertions)]
        {
            let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            if !manifest.join(BUNDLED_BINARY).is_file() {
                assert_eq!(path, manifest.join(DEV_BINARY));
            }
        }
    }

    #[test]
    fn mock_lhm_returns_fixture_values() {
        let mut client = MockLhmClient::from_fixture();
        let cpu = client.read().expect("mock read");
        assert_eq!(cpu.name, "Intel Core i7-3770K");
        assert_eq!(cpu.package_temp_c, Some(52.0));
        assert_eq!(cpu.package_power_w, Some(41.0));
        assert_eq!(cpu.cores.len(), 4);
        assert_eq!(cpu.cores[0].clock_mhz, Some(3900.0));
    }

    #[test]
    fn quit_line_matches_protocol() {
        assert_eq!(LhmReadCmd::quit_line(), "{\"cmd\":\"quit\"}\n");
        assert_eq!(LhmReadCmd::read_line(), "{\"cmd\":\"read\"}\n");
    }

    #[cfg(windows)]
    mod fake_child {
        use super::*;
        use std::fs;
        use std::sync::Mutex;

        static PS_TEST_LOCK: Mutex<()> = Mutex::new(());

        fn ps_test_lock() -> std::sync::MutexGuard<'static, ()> {
            PS_TEST_LOCK
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner)
        }

        fn fake_child_startup_delay() -> Duration {
            if std::env::var("GITHUB_ACTIONS").is_ok() {
                Duration::from_millis(1500)
            } else {
                Duration::from_millis(300)
            }
        }

        fn powershell_exe() -> PathBuf {
            std::env::var_os("SystemRoot")
                .map(|root| {
                    PathBuf::from(root)
                        .join("System32")
                        .join("WindowsPowerShell")
                        .join("v1.0")
                        .join("powershell.exe")
                })
                .filter(|p| p.is_file())
                .unwrap_or_else(|| PathBuf::from("powershell.exe"))
        }

        fn fake_sidecar_command() -> Command {
            use std::sync::atomic::{AtomicU32, Ordering};
            static SEQ: AtomicU32 = AtomicU32::new(0);
            let fixture_json = fs::read_to_string(lhm_fixture_path()).expect("fixture");
            let json_escaped = fixture_json.trim().replace('\'', "''");
            let script_path = std::env::temp_dir().join(format!(
                "pc_temp_lhm_fake_{}_{}.ps1",
                std::process::id(),
                SEQ.fetch_add(1, Ordering::Relaxed)
            ));
            let script = format!(
                "$json = '{json_escaped}'\n\
$reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput())\n\
$writer = [Console]::Out\n\
while ($null -ne ($line = $reader.ReadLine())) {{\n\
  if ($line -match 'quit') {{ break }}\n\
  if ($line -match 'read') {{ $writer.WriteLine($json); $writer.Flush() }}\n\
}}\n"
            );
            fs::write(&script_path, script).expect("write fake sidecar script");
            let mut cmd = Command::new(powershell_exe());
            cmd.args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                script_path
                    .to_str()
                    .expect("script path utf-8"),
            ]);
            cmd
        }

        #[test]
        fn fake_child_fixture_round_trip_quit_and_respawn() {
            let _lock = ps_test_lock();
            let mut child = LhmChild::spawn_command(fake_sidecar_command()).expect("spawn");
            std::thread::sleep(fake_child_startup_delay());
            let cpu = child.request_read().expect("read");
            assert_eq!(cpu.name, "Intel Core i7-3770K");
            child.send_quit();
            assert!(child.needs_respawn());
            drop(child);
            std::thread::sleep(Duration::from_millis(100));
            let mut replacement = LhmChild::spawn_command(fake_sidecar_command()).expect("respawn");
            std::thread::sleep(fake_child_startup_delay());
            let cpu2 = replacement.request_read().expect("read after respawn");
            assert_eq!(cpu2.package_temp_c, Some(52.0));
            replacement.send_quit();
        }

        #[test]
        fn timeout_marks_broken_then_respawns_without_panic() {
            let _lock = ps_test_lock();
            let script = "while ($null -ne ([Console]::In.ReadLine())) { Start-Sleep -Seconds 30 }";
            let mut cmd = Command::new(powershell_exe());
            cmd.args(["-NoProfile", "-NonInteractive", "-Command", script]);

            let mut client = LhmClient {
                binary: powershell_exe(),
                child: Some(LhmChild::spawn_command(cmd).expect("spawn")),
            };
            let err = client.read().expect_err("should time out");
            assert!(matches!(err, LhmClientError::Timeout(_)));
            let _ = client.read();
        }

        #[test]
        fn kill_on_job_close_terminates_child() {
            let _lock = ps_test_lock();
            let script = "Start-Sleep -Seconds 600";
            let mut cmd = Command::new("powershell");
            cmd.args(["-NoProfile", "-NonInteractive", "-Command", script]);
            let child = LhmChild::spawn_command(cmd).expect("spawn");
            let pid = child.child.id();
            drop(child);
            std::thread::sleep(Duration::from_millis(200));
            let mut open = true;
            for _ in 0..20 {
                if is_process_gone(pid) {
                    open = false;
                    break;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            assert!(!open, "expected child pid {pid} to exit when job closed");
        }

        #[cfg(windows)]
        fn is_process_gone(pid: u32) -> bool {
            use std::process::Command;
            let filter = format!("ProcessId = {pid}");
            let output = Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    &format!("if (Get-CimInstance Win32_Process -Filter '{filter}') {{ exit 1 }} else {{ exit 0 }}"),
                ])
                .output()
                .expect("query process");
            output.status.success()
        }
    }
}