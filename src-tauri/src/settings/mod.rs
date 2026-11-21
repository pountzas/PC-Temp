mod persist;

use crate::ipc::commands::SettingsPatch;
use crate::ipc::types::Settings;
use persist::{hydrate_settings, sanitize_for_startup, settings_to_json, STORE_KEY, STORE_PATH};
use std::sync::{OnceLock, RwLock};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

static SETTINGS: OnceLock<RwLock<Settings>> = OnceLock::new();
static APP: OnceLock<AppHandle> = OnceLock::new();

fn memory() -> &'static RwLock<Settings> {
    SETTINGS.get_or_init(|| RwLock::new(Settings::default_v1()))
}

fn save_to_store(settings: &Settings) -> Result<(), String> {
    let Some(app) = APP.get() else {
        return Ok(());
    };
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("open settings store: {e}"))?;
    store.set(STORE_KEY, settings_to_json(settings));
    Ok(())
}

fn load_from_store(app: &AppHandle) -> (Settings, bool) {
    let store = match app.store(STORE_PATH) {
        Ok(store) => store,
        Err(e) => {
            log::warn!("settings store open failed: {e}");
            return (Settings::default_v1(), true);
        }
    };
    let first_run = !store.has(STORE_KEY);
    let settings = match store.get(STORE_KEY) {
        Some(value) => hydrate_settings(value),
        None => Settings::default_v1(),
    };
    (settings, first_run)
}

fn apply_startup_side_effects(app: &AppHandle, settings: &Settings) {
    if let Err(e) = crate::window::apply_always_on_top(app, settings.always_on_top) {
        log::warn!("apply always_on_top: {e}");
    }
    if let Err(e) = crate::window::apply_click_through(app, settings.click_through) {
        log::warn!("apply click_through: {e}");
    }
}

fn apply_patch_side_effects(app: &AppHandle, apply_aot: bool, apply_ct: bool, updated: &Settings) {
    if apply_aot {
        if let Err(e) = crate::window::apply_always_on_top(app, updated.always_on_top) {
            log::warn!("apply always_on_top: {e}");
        }
    }
    if apply_ct {
        if let Err(e) = crate::window::apply_click_through(app, updated.click_through) {
            log::warn!("apply click_through: {e}");
        }
    }
}

fn sync_autostart_on_first_run(settings: &mut Settings) {
    match crate::autostart::set_enabled(true) {
        Ok(()) => settings.start_with_windows = true,
        Err(e) => {
            log::error!("first-run autostart enable failed: {e}");
            settings.start_with_windows = false;
        }
    }
}

pub fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
    let (mut loaded, first_run) = load_from_store(app);
    if first_run {
        sync_autostart_on_first_run(&mut loaded);
    }
    loaded = sanitize_for_startup(loaded);
    if !first_run {
        loaded.start_with_windows = crate::autostart::is_enabled();
    }

    {
        let mut guard = memory()
            .write()
            .unwrap_or_else(|e| e.into_inner());
        *guard = loaded.clone();
    }

    apply_startup_side_effects(app, &loaded);

    if first_run {
        if let Err(e) = save_to_store(&loaded) {
            log::warn!("persist first-run settings: {e}");
        }
    } else if let Err(e) = save_to_store(&loaded) {
        log::warn!("persist sanitized settings: {e}");
    }

    log::info!("settings::init first_run={first_run}");
}

pub fn get() -> Settings {
    let mut settings = memory()
        .read()
        .map(|guard| guard.clone())
        .unwrap_or_else(|_| Settings::default_v1());
    settings.start_with_windows = crate::autostart::is_enabled();
    settings
}

pub fn update(patch: SettingsPatch) -> Result<Settings, String> {
    let apply_aot = patch.always_on_top.is_some();
    let apply_ct = patch.click_through.is_some();

    let mut guard = memory()
        .write()
        .map_err(|_| "settings lock poisoned".to_string())?;

    if let Some(start_with_windows) = patch.start_with_windows {
        crate::autostart::set_enabled(start_with_windows)?;
        guard.start_with_windows = crate::autostart::is_enabled();
    }
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
        guard.position = position;
    }

    let updated = guard.clone();
    save_to_store(&updated)?;

    if let Some(app) = APP.get() {
        apply_patch_side_effects(app, apply_aot, apply_ct, &updated);
    }

    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ipc::types::WindowPosition;

    fn empty_patch() -> SettingsPatch {
        SettingsPatch {
            opacity_pct: None,
            click_through: None,
            always_on_top: None,
            units: None,
            interval_ms: None,
            start_with_windows: None,
            accent: None,
            view: None,
            last_undocked_view: None,
            position: None,
        }
    }

    #[test]
    fn position_patch_clears_on_null_and_keeps_on_omitted() {
        let _ = memory();
        {
            let mut guard = memory().write().expect("lock");
            guard.position = Some(WindowPosition { x: 10.0, y: 20.0 });
        }

        let unchanged = update(empty_patch()).expect("empty patch");
        assert_eq!(
            unchanged.position,
            Some(WindowPosition { x: 10.0, y: 20.0 })
        );

        let mut clear_patch = empty_patch();
        clear_patch.position = Some(None);
        let cleared = update(clear_patch).expect("clear patch");
        assert!(cleared.position.is_none());
    }

    #[test]
    fn update_persists_interval_to_json_round_trip() {
        let _ = memory();
        let mut patch = empty_patch();
        patch.interval_ms = Some(5000);
        let updated = update(patch).expect("update");
        assert_eq!(updated.interval_ms, 5000);
        let json = settings_to_json(&updated);
        let reloaded = hydrate_settings(json);
        assert_eq!(reloaded.interval_ms, 5000);
    }
}