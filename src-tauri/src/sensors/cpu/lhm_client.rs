//! Spawns and talks to the `lhm-reader` JSON-lines sidecar (HW-05).

use crate::ipc::lhm_protocol::{parse_response, LhmReadCmd, LhmResponse};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::mpsc;
use std::time::Duration;

const READ_TIMEOUT: Duration = Duration::from_secs(5);
const DEV_BINARY: &str = "binaries/lhm-reader-x86_64-pc-windows-msvc.exe";
const BUNDLED_BINARY: &str = "lhm-reader.exe";

#[derive(Debug, thiserror::Error)]
pub enum LhmClientError {
    #[error("failed to spawn lhm-reader: {0}")]
    Spawn(#[from] std::io::Error),
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
}

/// Resolves the sidecar executable: bundled next to the host exe, else the dev binary under `src-tauri/binaries/`.
pub fn resolve_binary_path() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let bundled = dir.join(BUNDLED_BINARY);
            if bundled.is_file() {
                return bundled;
            }
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(DEV_BINARY)
}

pub fn lhm_fixture_path() -> PathBuf {
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
            resp.error.clone().unwrap_or_else(|| "unknown error".into()),
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

struct LhmChild {
    child: Child,
    stdin: ChildStdin,
    stdout: Option<ChildStdout>,
}

impl LhmChild {
    fn spawn(binary: &Path) -> Result<Self, LhmClientError> {
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

        let mut child = cmd.spawn()?;
        let stdin = child.stdin.take().expect("piped stdin");
        let stdout = child.stdout.take().expect("piped stdout");
        Ok(Self {
            child,
            stdin,
            stdout: Some(stdout),
        })
    }

    fn request_read(&mut self) -> Result<LhmCpuData, LhmClientError> {
        self.stdin
            .write_all(LhmReadCmd::read_line().as_bytes())?;
        self.stdin.flush()?;
        let line = read_stdout_line(&mut self.stdout, READ_TIMEOUT)?;
        let resp = parse_response(&line)?;
        parse_cpu_data(&resp, &line)
    }

    fn send_quit(&mut self) {
        let _ = self.stdin.write_all(LhmReadCmd::quit_line().as_bytes());
        let _ = self.stdin.flush();
        let _ = self.child.wait();
    }
}

fn read_stdout_line(
    stdout: &mut Option<ChildStdout>,
    timeout: Duration,
) -> Result<String, LhmClientError> {
    let pipe = stdout.take().expect("stdout handle");
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut reader = BufReader::new(pipe);
        let mut line = String::new();
        let result = match reader.read_line(&mut line) {
            Ok(0) => Err(LhmClientError::EmptyResponse),
            Ok(_) => Ok((line, reader.into_inner())),
            Err(err) => Err(LhmClientError::Spawn(err)),
        };
        let _ = tx.send(result);
    });

    match rx.recv_timeout(timeout) {
        Ok(Ok((line, pipe))) => {
            *stdout = Some(pipe);
            Ok(line)
        }
        Ok(Err(err)) => Err(err),
        Err(mpsc::RecvTimeoutError::Timeout) => Err(LhmClientError::Timeout(timeout)),
        Err(mpsc::RecvTimeoutError::Disconnected) => Err(LhmClientError::EmptyResponse),
    }
}

pub struct LhmClient {
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
                child: Some(child),
            }),
            Err(err) => {
                log::warn!("failed to spawn lhm-reader: {err}");
                None
            }
        }
    }

    fn respawn_if_needed(&mut self) {
        let Some(child) = self.child.as_mut() else {
            return;
        };
        if child.child.try_wait().ok().flatten().is_some() {
            let path = resolve_binary_path();
            if path.is_file() {
                if let Ok(replacement) = LhmChild::spawn(&path) {
                    *child = replacement;
                }
            }
        }
    }
}

impl LhmReader for LhmClient {
    fn read(&mut self) -> Result<LhmCpuData, LhmClientError> {
        self.respawn_if_needed();
        self.child
            .as_mut()
            .expect("LhmClient used after drop")
            .request_read()
    }
}

impl Drop for LhmClient {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.take() {
            child.send_quit();
        }
    }
}

/// Test/dev reader that serves the recorded `lhm_read.json` fixture (no child process).
pub struct MockLhmClient;

impl MockLhmClient {
    pub fn new() -> Self {
        Self
    }
}

impl Default for MockLhmClient {
    fn default() -> Self {
        Self::new()
    }
}

impl LhmReader for MockLhmClient {
    fn read(&mut self) -> Result<LhmCpuData, LhmClientError> {
        let raw = std::fs::read_to_string(lhm_fixture_path())?;
        parse_cpu_from_line(&raw)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fixture_path_resolves_and_parses() {
        let path = lhm_fixture_path();
        assert!(
            path.is_file(),
            "expected fixture at {}",
            path.display()
        );
        let raw = std::fs::read_to_string(&path).expect("read fixture");
        let resp = parse_response(&raw).expect("parse fixture");
        assert!(resp.ok);
        let cpu = resp.cpu.expect("cpu block");
        assert_eq!(cpu.name, "Intel Core i7-3770K");
    }

    #[test]
    fn dev_fallback_binary_path_when_bundled_missing() {
        let path = resolve_binary_path();
        assert!(path.ends_with(DEV_BINARY) || path.ends_with(BUNDLED_BINARY));
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        if !manifest.join(BUNDLED_BINARY).is_file() {
            assert_eq!(path, manifest.join(DEV_BINARY));
        }
    }

    #[test]
    fn mock_lhm_returns_fixture_values() {
        let mut client = MockLhmClient::new();
        let cpu = client.read().expect("mock read");
        assert_eq!(cpu.name, "Intel Core i7-3770K");
        assert_eq!(cpu.package_temp_c, Some(52.0));
        assert_eq!(cpu.package_power_w, Some(41.0));
        assert_eq!(cpu.cores.len(), 4);
        assert_eq!(cpu.cores[0].index, 0);
        assert_eq!(cpu.cores[0].temp_c, Some(50.0));
        assert_eq!(cpu.cores[0].clock_mhz, Some(3900.0));
        assert_eq!(cpu.cores[3].temp_c, Some(52.0));
    }

    #[test]
    fn quit_line_matches_protocol() {
        assert_eq!(LhmReadCmd::quit_line(), "{\"cmd\":\"quit\"}\n");
        assert_eq!(LhmReadCmd::read_line(), "{\"cmd\":\"read\"}\n");
    }
}