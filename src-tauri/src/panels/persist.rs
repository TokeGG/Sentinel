//! Pure layout persistence helpers. The SQLite writes themselves happen on
//! the TypeScript side (Task 9, `src/shell/panelApi.ts`): tauri-plugin-sql
//! keeps its query API `pub(crate)`, and using its pool directly would need a
//! direct `sqlx` dependency plus `preload` config. Rust only shapes and clamps.
use super::state::PanelState;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

/// One `panel_layout` row as read by the frontend.
#[derive(Debug, Clone, Deserialize)]
pub struct LayoutRow {
    pub module_id: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub z: i64,
    pub state: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct SavedPanel {
    pub id: String,
    pub rect: Rect,
    pub state: String,
    pub z: i64,
}

pub fn parse_state(s: &str) -> Option<PanelState> {
    match s {
        "open" => Some(PanelState::Open),
        "suspended" => Some(PanelState::Suspended),
        "destroyed" => Some(PanelState::Destroyed),
        _ => None,
    }
}

pub fn state_name(s: PanelState) -> &'static str {
    match s {
        PanelState::Open => "open",
        PanelState::Suspended => "suspended",
        PanelState::Destroyed => "destroyed",
    }
}

/// None for rows with an unknown state or an invalid module id.
pub fn row_to_saved(row: &LayoutRow) -> Option<SavedPanel> {
    let st = parse_state(&row.state)?;
    if !super::ids::is_valid_panel_id(&row.module_id) {
        return None;
    }
    let rect = Rect { x: row.x, y: row.y, w: row.w, h: row.h };
    Some(SavedPanel { id: row.module_id.clone(), rect, state: state_name(st).into(), z: row.z })
}

fn num(n: f64) -> f64 {
    if n.is_finite() { n } else { 0.0 }
}
fn non_neg(n: f64) -> f64 {
    num(n).max(0.0)
}

/// Port of `clampToScreen` in src/shell/layout.ts — keep both in sync:
/// - NaN/infinite inputs become 0; negative screen/min sizes become 0.
/// - size = min(max(r.size, min), screen size), so a min larger than the
///   screen still yields the screen size.
/// - position is then clamped so the rect lies inside the screen.
/// - a zero-size screen yields a zero-size rect at the screen origin.
pub fn clamp(r: Rect, screen: Rect, min_w: f64, min_h: f64) -> Rect {
    let (sw, sh) = (non_neg(screen.w), non_neg(screen.h));
    let (sx, sy) = (num(screen.x), num(screen.y));
    let w = num(r.w).max(non_neg(min_w)).min(sw);
    let h = num(r.h).max(non_neg(min_h)).min(sh);
    let x = num(r.x).max(sx).min(sx + sw - w);
    let y = num(r.y).max(sy).min(sy + sh - h);
    Rect { x, y, w, h }
}

pub const MIN_W: f64 = 240.0;
pub const MIN_H: f64 = 160.0;

/// Rows -> clamped panels, ordered by z (bottom first). Bad rows are skipped.
pub fn restore(rows: &[LayoutRow], screen: Rect) -> Vec<SavedPanel> {
    let mut out: Vec<SavedPanel> = rows.iter().filter_map(row_to_saved).collect();
    for p in &mut out {
        p.rect = clamp(p.rect, screen, MIN_W, MIN_H);
    }
    out.sort_by_key(|p| p.z);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    const S: Rect = Rect { x: 0.0, y: 0.0, w: 1000.0, h: 800.0 };
    fn r(x: f64, y: f64, w: f64, h: f64) -> Rect {
        Rect { x, y, w, h }
    }
    fn row(id: &str, state: &str, z: i64) -> LayoutRow {
        LayoutRow { module_id: id.into(), x: 900.0, y: -50.0, w: 300.0, h: 300.0, z, state: state.into() }
    }

    #[test]
    fn clamp_moves_off_screen_rect_inside() {
        assert_eq!(clamp(r(900.0, -50.0, 300.0, 300.0), S, 200.0, 100.0), r(700.0, 0.0, 300.0, 300.0));
    }
    #[test]
    fn clamp_grows_to_min() {
        let c = clamp(r(10.0, 10.0, 50.0, 20.0), S, 200.0, 100.0);
        assert_eq!((c.w, c.h), (200.0, 100.0));
    }
    #[test]
    fn clamp_shrinks_to_screen() {
        assert_eq!(clamp(r(5.0, 5.0, 5000.0, 5000.0), S, 200.0, 100.0), S);
    }
    #[test]
    fn clamp_min_larger_than_screen() {
        assert_eq!(clamp(r(50.0, 50.0, 10.0, 10.0), S, 5000.0, 5000.0), S);
    }
    #[test]
    fn clamp_zero_screen_gives_zero_rect_at_origin() {
        let z = r(7.0, 9.0, 0.0, 0.0);
        assert_eq!(clamp(r(50.0, 50.0, 10.0, 10.0), z, 200.0, 100.0), z);
    }
    #[test]
    fn clamp_nan_and_negative_become_zero() {
        assert_eq!(clamp(r(f64::NAN, -5.0, f64::NAN, -10.0), S, 0.0, 0.0), r(0.0, 0.0, 0.0, 0.0));
    }
    #[test]
    fn row_to_saved_skips_invalid_state_and_id() {
        assert!(row_to_saved(&row("hub.notes", "bogus", 0)).is_none());
        assert!(row_to_saved(&row("../x", "open", 0)).is_none());
        let s = row_to_saved(&row("hub.notes", "suspended", 3)).unwrap();
        assert_eq!((s.id.as_str(), s.state.as_str(), s.z), ("hub.notes", "suspended", 3));
    }
    #[test]
    fn restore_clamps_skips_and_orders_by_z() {
        let out = restore(&[row("b", "open", 2), row("x", "nope", 0), row("a", "open", 1)], S);
        let ids: Vec<_> = out.iter().map(|p| p.id.as_str()).collect();
        assert_eq!(ids, ["a", "b"]);
        assert_eq!(out[0].rect, r(700.0, 0.0, 300.0, 300.0));
    }
}
