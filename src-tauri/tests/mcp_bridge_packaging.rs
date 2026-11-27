//! Release profile must not pull in the MCP bridge crate (issue #76).

use std::path::PathBuf;
use std::process::Command;

fn manifest_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml")
}

#[test]
fn release_dependency_tree_omits_mcp_bridge_plugin() {
    let output = Command::new("cargo")
        .args([
            "tree",
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

#[test]
fn lib_rs_registers_mcp_bridge_only_for_debug_feature_on_localhost() {
    let lib_rs = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/lib.rs");
    let source = std::fs::read_to_string(lib_rs).expect("read lib.rs");

    assert!(
        source.contains(r#"bind_address("127.0.0.1")"#),
        "MCP bridge must bind to loopback only"
    );
    assert!(
        source.contains(r#"#[cfg(all(debug_assertions, feature = "mcp-bridge"))]"#),
        "plugin registration must be cfg-gated"
    );
}
