mod autostart;
pub mod config;
mod ipc;
mod sensors;
mod settings;
mod state;
mod tray;
mod window;

#[cfg(any(test, debug_assertions))]
pub mod integration_test;

use ipc::commands::{
    close_settings, get_autostart, get_settings, get_snapshot, open_settings, quit_app,
    set_click_through, set_view, update_settings,
};
use state::{AppState, PollerHandle, PollerMsg};
use std::sync::{Arc, RwLock};
use tauri::Manager;
use tokio::sync::mpsc;

fn base_builder() -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
}

#[cfg(all(debug_assertions, feature = "mcp-bridge"))]
fn with_optional_mcp_bridge(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.plugin(
        tauri_plugin_mcp_bridge::Builder::new()
            .bind_address("127.0.0.1")
            .build(),
    )
}

#[cfg(not(all(debug_assertions, feature = "mcp-bridge")))]
fn with_optional_mcp_bridge(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    sensors::gpu::restrict_dll_search_directories();

    with_optional_mcp_bridge(base_builder())
        .setup(|app| {
            settings::init(app.handle());
            window::init(app.handle());
            tray::init(app);

            let cpu = sensors::cpu::create();
            let gpu = sensors::gpu::create();

            let (tx, rx) = mpsc::channel::<PollerMsg>(8);
            let state = Arc::new(AppState {
                poller: PollerHandle { tx },
                last_tick: RwLock::new(None),
            });

            sensors::poller::spawn(app.handle().clone(), state.clone(), cpu, gpu, rx);
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            get_settings,
            update_settings,
            set_view,
            open_settings,
            close_settings,
            set_click_through,
            get_autostart,
            quit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod file_logger_packaging {
    use std::path::PathBuf;
    use std::process::Command;

    fn manifest_path() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml")
    }

    #[test]
    fn dependency_tree_includes_tauri_plugin_log() {
        let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".into());
        let output = Command::new(cargo)
            .args([
                "tree",
                "--locked",
                "--manifest-path",
                manifest_path().to_str().expect("utf-8 path"),
                "--package",
                "pc-temp",
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
            tree.contains("tauri-plugin-log"),
            "pc-temp must depend on tauri-plugin-log for on-disk Rust logs:\n{tree}"
        );
    }

    #[test]
    fn manifest_declares_tauri_plugin_log() {
        let manifest = std::fs::read_to_string(manifest_path()).expect("read Cargo.toml");
        assert!(
            manifest.contains("tauri-plugin-log"),
            "Cargo.toml must declare tauri-plugin-log"
        );
    }
}
