# Sentinel — AI agent guide

Read this first. It's written so an AI working on this repo doesn't need to
read every file to understand the shape of the project. Full plan/rationale:
https://claude.ai/artifact/9XSLWd8XTtd7vpWvSfNUQ3

## What this is

A local-first, modular Windows desktop hub (Tauri 2 + React + TypeScript).
Every feature — News, Finance, Email, Pentest Lab, etc. — is a self-contained
"module" under `src/modules/<name>/`. The shell (`src/core/`) never
hardcodes module-specific UI; a generic panel renders any module from its
manifest alone.

**Non-negotiable project principles** (don't violate these when adding code):
- **Local-first, no hosted AI/paid inference.** Nothing calls a cloud LLM API.
- **No background task without explicit opt-in.** See `src/core/scheduler.ts`
  — a module declaring `schedule` does NOT mean it runs; the user must flip
  a per-module toggle, persisted in SQLite, before any timer starts.
- **Secrets only via the OS keychain** (`src/core/credentials.ts` /
  `set_credential`/`get_credential` in Rust, using the `keyring` crate).
  Never write a secret to SQLite, a plaintext file, or log it.
- **Pentest Lab is engagement-gated, always.** `src/modules/pentest/scope.ts`
  is the one function deciding whether a target may be scanned at all — a
  target must be in an *active* engagement's declared scope, or be a device
  the user's own Home Network scan already found. No exception, no "just
  this once." If you touch this module, the gate function is the first
  thing to re-read and the first thing to keep tests passing for.
- **Minimum code.** Reuse existing patterns (see below) instead of writing
  module-specific UI. If a module needs new UI shape, the manifest contract
  grows a new generic field (see `src/core/module.ts`) rather than the panel
  growing a module-specific branch.

## Where things are

```
src/
  core/
    module.ts         — ModuleManifest contract + validateManifest()
                        (manifestChecks.ts: skill-ref checks; customizeChecks.ts:
                        customize/accent/ring/icon checks)
    ModulePanel.tsx   — the generic panel for `list` modules (pieces in core/panel/)
    db.ts             — shared SQLite handle (one load promise; retries once if the
                        plugin migrate fails, then ensureSchema) + logActivity(),
                        getLoadProblem/getDbDiagnostics (Settings > Database check)
    schema.ts         — pure SCHEMA_STATEMENTS (bootstrap mirror of migrations 17+),
                        ensureSchema, describeDb, redactPaths
    credentials.ts    — OS keychain wrapper (TS side)
    scheduler.ts      — opt-in per-module background refresh
  ui/                 — panel UI foundation shared by custom panels: kit/ (Table,
                        Tabs, Gauge, ... components), tokens.css + generic.css +
                        panels.css, prefs.ts/prefsStore.ts (per-module saved views
                        in SQLite `panel_prefs`), useModule (load/run/status),
                        useCustomize + Section/Sections, CustomizeDrawer +
                        drawer/*, QuickAdd, safeLink (http(s)-only openUrl),
                        useDebounced, useOption
  shell/              — solar-system map: orbit.ts (pure orbit math), mapLayout.ts,
                        mapDraw.ts, mapHit.ts, icons.ts (planet glyphs), moons.ts/
                        moonDraw.ts/badges.ts/badgeStore.ts/useBadges.ts (notification
                        moons), stars.ts/Sky.ts (starfield), motionPolicy.ts/
                        motionStore.ts/useMotionPolicy.ts, OrbitControls, StarMap,
                        Planet, SettingsPanel + settings/*; PanelRoute, ChromeRoute
                        (#/chrome/<id> strip), GameHud, layout.ts (pure clamp/tile/
                        cascade), layoutStore.ts (panel_layout + app_settings via
                        db.ts), settingsStore.ts, panelApi.ts
  modules/<name>/
    index.ts          — the module's ModuleManifest + its skills
    Panel.tsx, panelLogic.ts (+ .test.ts) — custom panel and its pure logic
    (other files)     — independently testable logic kept OUT of index.ts
  App.tsx             — imports every module (registers it) + mounts the shell

src-tauri/
  migrations/NN_<module>.sql — numbered SQL, versions 1..24 strictly ascending
                        (24 = mail; 17-24 idempotent `IF NOT EXISTS`); loaded by
                        src/migrations.rs (order must match version)
  capabilities/default.json — Tauri permissions; includes
                        `core:webview:allow-set-webview-focus` so chrome/panel
                        webviews can hand keyboard focus to each other (moves focus only)
  src/commands/       — Rust commands by area (backup, credentials, files,
                        mail + mail_fetch/body/ops/send, network, oauth, pentest, repo, system)
  src/panels/         — panel manager: every panel = a content webview + a
                        ~28px chrome webview (move/resize/close/focus),
                        moved/raised together; manager, restore, webview, geometry,
                        ids, state, persist, fullwindow, webguard (pure: web
                        allow-list, media permissions, title unread count)
  src/gamemode/       — mod.rs (enter/exit, commands, poll, emits `game-mode`),
                        decide.rs (pure), fullscreen.rs (cfg(windows) + stub)
  src/lib.rs          — wiring + invoke_handler list only
```

**Shell.** The main window is an orbiting solar system (canvas, `shell/orbit.ts`
math): planets = modules from the registry, placed on rings by `ring`, drawn
with `accent` + `icon`. A planet opens a floating panel through the panel
manager (Rust). Notification moons come from each module's `badge()` plus
`planet-badge` events (`shell/badges.ts`): **counts only, never message text**.
Star and orbit motion obey one motion policy (`motionPolicy.ts`): both stop in
game mode, when the window is hidden, or with reduced motion. Settings is a
panel with id `hub.settings` (`SettingsPanel`, opened from the HUD), not a
module. `app_settings` keys: `game_mode_auto`, `star_motion`, `orbit_motion`,
`orbit_speed`, `notif_moons`, `ignore_reduced_motion`, `restore_panels`, `appearance_defaults`. Layout
is persisted from the TS side in SQLite `panel_layout` / `app_settings` (Rust
returns `SavedPanel`, the frontend writes; call `clampToScreen` before
move/resize). **Game mode** (manual button or auto detection) pauses the
scheduler and destroys/suspends panels; auto detection is gated by the
persisted `game_mode_auto` toggle (default on).

## The module contract (read `src/core/module.ts` for the real types)

A module is a `ModuleManifest`: `id` (reverse-DNS, e.g. `"hub.notes"`),
`panel` (`"list"` = generic panel; `"custom"` = own React panel, requires `ui`; `"web"` with `web: { url, profile, hosts?, size?, min? }` for an embedded site with a persistent profile, https allow-list and Full window toggle; see modules/discord), `skills` (named async functions), and
`load()` (returns rows). Everything else is optional generic UI the panel
already knows how to render — **adding a new one of these is the
right move before writing bespoke UI**:

| Field | Renders as | Example |
|---|---|---|
| `quickAdd` | one text input + Add button | News: paste a feed URL |
| `actions` | zero-arg buttons | "Refresh quotes" |
| `rowAction` | one button per row | "Clone…" on a GitHub repo row |
| `credentialFields` | password inputs → OS keychain | GitHub PAT |
| `forms` | multi-field forms | Email compose, Pentest add-engagement |
| `schedule` | an opt-in "Auto-refresh" checkbox | News, Weather |
| `customize` | sections/options the user can show, hide, reorder, tune (customize drawer, saved views) | Notes, Finance |
| `ui` | lazy `() => import("./Panel")`; required for `panel: "custom"` | all custom panels |
| `badge` | `() => Promise<number>` count shown as a notification moon | Notes (unfiled) |
| `accent` / `ring` / `icon` | planet + panel colour (`#rrggbb`), orbit ring, glyph key in `shell/icons.ts` | every module |

`validateManifest()` rejects a module at registration time if any of these
reference a skill name that doesn't exist (or `accent`/`ring`/`icon`/`customize`
is malformed, or `custom` has no `ui`), so a typo fails loud, not silent.

**Custom panels** exist for notes, news, deals, pccare, weather, homenet,
github, finance, calendar, backup, clipboard, filesearch, youtube, chat, social, email. pentest
still uses the generic panel (redesigns planned). To add one:
1. `panel: "custom"` + `ui: () => import("./Panel")` + `accent`/`icon` in `index.ts`.
2. `Panel.tsx`: `useModule(module)` for load/run/status; build with `src/ui/kit`.
3. Wrap each user-hideable part in `<Section id="...">` inside `<Sections>`.
4. Declare the same ids in `customize.sections` (+ `options`) in the manifest.
5. Put decisions/formatting in `panelLogic.ts` (pure, no Tauri/React).
6. `panelLogic.test.ts`: test the logic, and that the manifest's section ids
   match the `<Section id>` values used in `Panel.tsx`.


**Standing rule (schema):** a new table needs BOTH a migration file
(`CREATE TABLE IF NOT EXISTS`) and a `SCHEMA_STATEMENTS` entry in
`src/core/schema.ts`; `schema.test.ts` enforces it. The SQL plugin only
migrates inside the first `Database.load` per process and drops its list if
that migrate fails (later loads succeed without migrating).

## Patterns already established — copy these, don't reinvent

- **RSS/Atom fetching + dedupe**: `news/rss.ts` (pure parser, tested) +
  `news/index.ts` (fetch/store). `deals/index.ts` reuses `news/rss.ts`
  directly rather than duplicating a parser — do the same for any future
  feed-based module.
- **OAuth2 loopback redirect**: The loopback-redirect catcher is a *generic* Rust
  command, `oauth_listen_once(port, timeout_secs)` — reused as-is by
  `social/connectors/` for Mastodon/Reddit on different ports. A new OAuth
  connector should reuse this command, not write a new one.
- **Multi-connector architecture**: `social/connectors/` — one
  `SocialConnector` interface (types.ts), one file per platform, listed in
  index.ts; `post` is optional (read-only where absent). Adding platform #5 is "write one connector, list it" — see that
  file's own comments before adding a 5th.
- **Preview-before-apply for anything destructive**: `pccare/index.ts`
  (temp-file cleanup; Apply deletes exactly the previewed paths). Never wire a
  delete straight to a button with no preview step. Backup restore is NOT yet
  an example (see known-incomplete): its panel only adds a confirm step.
- **Pure logic extracted for testability**: when a module's core decision
  (not its I/O) can be unit-tested without Tauri/DB, pull it into its own
  file and test it there — `pentest/scope.ts`, `news/rss.ts`,
  `youtube/channelUrl.ts` are the examples. The `index.ts` stays thin and
  Tauri-coupled; the extracted file stays pure and gets a `.test.ts`.

## Build & verify

```bash
npm install
npm run tauri dev          # full app, needs Tauri prerequisites installed
npx tsc --noEmit            # typecheck only, fast
npm run check:size          # file-size guard
npm run build                # typecheck + production frontend build
npm test                    # TS baseline (node --test)
node --test scripts/check-file-size.test.mjs
cd src-tauri && cargo test --lib   # Rust tests
```

446 TS tests + 4 size-guard tests + 60 Rust tests as of this commit. Run the
relevant ones after any change to `src/core/module.ts`, `*/rss.ts`,
`*/pkce.ts`, `pentest/scope.ts`, `src/shell/*.ts`, `src/ui/*.ts`, `*/panelLogic.ts`, or `src-tauri/src/panels`.

**File-size rule:** no .ts/.tsx/.rs file over ~150 lines (`*.test.ts` and Rust
code after `#[cfg(test)]` are exempt). `npm run check:size` enforces it;
`scripts/check-file-size.mjs` has an ALLOW list of files awaiting their own
split (finance, pentest). Never add to it; shrink it.

**Updates:** Settings > Updates (`shell/updater.ts`) checks GitHub releases
only on a button press (no background call). Releases are tag-driven (`v*`):
CI stamps the version from the tag, signs with secret `TAURI_SIGNING_PRIVATE_KEY`
and publishes the installer, `.sig` and `latest.json` (`scripts/make-latest-json.mjs`).

## What's known-incomplete (check before assuming a gap is a bug)

- On some existing databases the plugin migration fails at the first load
  (root cause not yet identified). The app then runs in compatibility mode
  (startup banner; Settings > Database check shows details), and future
  migrations 20+ will not apply on such a DB unless mirrored in
  `SCHEMA_STATEMENTS`.
- Only the custom panels above have the new UI; the rest is default styling.
- `social/connectors/` Bluesky and X connectors are `authType: "manual"`
  (no OAuth) — Bluesky because AT Protocol has no public-client OAuth yet,
  X because its free API tier has no usable read endpoint (stubbed on
  purpose, throws a clear error).
- Nothing in this repo has been through a real Rust compile on Windows yet
  as of early commits — if you're asked to debug a build failure, check
  `Cargo.toml` version pins first (one was already wrong once: `imap = "3"`
  doesn't exist as a stable release, fixed to `"2"`).
- A full security review of the credential/OAuth/IMAP code hasn't happened
  yet — flagged as a known TODO, not a claim that it's been checked.
- Backup's folder-picker restore applies the picked folder without showing it
  first; needs a pick-folder skill so the path is shown and confirmed.
- Rust `restore_database` copies only the files present in the backup, leaves
  stale `-wal`/`-shm` next to the restored db, copies over an open DB, and does
  no validation; needs its own fix.
- pentest is not yet redesigned (generic panel).
- Email (`modules/email`): custom panel, multi-account IMAP/SMTP, passwords only in keychain (`pw:<accountId>`), cache in SQLite (`mail_*`, migration 24), HTML sanitized by `sanitize.ts` into a `sandbox=""` iframe. No OAuth (Gmail/iCloud need app passwords). No attachment download, drafts saving or threading. The Rust mail code (mail*.rs, `mail-parser` crate) compiles and its pure parts are unit-tested, but has never run against a live mail server.
- Discord panel is built (modules/discord) but media permissions, the screen-share
  picker/Go Live and the unread moon are unverified on Windows; checklist in
  `docs/superpowers/spikes/2026-10-29-discord-checklist.md`.
- Chat (`modules/chat`, `hub.chat`): sockets run in the panel webview only while it is open. Twitch read (anon IRC) + send (pasted OAuth token in keychain); Kick read via Pusher (channel lookup may be Cloudflare-blocked), read-only; destiny.gg read-only; any other site (incl. iCanHazChat) = `embed` iframe / "Open as its own panel". 7TV/BTTV/FFZ via `emoteSets.ts`. NONE of the live protocols/endpoints have been run against the real sites (sandbox had no outbound access). Add a site = one file in `chat/connectors/` + list it in `connectors/index.ts` (+ parser in `rooms.ts`).
- Specified in `docs/superpowers/specs/` but not built: skills/MCP hub, browser bot.
- Data semantics: Finance day-change is session-based (DB keeps only the latest
  price); Home Network "new" means new this session; Calendar "overdue" means
  unfiled notes.
- Nothing in WebView2/Windows has been run by the assistant, only Chromium with
  Tauri stubbed plus unit tests. GUI behavior (panels, chrome strip, `emitTo`
  between webviews, moons, orbit feel) is unverified until run on Windows.
- Webview overlap spike not run on Windows
  (`docs/superpowers/spikes/2026-10-28-webview-spike.md`); raising a panel is
  close + re-create (reloads the page; web profiles keep sessions).
- Game mode: GPU-load trigger not implemented (no portable source); Windows
  fullscreen detection and all webview code are compile-checked only, never
  run in a real window. No local-model unload yet (bot not built).
- Sub-projects 2-4 (Discord/YouTube webviews, multi-site chat, browser bot
  with shared learning kernel and bundled skill packs) are deferred in
  `docs/superpowers/specs/2026-10-28-core-shell-design.md` (each gets its own
  spec before work starts).
