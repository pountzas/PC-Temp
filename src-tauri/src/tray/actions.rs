//! Tray menu labels and menu-item ids (testable without the Tauri runtime).

pub const ID_SHOW_HIDE: &str = "tray-show-hide";
pub const ID_CLICK_THROUGH: &str = "tray-click-through";
pub const ID_SETTINGS: &str = "tray-settings";
pub const ID_QUIT: &str = "tray-quit";

pub const MENU_ORDER: [&str; 4] = [ID_SHOW_HIDE, ID_CLICK_THROUGH, ID_SETTINGS, ID_QUIT];

pub fn show_hide_menu_text(widget_visible: bool) -> &'static str {
    if widget_visible {
        "Hide widget"
    } else {
        "Show widget"
    }
}

pub fn is_tray_owned_menu_id(id: &str) -> bool {
    MENU_ORDER.contains(&id)
}

/// Apply the toggled click-through value: window first, persist only after window succeeds.
pub fn toggle_click_through<A, C>(current: bool, apply_window: A, commit: C) -> Result<bool, String>
where
    A: FnOnce(bool) -> Result<(), String>,
    C: FnOnce(bool) -> Result<(), String>,
{
    let enabled = !current;
    apply_window(enabled)?;
    commit(enabled)?;
    Ok(enabled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    #[test]
    fn show_hide_label_reflects_visibility() {
        assert_eq!(show_hide_menu_text(true), "Hide widget");
        assert_eq!(show_hide_menu_text(false), "Show widget");
    }

    #[test]
    fn recognizes_tray_menu_ids() {
        assert!(is_tray_owned_menu_id(ID_QUIT));
        assert!(!is_tray_owned_menu_id("quit"));
        assert!(!is_tray_owned_menu_id(""));
    }

    #[test]
    fn menu_order_matches_spec() {
        assert_eq!(
            MENU_ORDER,
            [
                "tray-show-hide",
                "tray-click-through",
                "tray-settings",
                "tray-quit"
            ]
        );
    }

    #[test]
    fn toggle_turns_click_through_off_when_on() {
        let applied = Cell::new(None::<bool>);
        let committed = Cell::new(None::<bool>);

        let result = toggle_click_through(
            true,
            |enabled| {
                applied.set(Some(enabled));
                Ok(())
            },
            |enabled| {
                committed.set(Some(enabled));
                Ok(())
            },
        )
        .expect("toggle");

        assert!(!result);
        assert_eq!(applied.get(), Some(false));
        assert_eq!(committed.get(), Some(false));
    }

    #[test]
    fn toggle_does_not_commit_when_window_apply_fails() {
        let committed = Cell::new(false);

        let err = toggle_click_through(
            true,
            |_| Err("window apply failed".to_string()),
            |_| {
                committed.set(true);
                Ok(())
            },
        )
        .expect_err("window apply must fail first");

        assert_eq!(err, "window apply failed");
        assert!(!committed.get());
    }
}
