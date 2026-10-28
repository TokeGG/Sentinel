use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PanelState {
    Open,
    Suspended,
    Destroyed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpenOutcome {
    Created,
    Focused,
}

#[derive(Debug, Default)]
pub struct Panels {
    states: HashMap<String, PanelState>,
    z: Vec<String>,
    /// Some(..) while in game mode: ids destroyed so far, to restore on exit.
    destroyed: Option<Vec<String>>,
}

impl Panels {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn state(&self, id: &str) -> Option<PanelState> {
        self.states.get(id).copied()
    }
    pub fn open(&mut self, id: &str) -> OpenOutcome {
        let existing = matches!(
            self.states.get(id),
            Some(PanelState::Open | PanelState::Suspended)
        );
        self.purge_destroyed(id);
        self.z.retain(|x| x != id);
        self.z.push(id.to_string());
        self.states.insert(id.to_string(), PanelState::Open);
        if existing {
            OpenOutcome::Focused
        } else {
            OpenOutcome::Created
        }
    }
    pub fn close(&mut self, id: &str) {
        self.states.remove(id);
        self.z.retain(|x| x != id);
        self.purge_destroyed(id);
    }
    fn purge_destroyed(&mut self, id: &str) {
        if let Some(d) = self.destroyed.as_mut() {
            d.retain(|x| x != id);
        }
    }
    pub fn suspend_idle(&mut self, hidden: &[String]) {
        for id in hidden {
            if let Some(st) = self.states.get_mut(id) {
                if *st == PanelState::Open {
                    *st = PanelState::Suspended;
                }
            }
        }
    }
    /// Destroys every live panel not in `keep` (kept ones are suspended).
    /// Returns the ids newly destroyed by this call; the full restore list
    /// accumulates across repeated calls until `exit_game_mode`.
    pub fn enter_game_mode(&mut self, keep: &[&str]) -> Vec<String> {
        let mut gone = Vec::new();
        for id in self.z.clone() {
            if keep.contains(&id.as_str()) {
                self.states.insert(id, PanelState::Suspended);
            } else {
                self.states.insert(id.clone(), PanelState::Destroyed);
                gone.push(id);
            }
        }
        self.z.retain(|x| !gone.contains(x));
        self.destroyed
            .get_or_insert_with(Vec::new)
            .extend(gone.iter().cloned());
        gone
    }
    pub fn exit_game_mode(&mut self) -> Vec<String> {
        let restore: Vec<String> = self
            .destroyed
            .take()
            .unwrap_or_default()
            .into_iter()
            .filter(|id| self.states.get(id) == Some(&PanelState::Destroyed))
            .collect();
        for id in &restore {
            self.states.insert(id.clone(), PanelState::Open);
            self.z.push(id.clone());
        }
        restore
    }
    /// Suspended -> Open for the listed ids (e.g. kept panels after
    /// `exit_game_mode`). Returns the ids actually resumed.
    pub fn resume(&mut self, ids: &[String]) -> Vec<String> {
        let mut out = Vec::new();
        for id in ids {
            if let Some(st) = self.states.get_mut(id) {
                if *st == PanelState::Suspended {
                    *st = PanelState::Open;
                    out.push(id.clone());
                }
            }
        }
        out
    }
    pub fn z_order(&self) -> Vec<String> {
        self.z.clone()
    }
    /// True when `id` is the topmost panel (last in z order).
    pub fn is_top(&self, id: &str) -> bool {
        self.z.last().is_some_and(|x| x == id)
    }
}

pub fn is_safe_profile(name: &str) -> bool {
    let b = name.as_bytes();
    !b.is_empty()
        && b.len() <= 32
        && (b[0].is_ascii_lowercase() || b[0].is_ascii_digit())
        && b.iter()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-')
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(v: &[&str]) -> Vec<String> {
        v.iter().map(|x| x.to_string()).collect()
    }

    #[test]
    fn is_top_tracks_last_opened() {
        let mut p = Panels::new();
        p.open("b");
        p.open("a");
        assert!(p.is_top("a"));
        assert!(!p.is_top("b"));
        assert!(!p.is_top("zzz"));
        p.close("a");
        assert!(p.is_top("b"));
    }

    #[test]
    fn open_twice_focuses_existing() {
        let mut p = Panels::new();
        assert_eq!(p.open("a"), OpenOutcome::Created);
        assert_eq!(p.open("a"), OpenOutcome::Focused);
        assert_eq!(p.z_order(), s(&["a"]));
    }

    #[test]
    fn open_raises_to_top() {
        let mut p = Panels::new();
        p.open("a");
        p.open("b");
        p.open("a");
        assert_eq!(p.z_order(), s(&["b", "a"]));
    }

    #[test]
    fn close_removes_from_z_order() {
        let mut p = Panels::new();
        p.open("a");
        p.open("b");
        p.close("a");
        assert_eq!(p.z_order(), s(&["b"]));
        assert_eq!(p.state("a"), None);
    }

    #[test]
    fn open_after_close_creates_again() {
        let mut p = Panels::new();
        p.open("a");
        p.close("a");
        assert_eq!(p.open("a"), OpenOutcome::Created);
        assert_eq!(p.z_order(), s(&["a"]));
    }

    #[test]
    fn suspend_idle_only_touches_listed_ids() {
        let mut p = Panels::new();
        p.open("a");
        p.open("b");
        p.suspend_idle(&s(&["a", "zzz"]));
        assert_eq!(p.state("a"), Some(PanelState::Suspended));
        assert_eq!(p.state("b"), Some(PanelState::Open));
        assert_eq!(p.state("zzz"), None);
    }

    #[test]
    fn suspended_panel_reopens_as_open_and_is_raised() {
        let mut p = Panels::new();
        p.open("a");
        p.open("b");
        p.suspend_idle(&s(&["a"]));
        assert_eq!(p.open("a"), OpenOutcome::Focused);
        assert_eq!(p.state("a"), Some(PanelState::Open));
        assert_eq!(p.z_order(), s(&["b", "a"]));
    }

    #[test]
    fn game_mode_keeps_only_listed_and_returns_destroyed_ids() {
        let mut p = Panels::new();
        p.open("a");
        p.open("b");
        p.open("c");
        let mut d = p.enter_game_mode(&["b"]);
        d.sort();
        assert_eq!(d, s(&["a", "c"]));
        assert_eq!(p.z_order(), s(&["b"]));
        assert_eq!(p.state("a"), Some(PanelState::Destroyed));
    }

    #[test]
    fn keep_list_panels_are_suspended_not_destroyed_in_game_mode() {
        let mut p = Panels::new();
        p.open("a");
        p.open("b");
        p.open("c");
        p.enter_game_mode(&["b", "c"]);
        assert_eq!(p.state("b"), Some(PanelState::Suspended));
        assert_eq!(p.state("c"), Some(PanelState::Suspended));
        assert_eq!(p.state("a"), Some(PanelState::Destroyed));
    }

    #[test]
    fn exit_game_mode_restores_exactly_what_was_destroyed() {
        let mut p = Panels::new();
        p.open("a");
        p.open("b");
        p.open("c");
        p.enter_game_mode(&["b"]);
        let mut r = p.exit_game_mode();
        r.sort();
        assert_eq!(r, s(&["a", "c"]));
        assert_eq!(p.state("a"), Some(PanelState::Open));
        assert_eq!(p.state("c"), Some(PanelState::Open));
        assert!(p.exit_game_mode().is_empty());
    }

    #[test]
    fn enter_game_mode_twice_does_not_lose_restore_list() {
        let mut p = Panels::new();
        p.open("a");
        p.open("b");
        p.enter_game_mode(&["b"]);
        let second = p.enter_game_mode(&["b"]);
        assert!(second.is_empty());
        assert_eq!(p.exit_game_mode(), s(&["a"]));
    }

    #[test]
    fn exit_without_enter_restores_nothing() {
        let mut p = Panels::new();
        p.open("a");
        assert!(p.exit_game_mode().is_empty());
        assert_eq!(p.z_order(), s(&["a"]));
    }

    #[test]
    fn open_during_game_mode_is_not_restored_twice() {
        let mut p = Panels::new();
        p.open("a");
        p.open("b");
        p.enter_game_mode(&["b"]);
        assert_eq!(p.open("a"), OpenOutcome::Created);
        let r = p.exit_game_mode();
        assert!(!r.contains(&"a".to_string()));
        assert_eq!(p.z_order(), s(&["b", "a"]));
    }

    #[test]
    fn close_during_game_mode_is_not_resurrected() {
        let mut p = Panels::new();
        p.open("a");
        p.open("b");
        p.enter_game_mode(&["b"]);
        p.close("a");
        let r = p.exit_game_mode();
        assert!(r.is_empty());
        assert_eq!(p.z_order(), s(&["b"]));
        assert_eq!(p.state("a"), None);
    }

    #[test]
    fn resume_reopens_only_suspended_ids() {
        let mut p = Panels::new();
        p.open("a");
        p.open("b");
        p.enter_game_mode(&["b"]);
        assert_eq!(p.resume(&s(&["b", "a", "zzz"])), s(&["b"]));
        assert_eq!(p.state("b"), Some(PanelState::Open));
        assert_eq!(p.state("a"), Some(PanelState::Destroyed));
        assert_eq!(p.z_order(), s(&["b"]));
    }

    #[test]
    fn unsafe_profiles_rejected() {
        for bad in ["../x", "a/b", "", "a b", "A", "-a"] {
            assert!(!is_safe_profile(bad), "{bad:?}");
        }
        assert!(!is_safe_profile(&"a".repeat(33)));
        for ok in ["discord", "yt-main"] {
            assert!(is_safe_profile(ok), "{ok:?}");
        }
        assert!(is_safe_profile(&"a".repeat(32)));
    }
}
