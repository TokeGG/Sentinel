//! Pure game-mode decision logic.
const GPU_PERCENT_UNAVAILABLE: f32 = 0.0;

pub fn should_enter(fullscreen_foreground: bool, gpu_percent: f32, manual: bool) -> bool {
    manual || fullscreen_foreground || gpu_percent >= 85.0
}

/// Auto-detection is opt-in: fullscreen only counts when `auto` is on.
/// Manual mode works regardless.
pub fn decide(auto: bool, fullscreen_foreground: bool, manual: bool) -> bool {
    should_enter(auto && fullscreen_foreground, GPU_PERCENT_UNAVAILABLE, manual)
}

/// Polls in a row a fullscreen foreground must persist before auto mode ENTERS
/// (so an alt-tab flicker or the task switcher never counts). Exit is immediate.
pub const ENTER_POLLS: u8 = 2;

/// Debounce the raw fullscreen reading: `streak` counts consecutive true polls.
/// While already `active`, a true reading holds the mode; a false one ends it.
pub fn confirm_fullscreen(streak: &mut u8, raw: bool, active: bool) -> bool {
    *streak = if raw { streak.saturating_add(1).min(ENTER_POLLS) } else { 0 };
    raw && (active || *streak >= ENTER_POLLS)
}

pub type Edges = (i32, i32, i32, i32); // left, top, right, bottom

/// A foreground window is "a game" only if it covers its whole monitor AND has
/// no caption/frame. A maximized normal window overflows the monitor by the
/// resize border (~8px) but has a caption, so it must NOT count.
pub fn is_fullscreen_game(win: Edges, mon: Edges, framed: bool) -> bool {
    !framed && win.0 <= mon.0 && win.1 <= mon.1 && win.2 >= mon.2 && win.3 >= mon.3
}

/// Shell / task-switcher windows that cover the screen during alt-tab.
pub fn is_shell_class(class: &str) -> bool {
    matches!(
        class,
        "Progman" | "WorkerW" | "Shell_TrayWnd" | "XamlExplorerHostIslandWindow" | "MultitaskingViewFrame"
            | "ForegroundStaging" | "Windows.UI.Core.CoreWindow" | "TaskSwitcherWnd" | "TaskListThumbnailWnd"
    )
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Transition {
    Enter,
    Exit,
}
/// Edge-triggered: only a change of `should` vs `active` yields a transition.
pub fn transition(active: bool, should: bool) -> Option<Transition> {
    match (active, should) {
        (false, true) => Some(Transition::Enter),
        (true, false) => Some(Transition::Exit),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn manual_forces_on() { assert!(should_enter(false, 0.0, true)); }
    #[test] fn fullscreen_forces_on() { assert!(should_enter(true, 0.0, false)); }
    #[test] fn gpu_threshold_is_inclusive_at_85() {
        assert!(should_enter(false, 85.0, false));
        assert!(!should_enter(false, 84.9, false));
    }
    #[test] fn idle_is_off() { assert!(!should_enter(false, 0.0, false)); }
    #[test] fn auto_off_ignores_fullscreen() { assert!(!decide(false, true, false)); }
    #[test] fn auto_off_manual_still_enters() { assert!(decide(false, false, true)); }
    #[test] fn auto_on_fullscreen_enters() { assert!(decide(true, true, false)); }
    #[test] fn maximized_framed_window_is_not_a_game() {
        assert!(!is_fullscreen_game((-8, -8, 1928, 1088), (0, 0, 1920, 1080), true));
    }
    #[test] fn borderless_cover_is_a_game() {
        assert!(is_fullscreen_game((0, 0, 1920, 1080), (0, 0, 1920, 1080), false));
        assert!(!is_fullscreen_game((0, 0, 1920, 1040), (0, 0, 1920, 1080), false));
    }
    #[test] fn switcher_and_shell_classes_are_ignored() {
        assert!(is_shell_class("MultitaskingViewFrame") && is_shell_class("WorkerW"));
        assert!(!is_shell_class("UnrealWindow"));
    }
    #[test] fn alt_tab_flicker_never_enters() {
        let mut n = 0;
        assert!(!confirm_fullscreen(&mut n, true, false)); // one poll
        assert!(!confirm_fullscreen(&mut n, false, false)); // switched back
        assert!(!confirm_fullscreen(&mut n, true, false)); // streak restarted
        assert!(confirm_fullscreen(&mut n, true, false)); // sustained
    }
    #[test] fn active_holds_then_exits_immediately() {
        let mut n = 0;
        assert!(confirm_fullscreen(&mut n, true, true));
        assert!(!confirm_fullscreen(&mut n, false, true));
        assert_eq!(n, 0);
    }
    #[test] fn transitions_are_edge_triggered() {
        assert_eq!(transition(false, true), Some(Transition::Enter));
        assert_eq!(transition(true, true), None);
        assert_eq!(transition(true, false), Some(Transition::Exit));
        assert_eq!(transition(false, false), None);
    }
    #[test] fn manual_stays_on_until_manual_off_and_auto_false() {
        let still = should_enter(false, 0.0, true);
        assert_eq!(transition(true, still), None);
        assert_eq!(transition(true, should_enter(true, 0.0, false)), None);
        assert_eq!(transition(true, should_enter(false, 0.0, false)), Some(Transition::Exit));
    }
}
