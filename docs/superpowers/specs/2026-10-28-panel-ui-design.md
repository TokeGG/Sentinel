# Panel UI System — Design

Follows the core shell (`2026-10-28-core-shell-design.md`). Source of the visuals: the panel design gallery the user reviewed (artifact "Sentinel Panel Designs"), with the user's changes below.

## Goals
1. Every module gets its own panel look and layout, showing the information that module needs.
2. Every panel is customizable (colors and look, show/hide parts, rearrange parts, saved layouts, plus the extras below).
3. Shared building blocks so the panels feel like one app and stay small.
4. Star map looks like a night sky and slowly rotates.

## User decisions (from review)
- Pentest Lab: a **command center** where tools are picked from cards, not a terminal.
- Social: a **Twitter-style unified feed** with every connected account mixed in one timeline.
- Email: a **real mail app** (accounts, folders with counts, search, reader, compose window).
- YouTube: a **customizable home** (widgets, grid/list/theater, saved layouts).
- All other gallery designs accepted as shown.
- Customization on every panel: colors and look, show/hide parts, rearrange parts, saved layouts, and other useful options (listed below).

## Architecture
- **UI kit** `src/ui/`: `PanelShell`, `Tile`, `Chip`, `Row`, `Gauge`, `Spark`, `Tabs`, `Table`, `StatusLine`, `ErrorLine`, `EmptyState`. All colors and spacing come from CSS variables (`--accent`, `--density`, `--font-scale`, panel surface tokens) so customization is just variable changes.
- **Per-module panels:** `panel: "custom"` (already reserved in the manifest) plus `ui: () => import("./Panel")`. Modules without a custom panel keep rendering through the generic `ModulePanel` until migrated, so migration is incremental and nothing breaks.
- **Customization schema (generic):** manifest gains `customize?: { sections: {id,label,default}[]; options?: {key,label,type,default}[] }`. The shell provides these for every panel with no module code: accent color, density (compact/roomy), font size, auto-refresh interval, pin on top, panel opacity, unread badge on the module's planet. Module-declared `sections` drive show/hide and drag-reorder. `validateManifest` rejects duplicate or malformed ids.
- **Views (saved layouts):** each module can keep named views (e.g. Gaming, Work); a view = {accent, density, fontScale, sections order+visibility, option values}. One active view per module; export/import a view as JSON.
- **Persistence:** new SQLite migration `panel_prefs(module_id, view TEXT, json TEXT, active INTEGER, PRIMARY KEY(module_id, view))`. Pure functions (`mergePrefs`, `applyView`, `reorder`, validation) live in `src/ui/prefs.ts` with tests. Reading and writing happens in the panel's own webview through the shared `getDb()` (single shared load promise).
- **Customize UI:** a gear button in the chrome strip sends an event to its panel, which opens a Customize drawer (kit component, same for every module).
- **Star map:** more stars in parallax layers, slow rotation around the center; animation runs only while the map is visible and pauses in game mode (no idle frame loop when hidden).

## Solar-system map (user request, late)
- Planets **orbit** like a solar system. Center = the Sentinel core (the "sun"): click opens Settings; its glow reflects the total unread count. Modules sit on rings by group: **Daily** (Notes, News, Calendar, Weather, Deals, Email, Social), **Media & chat** (YouTube, Discord, Chat), **System** (PC Care, Home Network, Backup, File Search, Clipboard), **Security** (Pentest Lab, GitHub Discovery). Inner rings are faster; one full turn takes roughly 10 to 20 minutes.
- Positions are a pure function of time: `orbitPos(ring, index, count, t, speed)`. A planet under the pointer eases to a stop so it can be clicked; orbits keep moving while dragging or panning (only a hovered planet eases to a stop), and obey the same motion policy as the stars (no loop when hidden, in game mode, with reduced motion, or with motion off).
- **Icons:** every module has its own icon (manifest `icon` key into a table of vector glyphs drawn on the planet in white) plus its accent color. Manifest also gets `ring`.
- **Notifications** appear as small moons orbiting a planet (up to 5, then a number bubble), with a brief pulse when the count goes up and "3 unread" on hover. Sources: a module's `badge()` count (read on startup, on window focus and when a panel closes, never on a timer), and for embedded web apps the page title: Discord's web app puts the unread count in its title like "(3) Discord", and the Rust side (`on_document_title_changed`) turns a leading "(N)" into a `planet-badge` event for the main window. **Only counts are shown, not message text** (reading messages would mean scraping the page, which is out of scope). Counts are cleared while the web panel is suspended in game mode.
- Settings (Task 10 section "General"): orbit motion on/off, orbit speed 0.25 to 2x, notification moons on/off.

## Per-module designs
As in the gallery, with these specifics:
- **Pentest Lab command center:** engagement banner (active engagement, in-scope targets), tool cards grouped by category, a results dock, a session log, and a report button. Tools are a registry: `{id, name, category, params, run}`; **every tool runs through the existing `scope.ts` gate, unchanged**. Initial tools are recon only: port scan, host discovery, DNS lookup, whois, HTTP headers, TLS certificate details, technology fingerprint, traceroute. Anything beyond recon (exploitation or autonomous scanning) is outside the module's standing principle and needs an explicit decision before it is designed.
- **Social feed:** one timeline across the existing connectors (Mastodon, Reddit, Bluesky), platform badge per post, filters by platform and account, density option. Read-only for now.
- **Email app:** needs new Rust commands (list folders, fetch message body, mark read, delete/archive, search) and a compose window; sending stays an explicit user action. This is the largest module change and is staged last.
- **YouTube home:** widgets (subscriptions, watch later, pinned channel, continue watching) with drag layout and views; depends on the YouTube/Discord webview sub-project for the player.

## Pentest scope and the bot (user decisions, late)
- The user asked for the widest freedom possible and for their bot to run the tools. Decision: widen what an **engagement** can declare, keep the gate itself.
- An engagement declares: targets as single hosts, CIDR ranges and wildcard domains (multiple per engagement), an optional time window, allowed tool categories, and its authorization reference. Several engagements can be active at once.
- The gate (`src/modules/pentest/scope.ts`) still decides every run: a target must match an active engagement (or be the user's own Home Network device). Matching logic grows to cover CIDR and wildcard; its tests grow with it. No bypass flag, no "allow all" engagement.
- **The bot** (browser/agent bot, sub-project 4) calls pentest tools only through the same registry and gate. Inside an active engagement it runs without a per-step prompt (creating the engagement is the approval); every tool call is written to the session log with target, tool, parameters and result; a **Stop** button halts the bot immediately; the bot cannot create or edit an engagement by itself.
- The module's standing "no autonomous scanning" wording is updated to "bot-run scans only inside an active engagement, always logged, always stoppable".

## Build order
1. UI kit + prefs persistence + Customize drawer + chrome gear.
2. Star map night sky + rotation (done), then the solar-system map with icons and notification moons (Tasks 11 and 12 of the foundation plan).
3. Migrate the list-shaped modules in batches (Notes, News, PC Care, Weather, Home Network, GitHub, Finance, Deals, Calendar & Tasks, Backup, Clipboard, File Search).
4. Pentest command center.
5. Social feed.
6. Email app (with its Rust work).
7. YouTube home, then Discord, Chat and Bot panels with their own sub-projects (already planned in the core-shell spec).

## Non-goals
Theming the Windows title bar; per-widget cloud sync; any new network call or hosted-AI call; changing secret handling (keychain only) or the Pentest scope gate.

## Testing
Pure logic unit-tested (prefs merge/validation, view apply, reorder, manifest `customize` checks). Manifest checks extend `validateManifest` tests. Visual output is checked by rendering panels in plain Chromium with Tauri calls stubbed, plus a real Windows run by the user. Each file stays under ~150 lines (`npm run check:size`).

## Decisions deferred
Exact widget sets per module beyond the gallery; the mail protocol details for Email; which extra Pentest tools (if any) beyond recon.
