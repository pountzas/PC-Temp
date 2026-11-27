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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    sensors::gpu::restrict_dll_search_directories();
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
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
