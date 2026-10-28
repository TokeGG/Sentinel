# Sentinel Core Shell — Design (sub-project 1 of 4)

## Product direction (agreed)
Sentinel becomes an "agentic OS": a star map of planets (modules) that open as any number of floating panels.
Build order: **1 core + shell → 2 Discord/YouTube → 3 multi-site chat → 4 browser bot.**
This spec covers sub-project 1 only; the others get their own spec → plan → build cycle.

| Area | Decision |
|---|---|
| Shell | Star map canvas; planets launch panels; panels float, resize, tile; layout persisted |
| YouTube (2) | Feed with IFrame player + full youtube.com webview |
| Discord (2) | Embedded official web client, persistent login profile |
| Chat (3) | Chatterino-style; Twitch, Kick, d.gg, iCanHazChat, user-added connectors; sending enabled; emotes: native + 7TV + BTTV + FFZ |
| Bot (4) | Headless browser agent with skills; local model (RTX 3090, 24GB), no API key; research, automation, testing own apps, chat-driven; approval required for risky steps (submit, post, buy, login) |
| Bot brain (4) | Shared learning kernel extracted from `TokeGG/mmoarena` (bounded nudges, evidence from recorded runs, variant bandit, owner notes, reports, explicit commit) used by both projects. The browser bot adds its own parameter set (waits, retries, selector strategy, approval thresholds) and a lesson memory written after failures and fed with user material. mmoarena's 34 arena numbers are not shared; the machinery is. |
| Performance | Model loads on demand, unloads after; auto game mode (manual override); hidden panels suspend |
| Code | Deduplicate, no filler, no file over ~150 lines, no code without a caller |

## Goals
1. Replace sidebar + single workspace with a star-map shell and a multi-panel runtime.
2. Make web content (Discord, YouTube, chat sites) first-class panels via the manifest.
3. Add game mode so Sentinel never competes with a running game.
4. Shrink and split existing code without changing behavior.

## Non-goals (this sub-project)
Discord/YouTube/chat/bot features themselves; any hosted-AI call; changing the pentest scope gate, keychain-only secrets, or opt-in scheduling.

## Panel runtime
- **Star map:** the main webview; one canvas drawing planets from the module registry; the only always-on view.
- **Panel:** one native Tauri child webview per panel. Internal modules load `/#/panel/<moduleId>` from the same bundle. Web modules load their site URL with a persistent per-module profile directory.
- **Panel manager (Rust, `src-tauri/src/panels.rs`):** owns open, close, move, resize, focus, z-order. Frontend sends commands; layouts persist in SQLite (`panel_layout` table, migration appended in order).
- **States:** `open | suspended | destroyed`. Hidden panels suspend after a timeout. Webviews sharing a profile share one browser process on Windows.
- **Overlap model:** every panel is a webview, so any panel can overlap any other (user choice "B").
- **Verified-first risk:** Tauri 2 multiwebview is behind the `unstable` feature and has no known z-order setter; raising a panel may require re-creating its webview. **Task 1 is a spike:** five overlapping webviews, measuring raise cost, focus behavior, and memory. **Fallback if it fails:** web panels always render above normal panels (option A).

## Game mode
- Trigger: foreground fullscreen app or sustained high GPU load, or manual toggle.
- On: stop scheduler timers, destroy all panels except chat and Discord (suspended to low priority), unload any local model (bot pauses). Off: restore saved layout.
- Detection lives in Rust (`gamemode.rs`); it emits one event the panel manager and scheduler consume.

## Module contract changes (`src/core/module.ts`)
- `PanelKind` adds `"web"`; web manifests declare `web: { url, profile }`. `validateManifest` requires both for `"web"` and rejects them on other kinds.
- Existing generic fields (`quickAdd`, `actions`, `rowAction`, `credentialFields`, `forms`, `schedule`) unchanged.
- `"chat"` and `"custom"` stay reserved for sub-projects 3 and 4.

## Cleanup (behavior-preserving; existing 35 TS + 5 Rust tests must pass before and after)
- `validateManifest` (154 lines): replace ~10 repeated "references unknown skill" checks with one table-driven check.
- `src-tauri/src/lib.rs` (893 lines): split into `commands/<area>.rs` and numbered `migrations/NN_<module>.sql`; version numbers stay strictly ascending and match Vec position.
- `ModulePanel.tsx` (227 lines): split into form, row-action, credential, and list components.
- Rule going forward: no file over ~150 lines; no code without a caller.

## Testing
- Pure logic extracted and unit tested (layout math, panel state machine, game-mode decision, manifest table check).
- Rust tests for panel state transitions and migration ordering.
- The spike produces recorded measurements, not a pass/fail guess.

## Decisions deferred to later sub-projects
- 2: exact IFrame player controls; which Discord notifications surface on the star map.
- 3: connector protocols for d.gg and iCanHazChat; sending/login flow per site.
- 4: bundled skill packs sourced from GitHub and shipped inside the app per module (e.g. pentest skills behind the engagement scope gate; deal-search and news-search skills); which repos, how pinned and reviewed; kernel packaging (package vs local service) and the change to mmoarena; lesson-memory format; browser engine (CDP driver), local model runtime and size, skill sources and format.
