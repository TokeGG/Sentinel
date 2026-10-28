//! Pure chrome/content split of a panel's outer rect (Task 9b).
use super::persist::Rect;

/// Height of the chrome strip stacked above every panel's content webview.
pub const CHROME_H: f64 = 28.0;

/// Outer rect (chrome included; the one stored/persisted/returned) ->
/// (chrome rect, content rect).
pub fn geometry(outer: Rect) -> (Rect, Rect) {
    let chrome = Rect { x: outer.x, y: outer.y, w: outer.w, h: CHROME_H };
    let content = Rect { x: outer.x, y: outer.y + CHROME_H, w: outer.w, h: (outer.h - CHROME_H).max(0.0) };
    (chrome, content)
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
        assert_eq!((b.x, b.y, b.w, b.h), (10.0, 48.0, 300.0, 172.0));
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
}
