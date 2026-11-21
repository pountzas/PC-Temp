use crate::ipc::types::{UndockedView, ViewMode};

pub const SETTINGS_GAP_PX: f64 = 12.0;
pub const SETTINGS_WIDTH_PX: f64 = 320.0;
pub const SETTINGS_HEIGHT_PX: f64 = 358.0;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Rect {
    pub fn right(&self) -> f64 {
        self.x + self.width
    }

    pub fn bottom(&self) -> f64 {
        self.y + self.height
    }
}

pub fn view_logical_size(view: ViewMode) -> (f64, f64) {
    match view {
        ViewMode::Compact => (320.0, 200.0),
        ViewMode::Expanded => (420.0, 540.0),
        ViewMode::Pill => (220.0, 44.0),
    }
}

pub fn undocked_view_for(view: ViewMode) -> Option<UndockedView> {
    match view {
        ViewMode::Compact => Some(UndockedView::Compact),
        ViewMode::Expanded => Some(UndockedView::Expanded),
        ViewMode::Pill => None,
    }
}

pub fn clamp_top_left(pos: (f64, f64), size: (f64, f64), work: Rect) -> (f64, f64) {
    let (mut x, mut y) = pos;
    let (w, h) = size;
    let min_x = work.x;
    let min_y = work.y;
    let max_x = work.right() - w;
    let max_y = work.bottom() - h;
    if max_x < min_x {
        x = min_x;
    } else {
        x = x.clamp(min_x, max_x);
    }
    if max_y < min_y {
        y = min_y;
    } else {
        y = y.clamp(min_y, max_y);
    }
    (x, y)
}

pub fn settings_panel_origin(
    widget: Rect,
    settings_width: f64,
    settings_height: f64,
    gap: f64,
    work: Rect,
) -> (f64, f64) {
    let right_x = widget.right() + gap;
    let fits_right = right_x + settings_width <= work.right();
    let x = if fits_right {
        right_x
    } else {
        widget.x - gap - settings_width
    };
    clamp_top_left(
        (x, widget.y),
        (settings_width, settings_height),
        work,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn view_sizes_match_spec() {
        assert_eq!(view_logical_size(ViewMode::Compact), (320.0, 200.0));
        assert_eq!(view_logical_size(ViewMode::Expanded), (420.0, 540.0));
        assert_eq!(view_logical_size(ViewMode::Pill), (220.0, 44.0));
    }

    #[test]
    fn undocked_view_only_for_compact_and_expanded() {
        assert_eq!(
            undocked_view_for(ViewMode::Compact),
            Some(UndockedView::Compact),
        );
        assert_eq!(
            undocked_view_for(ViewMode::Expanded),
            Some(UndockedView::Expanded),
        );
        assert_eq!(undocked_view_for(ViewMode::Pill), None);
    }

    #[test]
    fn clamp_pulls_offscreen_window_back() {
        let work = Rect {
            x: 0.0,
            y: 0.0,
            width: 1920.0,
            height: 1040.0,
        };
        let (x, y) = clamp_top_left((-50.0, 3000.0), (320.0, 200.0), work);
        assert_eq!(x, 0.0);
        assert_eq!(y, work.bottom() - 200.0);
    }

    #[test]
    fn settings_opens_to_the_right_when_space_allows() {
        let work = Rect {
            x: 0.0,
            y: 0.0,
            width: 1920.0,
            height: 1040.0,
        };
        let widget = Rect {
            x: 100.0,
            y: 100.0,
            width: 320.0,
            height: 200.0,
        };
        let (x, y) = settings_panel_origin(
            widget,
            SETTINGS_WIDTH_PX,
            SETTINGS_HEIGHT_PX,
            SETTINGS_GAP_PX,
            work,
        );
        assert_eq!(x, widget.right() + SETTINGS_GAP_PX);
        assert_eq!(y, widget.y);
    }

    #[test]
    fn settings_flips_left_near_right_edge() {
        let work = Rect {
            x: 0.0,
            y: 0.0,
            width: 500.0,
            height: 600.0,
        };
        let widget = Rect {
            x: 100.0,
            y: 50.0,
            width: 320.0,
            height: 200.0,
        };
        let (x, _) = settings_panel_origin(
            widget,
            SETTINGS_WIDTH_PX,
            SETTINGS_HEIGHT_PX,
            SETTINGS_GAP_PX,
            work,
        );
        assert!(x < widget.x);
    }
}