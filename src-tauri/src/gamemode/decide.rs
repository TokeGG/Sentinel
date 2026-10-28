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
