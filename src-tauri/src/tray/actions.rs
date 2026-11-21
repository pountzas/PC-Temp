//! Tray menu labels and menu-item ids (testable without the Tauri runtime).

pub const ID_SHOW_HIDE: &str = "tray-show-hide";
pub const ID_CLICK_THROUGH: &str = "tray-click-through";
pub const ID_SETTINGS: &str = "tray-settings";
pub const ID_QUIT: &str = "tray-quit";

pub fn show_hide_menu_text(widget_visible: bool) -> &'static str {
    if widget_visible {
        "Hide widget"
    } else {
        "Show widget"
    }
}

pub fn is_tray_owned_menu_id(id: &str) -> bool {
    matches!(
        id,
        ID_SHOW_HIDE | ID_CLICK_THROUGH | ID_SETTINGS | ID_QUIT
    )
}

#[cfg(test)]
mod tests {
    use super::*;

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
}