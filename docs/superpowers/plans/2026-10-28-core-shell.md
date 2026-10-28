# Core Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sidebar shell with a star map that opens any number of overlapping panels (each a native webview), add game mode, add a `"web"` panel kind, and shrink the existing code without changing behavior.

**Architecture:** A Rust panel manager owns one Tauri child webview per panel (state machine + persisted layout). The main webview draws the star map from the module registry and sends open/close/move/resize/focus commands. Pure logic (layout math, panel state, game-mode decision, manifest checks) is extracted and unit-tested. Task 1 is a spike that decides this architecture or the fallback.

**Tech Stack:** Tauri 2 (`unstable` multiwebview feature), Rust edition 2024, React 19, TypeScript, SQLite via `tauri-plugin-sql`, `node --experimental-strip-types --test`, `cargo test --lib`.

**Spec:** `docs/superpowers/specs/2026-10-28-core-shell-design.md`

## Global Constraints

- No file over about 150 lines; no code without a caller.
- Migration `version` numbers strictly ascending and equal to their position in the list (currently 1 to 16; the new one is 17).
- Secrets only via the OS keychain; no background task without a persisted opt-in; `src/modules/pentest/scope.ts` untouched.
- Baseline before and after every refactor task: 35 TS tests and 5 Rust tests pass (`node --experimental-strip-types --test src/core/module.test.ts src/modules/news/rss.test.ts src/modules/youtube/pkce.test.ts src/modules/pentest/scope.test.ts`; `cd src-tauri && cargo test --lib`).
- Panel states: `open | suspended | destroyed`. Game mode keeps only chat and Discord (suspended, low priority).
- Web panels need `web: { url, profile }`; those fields are rejected on other kinds.
- No hosted AI calls anywhere.

## Review Focus

1. Opening a module that already has a panel focuses the existing panel instead of creating a second.
2. A saved layout that is off-screen (monitor removed or resized) is clamped back into the visible area.
3. A saved layout naming a module that is no longer registered is skipped, not a crash.
4. Leaving game mode re-enables only schedules the user had switched on, never others.
5. A web `profile` containing path characters (`../`, spaces, slashes) cannot escape the profiles directory.

## File Structure

- `src-tauri/src/lib.rs` shrinks to wiring only (plugins, handler list, `run`).
- `src-tauri/src/commands/{system,network,repo,oauth,mail,files,pentest,backup,credentials}.rs`: existing commands, moved unchanged.
- `src-tauri/src/migrations.rs` + `src-tauri/migrations/NN_<name>.sql`: one file per existing migration, loaded with `include_str!`.
- `src-tauri/src/panels/{state.rs,manager.rs,persist.rs}`: pure state machine, webview commands, layout save/load.
- `src-tauri/src/gamemode.rs`: pure decision + Windows foreground detection.
- `src/shell/{layout.ts,StarMap.tsx,Planet.tsx,panelApi.ts,PanelRoute.tsx}`: shell.
- `src/core/ModulePanel.tsx` splits into `src/core/panel/{ListView,FormView,RowAction,CredentialFields,ScheduleToggle}.tsx`.
- `scripts/check-file-size.mjs`: fails when a source file exceeds 150 lines (allow-list for tests and generated files).

---

### Task 1: Spike — overlapping webviews

Throwaway code; the output is `docs/superpowers/spikes/2026-10-28-webview-spike.md`.

**Files:**
- Modify: `src-tauri/Cargo.toml` (`tauri = { version = "2", features = ["unstable"] }`)
- Create: `src-tauri/src/spike.rs` (temporary command `spike_open(n: u32)`), removed in this task's last step
- Create: `docs/superpowers/spikes/2026-10-28-webview-spike.md`

**Interfaces:**
- Produces: a recorded decision, `B` (all webviews) or `A` (web panels on top), that Task 7 reads.

- [ ] **Step 1: Add `spike_open(app: tauri::AppHandle, n: u32) -> Result<(), String>`** creating `n` child webviews via `window.add_child(WebviewBuilder::new(label, WebviewUrl::External(...)), pos, size)`, overlapping, each loading a different site (youtube.com, discord.com/app, and local pages).
- [ ] **Step 2: Run `npm run tauri dev` on Windows with n=5.** Record in the spike doc: (a) can a lower webview be raised above others without re-creating it (try `set_focus`, `show`/`hide`, re-order APIs); (b) cost of re-creating a webview to raise it (ms, whether login/state survives with a shared `data_directory`); (c) working-set memory with 5 webviews versus 1 (Task Manager total for the msedgewebview2 tree); (d) whether clicks and keyboard focus reach the topmost webview correctly.
- [ ] **Step 3: Write the decision.** `B` if raise works or re-create takes under 300 ms with session preserved and 5 webviews add under 1 GB; otherwise `A`. Record the numbers.
- [ ] **Step 4: Remove `spike.rs` and its handler registration; keep the `unstable` feature.** Run `cd src-tauri && cargo check`. Expected: no errors.
- [ ] **Step 5: Commit** `spike: record webview overlap measurements and decision`.

---

### Task 2: Manifest validation — table-driven checks and `"web"` kind

**Files:**
- Modify: `src/core/module.ts`
- Test: `src/core/module.test.ts`

**Interfaces:**
- Produces: `PanelKind` now `"list" | "table" | "chat" | "custom" | "web"`; `ModuleManifest.web?: { url: string; profile: string }`; `validateManifest` behavior unchanged for existing kinds.

- [ ] **Step 1: Write failing tests** in `module.test.ts`:
  - `rejects web panel without web config` (panel `"web"`, no `web` → throws `ManifestError` matching `/web/`)
  - `rejects web config on non-web panel`
  - `rejects web url that is not https`
  - `rejects profile with path characters` (`"../x"`, `"a b"`, `"a/b"`; accepts `"discord"`, `"yt-main"`; pattern `/^[a-z0-9][a-z0-9-]{0,31}$/`)
  - `accepts a valid web manifest` (no `load()` required for `"web"`)
- [ ] **Step 2: Run** the module tests. Expected: the five new tests FAIL, the existing tests pass.
- [ ] **Step 3: Implement** `"web"` in `PANEL_KINDS` and a `checkWeb(where, m)` helper. Then replace the repeated "references unknown skill" blocks (actions, quickAdd, forms, schedule, rowAction) with one `skillRefs(m): { what: string; skill: string }[]` list checked in a single loop that throws `${where}: ${what} references unknown skill "${skill}"`. Error texts must stay identical (existing tests assert them).
- [ ] **Step 4: Run the full TS baseline.** Expected: all pass, `module.ts` under 110 lines.
- [ ] **Step 5: Commit** `refactor: table-driven manifest checks, add web panel kind`.

---

### Task 3: Split `lib.rs` commands

**Files:**
- Create: `src-tauri/src/commands/mod.rs` and the nine files listed in File Structure
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `commands::*` re-exports every existing `#[tauri::command]` under its current name, so `generate_handler!` in `lib.rs` is unchanged. Moved Rust tests stay with `commands/files.rs` (search walker).

- [ ] **Step 1: Run `cd src-tauri && cargo test --lib`.** Expected: 5 pass (baseline).
- [ ] **Step 2: Move each command and its private types/helpers into the matching file unchanged**; `commands/mod.rs` has `pub mod x; pub use x::*;`.
- [ ] **Step 3: Run `cargo test --lib` and `cargo check`.** Expected: 5 pass, no new warnings.
- [ ] **Step 4: Commit** `refactor: split lib.rs commands by area`.

---

### Task 4: Migrations as SQL files + `panel_layout`

**Files:**
- Create: `src-tauri/migrations/01_foundation.sql` … `16_*.sql` (SQL copied verbatim from `lib.rs`), `17_panel_layout.sql`
- Create: `src-tauri/src/migrations.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `pub fn all() -> Vec<Migration>` in `migrations.rs`; table `panel_layout(module_id TEXT PRIMARY KEY, x REAL, y REAL, w REAL, h REAL, z INTEGER, state TEXT NOT NULL)`.

- [ ] **Step 1: Write failing test** `versions_are_ascending_and_match_position` in `migrations.rs` asserting `all()[i].version == (i as i64) + 1` for every `i` and `all().len() == 17`.
- [ ] **Step 2: Run** `cargo test --lib migrations`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `all()` with one `Migration { version, description, sql: include_str!("../migrations/NN_x.sql"), kind: MigrationKind::Up }` per file; write `17_panel_layout.sql`; `lib.rs` calls `migrations::all()`.
- [ ] **Step 4: Verify existing DB compatibility:** diff concatenated SQL of files 1 to 16 against the old inline strings (whitespace-insensitive). Expected: identical.
- [ ] **Step 5: Run** `cargo test --lib`. Expected: 6 pass. **Commit** `refactor: migrations as sql files; add panel_layout`.

---

### Task 5: Layout math (pure)

**Files:**
- Create: `src/shell/layout.ts`
- Test: `src/shell/layout.test.ts`

**Interfaces:**
- Produces:
  - `type Rect = { x: number; y: number; w: number; h: number }`
  - `clampToScreen(r: Rect, screen: Rect, min: { w: number; h: number }): Rect`
  - `tile(count: number, screen: Rect): Rect[]` (grid, row-major, fills screen)
  - `cascade(index: number, screen: Rect, size: { w: number; h: number }): Rect` (offset 32px per index, wraps to origin when out of screen)

- [ ] **Step 1: Write failing tests:** `clampToScreen` moves an off-screen rect fully inside; grows a rect smaller than `min`; shrinks one larger than the screen. `tile(0)` returns `[]`; `tile(3, 1000x800)` returns 3 non-overlapping rects covering the screen; `cascade(0)` is at the screen origin plus 32 and `cascade(100)` is still inside the screen.
- [ ] **Step 2: Run** `node --experimental-strip-types --test src/shell/layout.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the three functions, no dependencies.
- [ ] **Step 4: Run.** Expected: PASS. **Commit** `feat(shell): layout math`.

---

### Task 6: Panel state machine (pure Rust)

**Files:**
- Create: `src-tauri/src/panels/state.rs`, `src-tauri/src/panels/mod.rs`

**Interfaces:**
- Produces:
  - `enum PanelState { Open, Suspended, Destroyed }`
  - `struct Panels { /* module_id -> (PanelState, z) */ }` with `open(&mut self, id: &str) -> OpenOutcome` (`Created | Focused`; focusing an existing panel returns `Focused` and raises it), `close(&mut self, id)`, `suspend_idle(&mut self, hidden: &[String])`, `enter_game_mode(&mut self, keep: &[&str]) -> Vec<String>` (ids to destroy), `exit_game_mode(&mut self) -> Vec<String>` (ids to restore), `z_order(&self) -> Vec<String>` (back to front)
  - `fn is_safe_profile(name: &str) -> bool` matching `^[a-z0-9][a-z0-9-]{0,31}$`

- [ ] **Step 1: Write failing tests:** `open_twice_focuses_existing`; `open_raises_to_top`; `close_removes_from_z_order`; `suspend_idle_only_touches_listed_ids`; `game_mode_keeps_only_listed_and_returns_destroyed_ids`; `exit_game_mode_restores_exactly_what_was_destroyed`; `exit_without_enter_restores_nothing`; `unsafe_profiles_rejected` (`"../x"`, `"a/b"`, `""`, `"a b"`, 33 chars).
- [ ] **Step 2: Run** `cargo test --lib panels::state`. Expected: FAIL.
- [ ] **Step 3: Implement** with a `Vec<String>` z-order plus a `HashMap<String, PanelState>`; game mode stores the destroyed list.
- [ ] **Step 4: Run.** Expected: PASS. **Commit** `feat(panels): pure state machine`.

---

### Task 7: Panel manager and persistence

**Files:**
- Create: `src-tauri/src/panels/manager.rs`, `src-tauri/src/panels/persist.rs`
- Modify: `src-tauri/src/lib.rs` (manage `Mutex<Panels>`, register commands), `src-tauri/capabilities/default.json` (webview create/position/size/focus/close permissions for window `main`), `src-tauri/tauri.conf.json` (window 1280x800)

**Interfaces:**
- Consumes: `Panels`, `is_safe_profile` (Task 6); `panel_layout` (Task 4); decision from Task 1.
- Produces Tauri commands:
  - `open_panel(app, id: String, url: Option<String>, profile: Option<String>, rect: Rect) -> Result<(), String>`
  - `close_panel(app, id: String)`, `move_panel(app, id, x: f64, y: f64)`, `resize_panel(app, id, w: f64, h: f64)`, `focus_panel(app, id)`
  - `restore_layout(app) -> Vec<SavedPanel>` where `SavedPanel { id, rect, state }`
  - Internal route for non-web panels: `WebviewUrl::App("index.html#/panel/<id>")`
- If Task 1 chose `A`: `focus_panel` on a non-web panel never raises it above web panels; document this in the manager's header comment.

- [ ] **Step 1: Write failing tests (pure parts):** `persist::row_to_saved` skips rows whose `state` is not a valid state; `persist::clamp_saved` (uses the same math as Task 5, ported to Rust as `clamp(rect, screen, min)`) moves off-screen rects inside the screen.
- [ ] **Step 2: Run** `cargo test --lib panels`. Expected: FAIL.
- [ ] **Step 3: Implement the commands.** Web panels set `data_directory` to `<app_data_dir>/profiles/<profile>` only after `is_safe_profile` passes. Mutations of `Panels` hold the lock, release it, then act on webviews. Every move/resize/close writes the row to `panel_layout` through a `persist::save` function.
- [ ] **Step 4: Manual check on Windows:** open three panels, drag one over another, close the app, relaunch; layout returns. Record in the commit body.
- [ ] **Step 5: Commit** `feat(panels): webview manager with persisted layout`.

---

### Task 8: Game mode

**Files:**
- Create: `src-tauri/src/gamemode.rs`
- Modify: `src/core/scheduler.ts`, `src-tauri/src/lib.rs`
- Test: `src-tauri/src/gamemode.rs` (Rust), `src/core/scheduler.test.ts`

**Interfaces:**
- Consumes: `Panels::enter_game_mode`/`exit_game_mode` (Task 6).
- Produces:
  - `fn should_enter(fullscreen_foreground: bool, gpu_percent: f32, manual: bool) -> bool` (true if `manual`, or `fullscreen_foreground`, or `gpu_percent >= 85.0`)
  - Tauri commands `set_game_mode(manual: bool)` and a polled detector (every 5 s, only while the app runs) that emits the event `game-mode` with payload `{ active: boolean }`; foreground-fullscreen detection via Win32 `GetForegroundWindow` compared against its monitor rect (`windows-sys`, Windows only; other platforms return `false`)
  - `scheduler.ts`: `pauseAll(): void` and `resumeEnabled(registry: ModuleManifest[]): Promise<void>`; `resumeEnabled` starts timers only for modules whose persisted toggle is on (reuses `initScheduler`)

- [ ] **Step 1: Write failing tests:** Rust `manual_forces_on`, `fullscreen_forces_on`, `gpu_threshold_is_inclusive_at_85`, `idle_is_off`; TS `resumeEnabled starts only user-enabled modules` and `pauseAll clears every timer` (inject a fake db via an optional parameter).
- [ ] **Step 2: Run both suites.** Expected: FAIL.
- [ ] **Step 3: Implement.** The `game-mode` listener in the shell (Task 9) calls `pauseAll`/`resumeEnabled` and the destroy/restore commands.
- [ ] **Step 4: Run both suites.** Expected: PASS. **Commit** `feat: game mode`.

---

### Task 9: Star map shell

**Files:**
- Create: `src/shell/{StarMap.tsx,Planet.tsx,panelApi.ts,PanelRoute.tsx}`
- Modify: `src/App.tsx`, `src/App.css`; delete `src/core/Sidebar.tsx`
- Test: `src/shell/planets.test.ts`

**Interfaces:**
- Consumes: `registry` (module.ts), layout math (Task 5), panel commands (Task 7), `game-mode` event (Task 8).
- Produces:
  - `planetsFor(modules: ModuleManifest[], size: { w: number; h: number }): { id: string; x: number; y: number; r: number }[]` in `src/shell/planets.ts` (deterministic positions from a hash of `id`; no overlap; returns `[]` for zero modules)
  - `panelApi.ts`: `openPanel(m: ModuleManifest, rect?: Rect)`, `closePanel(id)`, `movePanel`, `resizePanel`, `focusPanel`, `restore()` wrapping `invoke`
  - `PanelRoute.tsx`: renders `<ModulePanel>` for `#/panel/<id>`, "Module not found" for an unknown id

- [ ] **Step 1: Write failing tests** for `planetsFor`: `no_overlap_for_18_modules`, `same_input_same_output`, `empty_registry_returns_empty`.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Implement `planetsFor`, then `StarMap.tsx`** (canvas drawing planets with name labels, click opens the panel via `openPanel`, pan/zoom with wheel and drag, an empty-state message when no modules). `App.tsx`: if `location.hash` starts with `#/panel/` render `PanelRoute`, else `StarMap`; the star map calls `restore()` on mount and `initScheduler` as before.
- [ ] **Step 4: `npx tsc --noEmit` and the TS baseline.** Expected: clean, all pass.
- [ ] **Step 5: Manual check:** open five different modules, overlap them, game-mode toggle button destroys and restores them. **Commit** `feat(shell): star map and panel launcher`.

---

### Task 10: Split `ModulePanel.tsx`

**Files:**
- Create: `src/core/panel/{ListView,FormView,RowAction,CredentialFields,ScheduleToggle}.tsx`
- Modify: `src/core/ModulePanel.tsx` (composition only, under 60 lines)

**Interfaces:**
- Produces: five components, each taking the `module` plus its own slice of props; rendered output and CSS class names unchanged.

- [ ] **Step 1: Capture a baseline:** `npx tsc --noEmit` clean; screenshot Notes, News and Pentest panels via `npm run tauri dev`.
- [ ] **Step 2: Move each section of `ModulePanel` into its component without behavior changes.**
- [ ] **Step 3: Re-run `tsc`, the TS baseline, and compare screenshots.** Expected: identical.
- [ ] **Step 4: Commit** `refactor: split ModulePanel into focused components`.

---

### Task 11: Size guard and docs

**Files:**
- Create: `scripts/check-file-size.mjs`
- Modify: `package.json` (script `check:size`), `CLAUDE.md`, `README.md`

- [ ] **Step 1: Write the script:** walks `src/` and `src-tauri/src/`, fails listing any file over 150 lines except `*.test.ts` and an explicit allow-list array at the top of the script.
- [ ] **Step 2: Run `npm run check:size`.** Expected: lists the offenders still above 150 (for example `finance/index.ts`, `youtube/index.ts`, `social/connectors.ts`, `pentest/index.ts`); put exactly those in the allow-list with a comment that each is scheduled for its own split, so the guard blocks new violations.
- [ ] **Step 3: Update `CLAUDE.md`** (new shell, panel manager, game mode, file-size rule, new test count) and `README.md` status.
- [ ] **Step 4: Run all checks:** `npx tsc --noEmit`, TS baseline plus new tests, `cargo test --lib`, `npm run check:size`. Expected: all pass.
- [ ] **Step 5: Commit** `chore: file-size guard and docs for the new shell`.
