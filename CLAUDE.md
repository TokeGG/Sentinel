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
    connect/          — one-click account Connect (Settings > Accounts): pure PKCE/state/URL/token/refresh,
                        provider registry (providers.ts), loopback via hardened oauth_listen_once (127.0.0.1,
                        state, path) or device code (GitHub/Twitch); tokens keychain-only (`hub.accounts`), metadata
                        in `accounts` (migration 36); client IDs clients.ts (empty) or app_settings `client_id:<group>`;
                        setup steps docs/ACCOUNTS.md. Use getAccessToken(provider) instead of new OAuth code.
                        All connect HTTP goes through Rust `oauth_http` (no webview Origin); failures -> diagnose.ts
                        (message + next step), Settings "Test" = checkProvider (client ID format + endpoints).
    taste/            — local taste layer (pure model/features/order + store + useTaste, migration 35); UI in ui/TasteButtons|WhyBadge|TasteBar|TasteDrawer;
                        per-module profile of decayed feature weights, `app_settings` `taste_off:<module>`; adopted by news, deals, social, congress, github, youtube
    scheduler.ts      — opt-in per-module background refresh
    categories.ts     — panel-bot categories (manifest `category`, default by id via categoryOf); skills tag `category:` in SKILL.md
    assist/           — pure Ask-bar prompt/parse (ui/AssistBar.tsx + ui/useAssist.ts, mounted generically by PanelRoute):
                        rows cited [rN], category skills, knowledge, opt-in data sources; suggests only safe panel actions, run after confirm
    knowledge/        — per-category KB (kb_entries, migration 45), BM25 via bot/knowledge.ts; Settings > Knowledge; Good/Bad saves examples
    datasources/      — built-in public APIs per category (URL builder + pure parser, fixtures.ts); off by default, Settings > Data sources (Test)
    modSettings.ts    — generic per-module settings (Settings > Modules): Ask bar + link mode in `modset:<id>`; density/refresh/options in the active view
    search/           — palette search: fuzzy.ts (pure matcher), registry.ts (registerSearchProvider/searchAll), rowHits.ts (load() rows -> titles)
    crypto/           — envelope.ts (PBKDF2 + AES-GCM export file), exportLogic.ts (which tables travel, import plan)
  ui/                 — panel UI foundation shared by custom panels: kit/ (Table,
                        Tabs, Gauge, ... components), tokens.css + generic.css +
                        panels.css, prefs.ts/prefsStore.ts (per-module saved views
                        in SQLite `panel_prefs`), useModule (load/run/status),
                        useCustomize + Section/Sections, CustomizeDrawer +
                        drawer/*, QuickAdd, safeLink (http(s)-only openUrl),
                        useDebounced, useOption
  shell/              — solar-system map: orbit.ts (pure orbit math), mapLayout.ts, planetDrag.ts/planetPosStore.ts (drag a planet -> nearest ring + phase, app_settings `planet_pos`; no parallax, no pan),
                        snap/ (Win11-style snapping: zones.ts pure edge zones/Snap Layouts/assist/shared-divider resize, dragSnap.ts, SnapPreview, SnapLayouts panel `hub.snap`, Ctrl+Alt+Z; `snap_prefs` mirrored to localStorage),
                        mapDraw.ts, mapHit.ts, icons.ts (planet glyphs), moons.ts/
                        moonDraw.ts/badges.ts/badgeStore.ts/useBadges.ts (notification
                        moons), stars.ts/Sky.ts (starfield), motionPolicy.ts/
                        motionStore.ts/useMotionPolicy.ts, OrbitControls, StarMap,
                        Planet, SettingsPanel + settings/*; PanelRoute, ChromeRoute
                        (#/chrome/<id> strip), GameHud, layout.ts (pure clamp/tile/
                        cascade), layoutStore.ts (panel_layout + app_settings via
                        db.ts), settingsStore.ts, panelApi.ts
  modules/bot/        — browser-bot learning kernel + agent loop (no manifest/driver/UI yet): kernel/
                        (brain, nudge, variants, brainFile: generic mirror of mmoarena's botbrain/
                        outplay learning; JSON shape = its botbrain.json), brainSpecs.ts, mistakes.ts,
                        llm.ts (Ollama 127.0.0.1:11434 only), agent.ts, knowledge.ts, learn.ts, sql.ts/store.ts
  modules/<name>/
    index.ts          — the module's ModuleManifest + its skills
    Panel.tsx, panelLogic.ts (+ .test.ts) — custom panel and its pure logic
    (other files)     — independently testable logic kept OUT of index.ts
  App.tsx             — imports every module (registers it) + mounts the shell

src-tauri/
  migrations/NN_<module>.sql — numbered SQL, versions 1..43 strictly ascending (43 = browser) (31 = congress, 32 = calendar_items, 36 = accounts, 37 = notes/calendar extras + clip_pins)
                        (38 = mail/youtube/chat/social extras; 44 = kb_entries; 45 = lab_lessons/lab_certs/lab_cards (mirror core/schemaLearn.ts); 41 = bot workflows/jobs/site notes; 26 = social_post_meta, 27 = skills/mcp, 28 = bot, 29 = cloned_projects, 30 = youtube_seen/later/signal; 17-30 idempotent `IF NOT EXISTS`); loaded by
                        src/migrations.rs (order must match version)
  capabilities/default.json — Tauri permissions; includes
                        `core:webview:allow-set-webview-focus` so chrome/panel
                        webviews can hand keyboard focus to each other (moves focus only)
  src/bot/            — browser driver for hub.bot: window.rs (`bot-browser` window, own profile
                        `profiles/bot`, hidden by default, NO IPC capability), session.rs (pending
                        commands -> `bot-result` events), chunk.rs (title-channel framing), policy.rs
                        (nav allow/deny), script.rs + driver.js (injected `window.__sb`)
  src/commands/       — Rust commands by area (backup, credentials, files,
                        mail + mail_fetch/body/ops/send, mcp + mcp_proc/rpc (stdio MCP client), network,
                        oauth, pentest, repo (async git clone, timeout+kill), cloned (project_info/open_cloned/delete_cloned_dir, git-clone-only guard), skills_fs (app-owned skills dir), system)
  src/panels/         — panel manager: every panel = a content webview + a
                        ~28px chrome webview (move/resize/close/focus),
                        moved/raised together; manager, restore, webview, geometry,
                        ids, state, persist, fullwindow, webguard (pure: web
                        allow-list, media permissions, title unread count)
  src/gamemode/       — mod.rs (enter/exit, commands, poll, emits `game-mode`),
                        decide.rs (pure), fullscreen.rs (cfg(windows) + stub)
  src/lib.rs          — wiring + invoke_handler list only
```

**Shell.** The main window is a 3D orbiting solar system (canvas 2D: `proj.ts` tilted-ring projection + perspective, `depth.ts` sort/pick, `labels.ts` label collision, `bodies.ts`/`bodyArt.ts`/`sunDraw.ts` cached sprites; planets not draggable, pan/zoom/pinch only; `shell/orbit.ts`
math). The sun opens the Master Hub (`hub.master`, `MasterHub.tsx`: missed counts per module, mark-all-read, snooze, DND, history from `notif_log` migration 33; rules in `notifLogic.ts`, main-window feed `useNotifLog.ts`/`notifStore.ts`); Settings is the title-bar gear; quiet hours live in Settings > Notifications: planets = modules from the registry, placed on rings by `ring`, drawn
with `accent` + `icon`. A planet opens a floating panel through the panel
manager (Rust). Notification moons come from each module's `badge()` plus
`planet-badge` events (`shell/badges.ts`): **counts only, never message text**.
Star and orbit motion obey one motion policy (`motionPolicy.ts`): both stop in
game mode, when the window is hidden, or with reduced motion. Settings is a
panel with id `hub.settings` (`SettingsPanel`, opened from the HUD), not a
module. `app_settings` keys: `game_mode_auto`, `star_motion`, `orbit_motion`,
`orbit_speed`, `notif_moons`, `ignore_reduced_motion`, `notif_snooze`/`notif_dnd`/`notif_quiet`/`notif_read` (JSON), `restore_panels`, `appearance_defaults`, desktop batch (`shell/desk/store.ts`, all opt-in/off): `hotkey_summon`, `hotkey_capture`, `notif_toasts`, `theme`, `sky_clock`, `ambient_audio`, `panel_layouts`/`panel_pins` (JSON), `launch_layout`, `tour_done`. Layout
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
| `forms` | multi-field forms | Email compose |
| `schedule` | an opt-in "Auto-refresh" checkbox | News, Weather |
| `customize` | sections/options the user can show, hide, reorder, tune (customize drawer, saved views) | Notes, Finance |
| `ui` | lazy `() => import("./Panel")`; required for `panel: "custom"` | all custom panels |
| `badge` | `() => Promise<number>` count shown as a notification moon | Notes (unfiled) |
| `search` | `(q) => Promise<{title, subtitle?, id?}[]>` hits in Ctrl+K (absent = titles of `load()` rows) | any |
| `accent` / `ring` / `icon` | planet + panel colour (`#rrggbb`), orbit ring, glyph key in `shell/icons.ts` | every module |

`validateManifest()` rejects a module at registration time if any of these
reference a skill name that doesn't exist (or `accent`/`ring`/`icon`/`customize`
is malformed, or `custom` has no `ui`), so a typo fails loud, not silent.

**Custom panels** exist for games, media, bot, congress, notes, news, deals, pccare, weather, homenet,
github, finance, calendar, backup, clipboard, filesearch, youtube, chat, social, email, skills, pentest. To add one:
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

1178 TS tests + 4 size-guard tests + 148 Rust tests as of this commit. Run the
relevant ones after any change to `src/core/module.ts`, `*/rss.ts`,
`*/pkce.ts`, `pentest/scope.ts`, `src/shell/*.ts`, `src/ui/*.ts`, `*/panelLogic.ts`, or `src-tauri/src/panels`.

**File-size rule:** no .ts/.tsx/.rs file over ~150 lines (`*.test.ts` and Rust
code after `#[cfg(test)]` are exempt). `npm run check:size` enforces it;
`scripts/check-file-size.mjs` has an ALLOW list of files awaiting their own
split. Never add to it; shrink it.

**Design system v2** (details: `docs/STYLE.md`). Tokens live only in `src/ui/tokens.css`
(layers base/raised/overlay, 8px spacing, radii, type scale, elevation). A panel's colour
comes from its manifest `accent` (unique per module, enforced by `src/ui/accents.test.ts`):
PanelShell/ChromeRoute set `--accent` and tokens derive `--accent-soft/-line/-text`, the
tinted `--surface`, `--line`. A new panel just sets `accent` in `index.ts`; use only tokens.
The main window is frameless (`decorations:false`): `shell/TitleBar.tsx` is the one title bar
(drag region, min/max/close, HUD toolbar inside); panels live below it (`TITLEBAR_H`,
`clientRect(..., top)`), and `reclampPanels` re-clamps them on resize/maximise. The panel
chrome strip (24px, transparent webview, rounded top) is `shell/ChromeRoute.tsx`; CSS in `shell/shell.css`.

**Updates:** Settings > Updates (`shell/updater.ts`) checks GitHub releases
only on a button press (no background call). Releases are tag-driven (`v*`):
CI stamps the version from the tag, signs with secret `TAURI_SIGNING_PRIVATE_KEY`
and publishes the installer, `.sig` and `latest.json` (`scripts/make-latest-json.mjs`).

## What's known-incomplete (check before assuming a gap is a bug)

- In-app browser (`modules/browser`, `hub.browser`; Rust `panels/browser.rs`, `browser_os.rs`): tabs are child webviews `embed-hub_browser-tab<n>` (profile `browser`, private = incognito, no IPC, any http(s), new window = new tab, downloads to Downloads), page rect `browser_rect` (BROWSER_TOP/LEFT synced with `layout.ts`). Links route via `ui/openLink.ts` (`links_open_in` app|system); news/deals/congress/social/connect call sites still use the opener directly. Opera import reads `%APPDATA%/Opera Software/Opera (GX) Stable/Bookmarks`. Only the active tab survives a raise (reloads). Snap preview is drawn in the main webview (panels can cover it). All unverified on Windows/WebView2.

- Account Connect (`core/connect`, Settings > Accounts): Gmail/Outlook XOAUTH2 (email preset `<base>:oauth`, token per call, Rust never stores it), Mastodon (dynamic registration), Reddit, Twitch chat send, GitHub device flow, YouTube subscription import. Old pasted tokens/PATs stay as fallbacks. No client IDs ship; NONE of the flows has run against the real providers, loopback/browser handoff unverified on Windows.
- Notes tabs (Inbox|Notebook|Journal|Graph|Cards|Snippets|Vault|Clip; `ui/SectionTabs` groups customize sections) and Calendar tabs (Agenda|Calendar|Reminders|Habits|Focus|Contacts|Money|Read later; tables in migration 37): reminders float only while the panel is open; focus writes `app_settings` `focus_until` (nothing reads it yet); clipper/vault untested on real pages/files. Clipboard pins are in `clip_pins`; Weather has a 5-day forecast; Backup health uses `app_settings` `backup_last`. GUI never run.
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
- Pentest (`modules/pentest`): custom terminal-style panel. `scope.ts` (+ scopeAddr/Rules/Window/Decl)
  is still the one gate: includes = host/IP, CIDR (min /8, /32 v6), `*.wildcard` (not the apex);
  exclusions always win; status must be active and inside the UTC window. `runner.ts`/`api.ts`
  `runTool(engagementId, toolId, target)` is the only way to run; only the built-in `port-scan`
  is registered (no external programs, no other tools: that needs an explicit decision). Rust
  `tcp_port_scan` re-checks with a mirror (`commands/pentest_gate.rs`, `pentest_rule.rs`);
  both sides are tested against `gateVectors.json`, so change the gate in both. Tables: migration 25.
  Never run in a real window or against a real network yet.
  Beginner layer: `guide.ts` (5-step setup, app_settings `lab_guide`, simple/advanced `lab_mode`; simple hides bot/notebook/timeline/intel/replay), `next.ts` (What next card + "My home lab" template from Home Network IPs, still draft until Activate), `explain.ts`/`portInfo.ts`/`glossary.ts` (plain-English run explainers, tooltips). Learn tab = `learn/` (lessons are `learn/lessons/*.md` with a `## Quiz`, cert trackers `certs.ts` = high-level domains only, flashcards reuse notes/sm2.ts, practice links). Harness Lab scenarios: `scripts/bot-harness/lab.mjs`. GUI unverified.
  Lab extras (migration 34): registered tools `port-scan` (profiles quick/common/full, paced), `fingerprint`, `web-check`, `dns`,
  each with a Rust command re-checking the gate (`tcp_port_scan`, `tcp_banner_grab`, `web_check`, `dns_lookup`); runs keep their options
  (`pentest_run_args`) so `replay`/retest re-run them through the gate again. Tabs Terminal|Bot|Notebook|Checklist|Timeline; Bot tab = Lab mode
  (`labBotLogic.ts`/`labBot.ts`: tools via runTool/MCP gate only, goto in-scope only, every action logged as `bot:*` run rows). Home Network
  "Send to Lab" = `pentest/api addScopeEntry`. Offline CVE data, evidence hashes, scope drift are pure files with tests. All unverified on Windows/real targets.
- Email (`modules/email`): custom panel, multi-account IMAP/SMTP, passwords only in keychain (`pw:<accountId>`), cache in SQLite (`mail_*`, migration 24), HTML sanitized by `sanitize.ts` into a `sandbox=""` iframe. Gmail/Outlook can also sign in via core/connect (XOAUTH2); iCloud/Yahoo need app passwords. No attachment download, drafts saving or threading. The Rust mail code (mail*.rs, `mail-parser` crate) compiles and its pure parts are unit-tested, but has never run against a live mail server.
- Social per-post actions (like / boost-repost / inline reply; optional `like`/`unlike`/`share`/`unshare`/`reply` on `SocialConnector`, absent = button hidden; request builders in `social/connectors/actions.ts`, optimistic UI in `useActions.ts`, ids/state in `social_post_meta`): Bluesky, Mastodon (scopes now incl. write:favourites) and Reddit (scopes now incl. vote submit; no repost). Older sign-ins must "Connect" again. X stays a stub. Lists/mutes (`muteLists.ts`, migration 38) and an on-demand Inbox (`fetchInbox` on Bluesky/Mastodon; Reddit needs a privatemessages scope, not added). Never run against the live APIs.
- Browser bot (`modules/bot`): only the pure kernel, agent loop, prompt/parser, notes retrieval and store exist (tested with fakes). No `BrowserDriver` (Rust), no manifest/UI, no URL-note fetching, nothing wires `store.ts` or `toolGate` yet; never run against a real Ollama.
- GitHub "Cloned repos" section (`github/ClonedSection.tsx`, `clones.ts`, `clonedLogic.ts`; table `cloned_projects`, migration 29; old `cloned_repos` only read for the marker). Open folder = Explorer, VS Code via `code.cmd` on PATH; Delete files needs a path preview + confirm. Rust clone/open/delete are unit-tested for pure parts only; never run against real git/Explorer on Windows.
- YouTube (`modules/youtube`): YouTube-style panel (sidebar, chips, card grid, Watch view with Up next). History is ONE row per video in `youtube_seen` (migration 30; old `youtube_watched` is only read once by the idempotent `BACKFILL_SQL`); `youtube_later` = Watch later, `youtube_signal` = like/dislike/not-interested that `recommend.ts` subtracts. Feeds carry no duration, so the card duration badge never shows yet. The Watch view "Chat" button adds the video's live chat (`chat` connector `youtube`, iframe of `live_chat?v=&embed_domain=`) via the chat `add_room` skill and a `chat-rooms-changed` event. Extras (migration 38, `extras.ts`/`extrasStore.ts`/`useYt.ts`): playlists, channel groups (`grp:` chips), speed per channel + progress via IFrame-API postMessage (`enablejsapi=1`; unverified), Continue watching, in-panel mini player, upload moons (`badge`), Tune/For-you, watch-later tray. Never run in a real window; YouTube may refuse the chat frame (use "Open as its own panel"). Pop-out player = non-module panel `hub.ytplayer` (`PopPlayer.tsx`, `popOut.ts`; drag the mini player bar out or press Pop out; pinned via `panel_pins`; queue in app_settings `yt_queue` + `yt-queue` emitTo, pure `queue.ts`; autoplays next on IFrame state 0; height re-locked to 16:9 after a grip resize; raise re-creates the webview so playback resumes from the saved position). Watch player resize handle (`ResizablePlayer.tsx`, `yt_player_size`). Live view/"Live now" row (`live.ts` parser of `/channel/<id>/live`, `liveStore.ts`, app_settings `yt_live`; `check_live` button; schedule skill is now `refresh_all` = feeds + live). Live detection markers, state-0 messages, cross-webview events all unverified live.
- Taste layer (`core/taste`) and Deals' preloaded sources (`deals/defaults.ts`, seeded once into an empty `deal_sources`; `deal_source_meta` holds category/enabled) have never run against real feeds; the feed URLs are unverified (Reddit/Steam/DealNews/Humble may need other URLs or headers). Curated catalogs (News `news/catalog/*` 8 categories, Deals `deals/catalog/lists.ts` 5 categories + 7 store pages, YouTube `youtube/suggested.ts` @handles) seed only missing urls; state (status unverified/working/broken, off, removed = never re-seeded) is JSON in `app_settings` `src_state:<news|deals>` (`news/sources/*`, generic `SourceList` with Check sources). No catalog URL has been fetched from here. YouTube has no Tune drawer yet (shared score is one term in `recommend`).
- Discord panel is built (modules/discord) but media permissions, the screen-share
  picker/Go Live and the unread moon are unverified on Windows; checklist in
  `docs/superpowers/spikes/2026-10-29-discord-checklist.md`.
- Chat (`modules/chat`, `hub.chat`): sockets run in the panel webview only while it is open. Twitch read (anon IRC) + send (pasted OAuth token in keychain); Kick read via Pusher (channel lookup may be Cloudflare-blocked), read-only; destiny.gg read-only; any other site (incl. iCanHazChat) = `embed` iframe / "Open as its own panel". 7TV/BTTV/FFZ via `emoteSets.ts`. NONE of the live protocols/endpoints have been run against the real sites (sandbox had no outbound access). Owner reported Kick and d.gg not connecting on Windows: each room now has a copyable Connection log (`connLog.ts`), a status dot, Retry, and a one-click embed fallback (`embedFallback`); Kick tries 3 endpoints with browser headers (`kickLookup.ts`) or a manual chatroom id (target `slug@id`); causes (Cloudflare 403, d.gg Origin check) remain unconfirmed until the log is read from a real run. Extras (`chatExtras.ts`, `prefsContext.ts`, migration 38): nick/colour, ignore/word filters/highlights, emote picker, mention log (always, 500) + searchable logs (opt-in option, capped), multiview = `players` option (Twitch/Kick player iframes; unverified). Add a site = one file in `chat/connectors/` + list it in `connectors/index.ts` (+ parser in `rooms.ts`).
- Social tabs `Feed | X | Facebook | Instagram` (`modules/social/embedSites.ts`, Rust `panels/embed.rs`): the three sites are embedded child webviews `embed-<panel>-<site>` (own profile, web-panel guards, NO IPC, only the active one shown; tab bar = `EMBED_TAB_H` shared TS/Rust). They replace the old x/facebook/instagram planets (saved layouts for them are skipped on restore). No API (no feed merge, like or comment from our UI). Embed alignment under the tab bar, DPI offsets, raise/game-mode recreation and z-order vs the grip are unverified on Windows.
- Skills & MCP hub (`modules/skills`, `hub.skills`): GitHub install (pinned SHA, confirm screen, files under app data `skills/<skill|mcp>/<id>`), `registry.ts` (`listSkills`/`getSkill`), `mcp.ts` (`listMcpTools`/`callMcpTool`, Rust stdio client; flagged pentest/scan/exploit tools need an in-scope engagement target via `pentest/api` `previewGate`; no Rust-side re-check), Ollama model pick (`local_model`). MCP needs the user's own Node/Python (npx/uvx); servers start only when flipped on, stop on disable/exit/game mode. Bundled skills: `resources/skills/*/SKILL.md` (18, general purpose; `bundledSkills.test.ts`); Marketplace section = static `marketplace.ts` suggestions (unverified, install via the same confirm flow). NEVER run against real GitHub or a real MCP server (only unit tests and a fake stdio server); GUI unverified.
- Ollama: every call goes through Rust `ollama_request` (127.0.0.1:11434, fixed paths; the http plugin always sends the webview Origin, which Ollama 403s) via `bot/ollamaFetch.ts`; status words in `bot/ollamaStatus.ts`. Social "Following & Likes" tab (`social/follows.ts` + `followsApi.ts`) and Chat Kick/d.gg embed-by-default (`defaultEmbed`) are unverified live.
- Browser bot (`modules/bot`, `hub.bot`; Rust `src-tauri/src/bot/`): runs only on the panel Run button; local Ollama model only; closes on game mode, app exit and panel close. The Rust driver is compile-checked only: the WebView2 `document.title` result channel, hidden-webview behaviour (timer throttling), popups and downloads are unverified on Windows. No GPU or local-model unload yet. Tool (MCP) actions use the existing gate and the bot has no engagement, so pentest-flagged tools are always refused.
- Bot extras (migration 41 `41_bot_extras.sql`, mirror `core/schemaBotExtras.ts`): task plan before acting (`plan.ts`, prompt in `prompt.ts`), dry run (outcome `dry`), approve-each-step, explain-why (`why` per step), goal templates (`templates.ts`), saved workflows (`workflow.ts`: steps keep role+label, replayed as a scripted Llm through the same agent gates/confirms), teach-by-demo (driver.js `recStart/recTake/recStop`, never password/cc/otp fields; recorded Send/Buy/Delete/Log in clicks replay as irreversible types; `demo.ts`), scheduled jobs (`jobs.ts`/`jobRunner.ts`: manifest `schedule` run_due_jobs, needs the module Auto-refresh toggle AND the per-job switch, both off by default; hidden, irreversible actions always denied; `bot_busy` lock in app_settings), site notebook (`siteNotes.ts`, fed per host into prompts), Lab has its own brain class `lab` (share/export both via brainFile), weekly summary (`weekly.ts`, snapshot `snap:browser`), starter notes seeded once (`starterNotes.ts`). Shipped brain defaults retuned for local 7-8B models (rationale in `brainSpecs.ts`). Harness: `node --experimental-strip-types scripts/bot-harness/run.mjs` (Playwright Chromium + real driver.js/driverCore/agent, scripted model, fixture pages; not in npm test). Screenshot evidence from the bot browser is NOT built: Tauri exposes no webview capture; it would need WebView2 `CapturePreview` via `with_webview` on Windows. Jobs, demo recording across sites and all GUI unverified on Windows/real Ollama.
- Congress (`modules/congress`, manifest NOT registered: rendered as the News panel's Congress tab via `news/CongressTab.tsx`; News carries its skills + moon; no auto-refresh): Sync errors name URL/status/body (`apiResult.ts`); members page GovTrack `role` by 300, fallback `legislators.ts` (unitedstates/congress-legislators JSON, GovTrack ids). Sync button reads the GovTrack API v2 (bills, votes, current roles; no key). Parsers are tested only against hand-written fixtures; NEVER run against the live GovTrack API, so field names/limits are unverified. Follows + "UPDATED" moon (counts only) are local (`congress_follows`). Finance's own congress trades still use the separate STOCK Act S3 datasets (unverified, may be offline).
- Calendar (`modules/calendar`): own events/tasks in `calendar_items` (migration 32), natural-language quick add (`quickParse.ts`), repeat daily/weekly/monthly (`recur.ts`), ICS import/export (`ics.ts`: VEVENT only, TZID read as local, no VTODO). Any entry (agenda, tasks, Views chips, time blocks) opens a detail card (`ItemCard.tsx`, `CardCtx`; links via pure `links.ts` + `ui/openLink`). Never run in a real window. Delete/remove with a two-step `ui/ConfirmButton` exists in notes, finance, news, deals, homenet, clipboard, filesearch, weather, backup (Rust `delete_backup`), github (dismiss); no undo toast.
- Feeds/money extras (migration 39 `39_feeds_finance.sql`, mirror `core/schemaFeeds.ts`): News topics (feed taste as likes), source tag/reliability, read later + highlights, duplicate grouping, opt-in preset feeds (games/patch notes/ESPN sports ticker), podcast `<audio>` from enclosures (`news/extras.ts`, `store.ts`); Deals price history + fair badge, promo-code collector, wishlist hits moon, coupons (`deals/extras.ts`, `extraStore.ts`); Finance groups, alerts moon (checked after refresh), lots/crypto, budgets (spend from Calendar `expenses`), bills (also Calendar `add_item` task), vault (data URL <= 2 MB in SQLite) (`finance/money.ts`, `extraStore.ts`, `Tools*.tsx`); Congress My reps (`app_settings` `congress_my_seat`, GovTrack `vote_voter`) + followed-bill "what changed" (`congress/reps.ts`, `repStore.ts`). Preset/ESPN/Steam URLs, vote_voter fields and all GUI unverified live.
- PC/Network/Dev batch (migration 40 `40_pc_net_dev.sql`, mirror `core/schemaPcNet.ts`; Rust `commands/pc_*.rs`, `net_tools.rs`, `git_tools.rs`, all shell-outs via `pc_cmd::run_fixed` with fixed args): PC Care Tools tabs (`pccare/tools/*`): startup manager (StartupApproved flag via `reg`, reversible), disk treemap/largest files (`treemap.ts` squarified), duplicates (size+SHA-256, Recycle Bin via `trash`), processes (confirm kill, name re-checked) + sensors ("not available" if none), power plans (`powercfg`), pending updates/problem devices (PowerShell Update COM + `pnputil`, best effort), mic/camera/location consent audit, download/screenshot sorter (`sorter.ts` plan, Rust `apply_moves` re-checks), manual speed test (Cloudflare 25 MB, `pc_speed_tests`), listening ports (`netstat`), Wi-Fi (`netsh`, keys never read), browser cache clear (known dirs by id), hash checker, Pwned Passwords range check (5-char SHA-1 prefix only). Home Network: icons (`net_device_style`), pings (`net_uptime`, manual + opt-in schedule), WOL, port changes between scans, SVG map + router link (`default_gateway`), change events (`net_events`, new-device moon). GitHub: inbox, CI moon (in memory, manual), git status, terminal, gists, commit stats, README draft (Ollama 127.0.0.1), secret scanner (redacted). ALL Windows commands/registry/netsh/powercfg/WOL/trash and the live APIs are unverified; only parsers/pure logic are tested.
- Games (`modules/games`, `hub.games`, migration 42 `game_meta`/`game_news`, mirror `core/schemaGames.ts`): Rust `game_manifests`/`steam_app_manifests` (`commands/games.rs`, read-only, bounded; Windows paths only, empty elsewhere) feed pure `vdf.ts`/`epic.ts`; launch = `steam://rungameid/<id>` / `com.epicgames.launcher://apps/...` via opener (allow-listed in capabilities); recently played = Steam `LastPlayed` or our own launches; Steam news RSS per favourite/recent app (button or opt-in schedule), moon = unseen count. Media (`modules/media`, `hub.media`, `media_shows`): now playing is a STUB (`commands/media_local.rs` `now_playing`; WinRT needs the `windows` crate, not a dep), Twitch live follows (Helix `streams/followed`; Twitch provider scope now includes `user:read:follows`, old sign-ins must Connect again; Chat button = chat `add_room`), TVmaze show tracker (+ manual date, To calendar = calendar `add_item`), image folder grid (`list_dir_files` + bounded `read_image_data` data URL <= 12 MB), ESPN scoreboard on button press only. All live endpoints, launch URIs and GUI unverified.
- Ask bar / knowledge / data sources / Settings > Modules: never run against a real Ollama or the live APIs (parsers tested on hand-written fixtures only); view-based module settings apply when the panel reopens.
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
- Desktop batch (`src/shell/desk/`, Rust `src-tauri/src/desktop/`): Ctrl+K palette (`hub.palette`, providers.ts = panels/actions/commands/settings/content), quick capture (`hub.capture`, any module's `capture_note` skill), `hub.briefing`, `hub.help` + first-run Tour, named layouts/tile/snap/focus mode/pins/back-forward/reopen (`layoutOps.ts`, all panel commands go through the `shell-cmd` event to main), tray (unread total only), opt-in global hotkeys, autostart (off), Web Notification toasts (counts only), themes/day-night tint, ambient noise, encrypted export (Settings > Encrypted export, preview before apply). Pin = re-raise after other panels focus (raise re-creates the webview), focus mode closes others without forgetting their rows. NONE run on Windows: tray, global-shortcut, autostart, Notification API in WebView2, multi-monitor move are compile-checked only.
- Sub-projects 2-4 (Discord/YouTube webviews, multi-site chat, browser bot
  with shared learning kernel and bundled skill packs) are deferred in
  `docs/superpowers/specs/2026-10-28-core-shell-design.md` (each gets its own
  spec before work starts).
