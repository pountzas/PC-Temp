use crate::ipc::commands::SettingsPatch;
use crate::ipc::types::Settings;
use std::sync::{OnceLock, RwLock};

static SETTINGS: OnceLock<RwLock<Settings>> = OnceLock::new();

fn store() -> &'static RwLock<Settings> {
    SETTINGS.get_or_init(|| RwLock::new(Settings::default_v1()))
}

pub fn init() {
    let _ = store();
    log::info!("settings::init");
}

pub fn get() -> Settings {
    store()
        .read()
        .map(|guard| guard.clone())
        .unwrap_or_else(|_| Settings::default_v1())
}

pub fn update(patch: SettingsPatch) -> Result<Settings, String> {
    let mut guard = store()
        .write()
        .map_err(|_| "settings lock poisoned".to_string())?;
    if let Some(opacity_pct) = patch.opacity_pct {
        guard.opacity_pct = opacity_pct;
    }
    if let Some(click_through) = patch.click_through {
        guard.click_through = click_through;
    }
    if let Some(always_on_top) = patch.always_on_top {
        guard.always_on_top = always_on_top;
    }
    if let Some(units) = patch.units {
        guard.units = units;
    }
    if let Some(interval_ms) = patch.interval_ms {
        guard.interval_ms = interval_ms;
    }
    if let Some(start_with_windows) = patch.start_with_windows {
        guard.start_with_windows = start_with_windows;
    }
    if let Some(accent) = patch.accent {
        guard.accent = accent;
    }
    if let Some(view) = patch.view {
        guard.view = view;
    }
    if let Some(last_undocked_view) = patch.last_undocked_view {
        guard.last_undocked_view = last_undocked_view;
    }
    if let Some(position) = patch.position {
        guard.position = Some(position);
    }
    Ok(guard.clone())
}