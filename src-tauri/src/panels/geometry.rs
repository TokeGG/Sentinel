//! Pure chrome/content split of a panel's outer rect (Task 9b).
use super::persist::Rect;

/// Height of the chrome strip stacked above every panel's content webview.
pub const CHROME_H: f64 = 24.0; // keep in sync with --chrome-h in src/ui/tokens.css

/// Side of the square resize-grip overlay webview at the panel's bottom-right.
pub const GRIP: f64 = 16.0;

/// Grip rect: bottom-right corner of the outer rect (never above the chrome strip).
pub fn grip_rect(outer: Rect) -> Rect {
    let side = GRIP.min(outer.w.max(0.0)).min((outer.h - CHROME_H).max(0.0));
    Rect { x: outer.x + outer.w - side, y: outer.y + outer.h - side, w: side, h: side }
}

/// Height of the React tab bar at the top of an embedding panel's body (Social);
/// keep in sync with EMBED_TAB_H in src/modules/social/embedSites.ts (a test enforces it).
pub const EMBED_TAB_H: f64 = 32.0;

/// Embedded web view rect: the content rect minus the tab bar.
pub fn embed_rect(outer: Rect) -> Rect {
    let (_, c) = geometry(outer);
    Rect { x: c.x, y: c.y + EMBED_TAB_H, w: c.w, h: (c.h - EMBED_TAB_H).max(0.0) }
}

/// Outer rect (chrome included; the one stored/persisted/returned) ->
/// (chrome rect, content rect).
pub fn geometry(outer: Rect) -> (Rect, Rect) {
    let chrome = Rect { x: outer.x, y: outer.y, w: outer.w, h: CHROME_H };
    let content = Rect { x: outer.x, y: outer.y + CHROME_H, w: outer.w, h: (outer.h - CHROME_H).max(0.0) };
    (chrome, content)
}

/// "Full window" toggle: (current, previous, screen) -> (new rect, new previous).
/// Not full -> fill `screen`, remember `cur`; full -> back to the remembered rect.
pub fn toggle_full(cur: Rect, prev: Option<Rect>, screen: Rect) -> (Rect, Option<Rect>) {
    match prev {
        Some(p) => (p, None),
        None => (screen, Some(cur)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn r(x: f64, y: f64, w: f64, h: f64) -> Rect {
        Rect { x, y, w, h }
    }
    #[test]
    fn chrome_spans_full_width_at_top() {
        let (c, _) = geometry(r(10.0, 20.0, 300.0, 200.0));
        assert_eq!((c.x, c.y, c.w, c.h), (10.0, 20.0, 300.0, CHROME_H));
    }
    #[test]
    fn content_sits_below_chrome() {
        let (_, b) = geometry(r(10.0, 20.0, 300.0, 200.0));
        assert_eq!((b.x, b.y, b.w, b.h), (10.0, 20.0 + CHROME_H, 300.0, 200.0 - CHROME_H));
    }
    #[test]
    fn content_height_never_negative() {
        let (_, b) = geometry(r(0.0, 0.0, 100.0, 10.0));
        assert_eq!(b.h, 0.0);
    }
    #[test]
    fn zero_rect() {
        let (c, b) = geometry(r(0.0, 0.0, 0.0, 0.0));
        assert_eq!((c.w, c.h), (0.0, CHROME_H));
        assert_eq!((b.y, b.w, b.h), (CHROME_H, 0.0, 0.0));
    }
    #[test]
    fn embed_sits_below_chrome_and_tab_bar() {
        let b = embed_rect(r(10.0, 20.0, 300.0, 200.0));
        assert_eq!((b.x, b.y, b.w, b.h), (10.0, 20.0 + CHROME_H + EMBED_TAB_H, 300.0, 200.0 - CHROME_H - EMBED_TAB_H));
        assert_eq!(embed_rect(r(0.0, 0.0, 100.0, 40.0)).h, 0.0);
    }
    #[test]
    fn grip_sits_at_bottom_right() {
        let g = grip_rect(r(10.0, 20.0, 300.0, 200.0));
        assert_eq!((g.x, g.y, g.w, g.h), (294.0, 204.0, GRIP, GRIP));
    }
    #[test]
    fn grip_shrinks_in_tiny_panels() {
        let g = grip_rect(r(0.0, 0.0, 100.0, 30.0));
        assert_eq!((g.w, g.h), (30.0 - CHROME_H, 30.0 - CHROME_H));
        assert_eq!(grip_rect(r(0.0, 0.0, 0.0, 0.0)).w, 0.0);
    }
    #[test]
    fn full_window_round_trips() {
        let (a, s) = (r(10.0, 20.0, 300.0, 200.0), r(0.0, 0.0, 1600.0, 900.0));
        let (full, prev) = toggle_full(a, None, s);
        assert_eq!((full.w, full.h, prev.map(|p| p.w)), (1600.0, 900.0, Some(300.0)));
        let (back, prev) = toggle_full(full, prev, s);
        assert_eq!((back.x, back.y, back.w, back.h), (10.0, 20.0, 300.0, 200.0));
        assert!(prev.is_none());
    }
}
