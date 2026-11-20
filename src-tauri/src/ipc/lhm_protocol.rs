//! JSON-lines protocol for the LibreHardwareMonitor sidecar (HW-05).

use crate::sensors::source::LhmCpuResponse;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct LhmReadCmd {
    pub cmd: &'static str,
}

impl LhmReadCmd {
    pub fn read_line() -> String {
        serde_json::to_string(&Self { cmd: "read" }).expect("serialize read cmd") + "\n"
    }

    pub fn quit_line() -> String {
        serde_json::to_string(&Self { cmd: "quit" }).expect("serialize quit cmd") + "\n"
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LhmResponse {
    pub ok: bool,
    #[serde(default)]
    pub cpu: Option<LhmCpuResponse>,
    pub error: Option<String>,
}

pub fn parse_response(line: &str) -> Result<LhmResponse, serde_json::Error> {
    serde_json::from_str(line.trim())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn fixture_path(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("repo root")
            .join("src-tauri/src/ipc/fixtures")
            .join(name)
    }

    #[test]
    fn reads_recorded_lhm_fixture() {
        let raw = fs::read_to_string(fixture_path("lhm_read.json")).expect("fixture");
        let resp = parse_response(&raw).expect("parse");
        assert!(resp.ok);
        assert!(resp.cpu.is_some());
    }
}