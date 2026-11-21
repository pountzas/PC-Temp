mod layout;

use crate::ipc::commands::SettingsPatch;
use crate::ipc::events;
use crate::ipc::types::{Settings, ViewMode, WindowPosition};
use crate::settings;
use layout::{
    clamp_top_left, monitor_containing, settings_panel_origin, view_logical_size, view_patch,
    Rect, SETTINGS_GAP_PX, SETTINGS_HEIGHT_PX, SETTINGS_WIDTH_PX,
};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, Listener, LogicalPosition, LogicalSize, Manager, PhysicalPosition,
    Runtime, WebviewWindow, WindowEvent,
};

pub const WIDGET_LABEL: &str = "widget";
pub const SETTINGS_LABEL: &str = "settings";

static DOCKED: AtomicBool = AtomicBool::new(false);

struct PositionSaveState {
    generation: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SettingsWindowPayload {
    open: bool,
}

fn widget_window<R: Runtime>(app: &AppHandle<R>) -> Result<WebviewWindow<R>, String> {
    app.get_webview_window(WIDGET_LABEL)
        .ok_or_else(|| format!("missing {WIDGET_LABEL} window"))
}

fn settings_window<R: Runtime>(app: &AppHandle<R>) -> Result<WebviewWindow<R>, String> {
    app.get_webview_window(SETTINGS_LABEL)
        .ok_or_else(|| format!("missing {SETTINGS_LABEL} window"))
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

fn persist_position(position: WindowPosition) -> Result<(), String> {
    let mut patch = empty_settings_patch();
    patch.position = Some(Some(position));
    settings::update(patch).map(|_| ())
}

fn persist_view<R: Runtime>(app: &AppHandle<R>, view: ViewMode) -> Result<(), String> {
    let fields = view_patch(view);
    let mut patch = empty_settings_patch();
    patch.view = Some(fields.view);
    if let Some(undocked) = fields.last_undocked_view {
        patch.last_undocked_view = Some(undocked);
    }
    let updated = settings::update(patch)?;
    if let Err(e) = app.emit(events::SETTINGS_CHANGED, &updated) {
        log::warn!("emit settings-changed: {e}");
    }
    Ok(())
}

fn logical_outer_rect<R: Runtime>(
    window: &WebviewWindow<R>,
) -> Result<Rect, String> {
    let scale = window
        .scale_factor()
        .map_err(|e| format!("scale factor: {e}"))?;
    let pos = window
        .outer_position()
        .map_err(|e| format!("outer position: {e}"))?;
    let size = window
        .outer_size()
        .map_err(|e| format!("outer size: {e}"))?;
    let logical_pos = pos.to_logical::<f64>(scale);
    let logical_size = size.to_logical::<f64>(scale);
    Ok(Rect {
        x: logical_pos.x,
        y: logical_pos.y,
        width: logical_size.width,
        height: logical_size.height,
    })
}

fn work_area_rect<R: Runtime>(window: &WebviewWindow<R>) -> Result<Rect, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| format!("monitor: {e}"))?
        .or_else(|| window.primary_monitor().ok().flatten())
        .ok_or_else(|| "no monitor for window".to_string())?;
    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    let pos = work.position.to_logical::<f64>(scale);
    let size = work.size.to_logical::<f64>(scale);
    Ok(Rect {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
    })
}

fn set_logical_outer_position<R: Runtime>(
    window: &WebviewWindow<R>,
    x: f64,
    y: f64,
) -> Result<(), String> {
    window
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| format!("set position: {e}"))
}

/// Place a window using logical coords measured at `logical_scale` as physical screen pixels.
fn set_screen_physical_position<R: Runtime>(
    window: &WebviewWindow<R>,
    x_logical: f64,
    y_logical: f64,
    logical_scale: f64,
) -> Result<(), String> {
    let phys_x = (x_logical * logical_scale).round() as i32;
    let phys_y = (y_logical * logical_scale).round() as i32;
    window
        .set_position(PhysicalPosition::new(phys_x, phys_y))
        .map_err(|e| format!("set position: {e}"))
}

fn apply_view_size<R: Runtime>(
    window: &WebviewWindow<R>,
    view: ViewMode,
) -> Result<(), String> {
    let (w, h) = view_logical_size(view);
    window
        .set_size(LogicalSize::new(w, h))
        .map_err(|e| format!("set size: {e}"))
}

fn apply_view_with_anchor<R: Runtime>(app: &AppHandle<R>, view: ViewMode) -> Result<(), String> {
    let widget = widget_window(app)?;
    let anchor = widget
        .outer_position()
        .map_err(|e| format!("outer position: {e}"))?;
    let scale = widget
        .scale_factor()
        .map_err(|e| format!("scale factor: {e}"))?;
    let (w, h) = view_logical_size(view);
    apply_view_size(&widget, view)?;
    let logical = anchor.to_logical::<f64>(scale);
    let work = work_area_rect(&widget)?;
    let (x, y) = clamp_top_left((logical.x, logical.y), (w, h), work);
    set_logical_outer_position(&widget, x, y)?;
    persist_view(app, view)
}

fn physical_work_area_of(monitor: &tauri::Monitor) -> Rect {
    let work = monitor.work_area();
    Rect {
        x: work.position.x as f64,
        y: work.position.y as f64,
        width: work.size.width as f64,
        height: work.size.height as f64,
    }
}

fn restore_saved_position<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let s = settings::get();
    let Some(position) = s.position else {
        return Ok(());
    };
    let widget = widget_window(app)?;
    let monitors = widget
        .available_monitors()
        .map_err(|e| format!("monitors: {e}"))?;
    let areas: Vec<Rect> = monitors.iter().map(physical_work_area_of).collect();
    let (work, scale) = match monitor_containing((position.x, position.y), &areas) {
        Some(i) => (areas[i], monitors[i].scale_factor()),
        None => {
            let monitor = widget
                .primary_monitor()
                .map_err(|e| format!("primary monitor: {e}"))?
                .ok_or_else(|| "no primary monitor".to_string())?;
            (physical_work_area_of(&monitor), monitor.scale_factor())
        }
    };
    let (lw, lh) = view_logical_size(s.view);
    let (x, y) = clamp_top_left(
        (position.x, position.y),
        (lw * scale, lh * scale),
        work,
    );
    widget
        .set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32))
        .map_err(|e| format!("set position: {e}"))
}

fn schedule_position_save<R: Runtime>(
    app: AppHandle<R>,
    state: Arc<Mutex<PositionSaveState>>,
) {
    let generation = {
        let mut guard = state.lock().expect("position save lock");
        guard.generation = guard.generation.saturating_add(1);
        guard.generation
    };
    let app_clone = app.clone();
    let state_clone = state.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(500)).await;
        let still_current = state_clone
            .lock()
            .map(|g| g.generation == generation)
            .unwrap_or(false);
        if !still_current || DOCKED.load(Ordering::Relaxed) {
            return;
        }
        let Ok(widget) = widget_window(&app_clone) else {
            return;
        };
        let Ok(pos) = widget.outer_position() else {
            return;
        };
        let _ = persist_position(WindowPosition {
            x: pos.x as f64,
            y: pos.y as f64,
        });
    });
}

fn apply_settings_to_widget<R: Runtime>(app: &AppHandle<R>, s: &Settings) -> Result<(), String> {
    let top = apply_always_on_top(app, s.always_on_top);
    let click = apply_click_through(app, s.click_through);
    top.and(click)
}

pub fn init<R: Runtime>(app: &AppHandle<R>) {
    let settings_snapshot = settings::get();
    if let Ok(widget) = widget_window(app) {
        if let Err(e) = apply_view_size(&widget, settings_snapshot.view) {
            log::warn!("initial view size: {e}");
        }
    } else {
        log::warn!("widget window missing during init");
    }
    if let Err(e) = restore_saved_position(app) {
        log::warn!("restore position: {e}");
    }
    if let Err(e) = apply_settings_to_widget(app, &settings_snapshot) {
        log::warn!("apply settings: {e}");
    }

    let save_state = Arc::new(Mutex::new(PositionSaveState { generation: 0 }));
    if let Ok(widget) = widget_window(app) {
        let app_moved = app.clone();
        let save_state_moved = save_state.clone();
        let _ = widget.on_window_event(move |event| {
            if let WindowEvent::Moved(PhysicalPosition { x, y }) = event {
                let _ = (x, y);
                if !DOCKED.load(Ordering::Relaxed) {
                    schedule_position_save(app_moved.clone(), save_state_moved.clone());
                }
            }
        });
    }

    if let Ok(settings_win) = settings_window(app) {
        let app_close = app.clone();
        let _ = settings_win.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Err(e) = close_settings(&app_close) {
                    log::warn!("hide settings on close: {e}");
                }
            }
        });
    }

    let app_settings = app.clone();
    let _ = app_settings
        .clone()
        .listen(events::SETTINGS_CHANGED, move |event| {
            let payload = event.payload();
            match serde_json::from_str::<Settings>(payload) {
                Ok(updated) => {
                    if let Err(e) = apply_settings_to_widget(&app_settings, &updated) {
                        log::warn!("settings-changed apply: {e}");
                    }
                }
                Err(e) => log::warn!("settings-changed parse: {e}"),
            }
        });
}

pub fn set_view<R: Runtime>(app: &AppHandle<R>, view: ViewMode) -> Result<(), String> {
    apply_view_with_anchor(app, view)
}

pub fn apply_always_on_top<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> Result<(), String> {
    let widget = widget_window(app)?;
    widget
        .set_always_on_top(enabled)
        .map_err(|e| format!("set_always_on_top: {e}"))
}

pub fn apply_click_through<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> Result<(), String> {
    let widget = widget_window(app)?;
    widget
        .set_ignore_cursor_events(enabled)
        .map_err(|e| format!("set_ignore_cursor_events: {e}"))
}

pub fn open_settings<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let widget = widget_window(app)?;
    let settings_win = settings_window(app)?;
    let widget_rect = logical_outer_rect(&widget)?;
    let work = work_area_rect(&widget)?;
    let widget_scale = widget
        .scale_factor()
        .map_err(|e| format!("widget scale: {e}"))?;
    let (x, y) = settings_panel_origin(
        widget_rect,
        SETTINGS_WIDTH_PX,
        SETTINGS_HEIGHT_PX,
        SETTINGS_GAP_PX,
        work,
    );
    set_screen_physical_position(&settings_win, x, y, widget_scale)?;
    settings_win
        .show()
        .map_err(|e| format!("show settings: {e}"))?;
    settings_win
        .set_focus()
        .map_err(|e| format!("focus settings: {e}"))?;
    app.emit(
        events::SETTINGS_WINDOW,
        SettingsWindowPayload { open: true },
    )
    .map_err(|e| format!("emit settings-window: {e}"))?;
    Ok(())
}

pub fn close_settings<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let settings_win = settings_window(app)?;
    settings_win
        .hide()
        .map_err(|e| format!("hide settings: {e}"))?;
    app.emit(
        events::SETTINGS_WINDOW,
        SettingsWindowPayload { open: false },
    )
    .map_err(|e| format!("emit settings-window: {e}"))?;
    Ok(())
}

pub fn hide_widget<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let widget = widget_window(app)?;
    widget.hide().map_err(|e| format!("hide widget: {e}"))
}

#[allow(dead_code)]
pub fn set_docked(docked: bool) {
    DOCKED.store(docked, Ordering::Relaxed);
}