mod actions;

use crate::ipc::commands::SettingsPatch;
use crate::ipc::events;
use crate::ipc::types::Settings;
use crate::settings;
use crate::window;
use actions::{
    is_tray_owned_menu_id, show_hide_menu_text, toggle_click_through, ID_CLICK_THROUGH, ID_QUIT,
    ID_SETTINGS, ID_SHOW_HIDE, MENU_ORDER,
};
use std::sync::Arc;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Emitter, Listener, Manager, Wry};

struct TrayMenuState {
    show_hide: MenuItem<Wry>,
    click_through: CheckMenuItem<Wry>,
}

fn empty_settings_patch() -> SettingsPatch {
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

fn widget_is_visible(app: &AppHandle) -> bool {
    app.get_webview_window("widget")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false)
}

fn show_and_focus_widget(app: &AppHandle) -> Result<(), String> {
    let widget = app
        .get_webview_window("widget")
        .ok_or_else(|| "widget window missing".to_string())?;
    widget.show().map_err(|e| e.to_string())?;
    widget.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

fn sync_show_hide_label(app: &AppHandle, state: &TrayMenuState) {
    let label = show_hide_menu_text(widget_is_visible(app));
    if let Err(e) = state.show_hide.set_text(label) {
        log::warn!("tray show/hide label sync failed: {e}");
    }
}

fn sync_click_through_check(state: &TrayMenuState, enabled: bool) {
    if let Err(e) = state.click_through.set_checked(enabled) {
        log::warn!("tray click-through check sync failed: {e}");
    }
}

fn commit_click_through_setting(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let mut patch = empty_settings_patch();
    patch.click_through = Some(enabled);
    let updated = settings::update(patch)?;
    if let Err(e) = app.emit(events::SETTINGS_CHANGED, &updated) {
        log::warn!("emit settings-changed failed: {e}");
    }
    Ok(())
}

fn apply_click_through_setting(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let current = settings::get().click_through;
    if enabled != current {
        toggle_click_through(
            current,
            |next| window::apply_click_through(app, next),
            |next| commit_click_through_setting(app, next),
        )
        .map(|_| ())
    } else {
        window::apply_click_through(app, enabled)?;
        commit_click_through_setting(app, enabled)
    }
}

fn handle_menu_event(app: &AppHandle, id: &str) {
    if !is_tray_owned_menu_id(id) {
        return;
    }

    let state = match app.try_state::<Arc<TrayMenuState>>() {
        Some(state) => state,
        None => {
            log::error!("tray menu state missing");
            return;
        }
    };

    match id {
        ID_SHOW_HIDE => {
            let result = if widget_is_visible(app) {
                window::hide_widget(app).map(|_| {
                    sync_show_hide_label(app, &state);
                })
            } else {
                show_and_focus_widget(app).map(|_| {
                    sync_show_hide_label(app, &state);
                })
            };
            if let Err(e) = result {
                log::warn!("tray show/hide failed: {e}");
            }
        }
        ID_CLICK_THROUGH => {
            let enabled = !settings::get().click_through;
            if let Err(e) = apply_click_through_setting(app, enabled) {
                log::warn!("tray click-through update failed: {e}");
            }
            sync_click_through_check(&state, settings::get().click_through);
        }
        ID_SETTINGS => {
            if let Err(e) = window::open_settings(app) {
                log::warn!("tray open settings failed: {e}");
            }
        }
        ID_QUIT => app.exit(0),
        _ => {}
    }
}

fn handle_tray_click(app: &AppHandle, event: &TrayIconEvent) {
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    {
        if let Err(e) = show_and_focus_widget(app) {
            log::warn!("tray left-click show/focus failed: {e}");
        } else if let Some(state) = app.try_state::<Arc<TrayMenuState>>() {
            sync_show_hide_label(app, &state);
        }
    }
}

fn listen_for_settings_changes(app: &AppHandle) {
    let app_handle = app.clone();
    let _ = app.listen(events::SETTINGS_CHANGED, move |event| {
        let Ok(settings) = serde_json::from_str::<Settings>(event.payload()) else {
            log::warn!("tray settings-changed payload invalid");
            return;
        };
        if let Some(state) = app_handle.try_state::<Arc<TrayMenuState>>() {
            sync_click_through_check(&state, settings.click_through);
            sync_show_hide_label(&app_handle, &state);
        }
    });
}

pub fn init(app: &App) {
    let handle = app.handle();
    let initial = settings::get();
    let initial_visible = widget_is_visible(handle);

    let show_hide = match MenuItem::with_id(
        app,
        ID_SHOW_HIDE,
        show_hide_menu_text(initial_visible),
        true,
        None::<&str>,
    ) {
        Ok(item) => item,
        Err(e) => {
            log::error!("tray show/hide item failed: {e}");
            return;
        }
    };

    let click_through = match CheckMenuItem::with_id(
        app,
        ID_CLICK_THROUGH,
        "Click-through",
        true,
        initial.click_through,
        None::<&str>,
    ) {
        Ok(item) => item,
        Err(e) => {
            log::error!("tray click-through item failed: {e}");
            return;
        }
    };

    let settings_item = match MenuItem::with_id(app, ID_SETTINGS, "Settings…", true, None::<&str>)
    {
        Ok(item) => item,
        Err(e) => {
            log::error!("tray settings item failed: {e}");
            return;
        }
    };

    let quit = match MenuItem::with_id(app, ID_QUIT, "Quit", true, None::<&str>) {
        Ok(item) => item,
        Err(e) => {
            log::error!("tray quit item failed: {e}");
            return;
        }
    };

    debug_assert_eq!(
        MENU_ORDER,
        [ID_SHOW_HIDE, ID_CLICK_THROUGH, ID_SETTINGS, ID_QUIT]
    );
    let menu = match Menu::with_items(app, &[&show_hide, &click_through, &settings_item, &quit]) {
        Ok(menu) => menu,
        Err(e) => {
            log::error!("tray menu failed: {e}");
            return;
        }
    };

    app.manage(Arc::new(TrayMenuState {
        show_hide,
        click_through,
    }));

    let icon: Image = match app.default_window_icon() {
        Some(icon) => icon.clone(),
        None => {
            log::error!("tray icon missing: no default window icon");
            return;
        }
    };

    if let Err(e) = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("PC-Temp")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| handle_menu_event(app, event.id.as_ref()))
        .on_tray_icon_event(|tray, event| handle_tray_click(tray.app_handle(), &event))
        .build(app)
    {
        log::error!("tray icon build failed: {e}");
        return;
    }

    listen_for_settings_changes(handle);
}
