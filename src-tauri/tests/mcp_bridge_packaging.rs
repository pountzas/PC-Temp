//! Release profile must not pull in the MCP bridge crate (issue #76).

use std::path::PathBuf;
use std::process::Command;

fn manifest_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml")
}

#[test]
fn release_dependency_tree_omits_mcp_bridge_plugin() {
    let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".into());
    let output = Command::new(cargo)
        .args([
            "tree",
            "--locked",
            "--manifest-path",
            manifest_path().to_str().expect("utf-8 path"),
            "--package",
            "pc-temp",
            "--format",
            "no-dedupe",
        ])
        .output()
        .expect("cargo tree");

    assert!(
        output.status.success(),
        "cargo tree failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let tree = String::from_utf8_lossy(&output.stdout);
    assert!(
        !tree.contains("tauri-plugin-mcp-bridge"),
        "release tree must not include tauri-plugin-mcp-bridge:\n{tree}"
    );
}