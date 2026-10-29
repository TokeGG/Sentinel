# Panel UI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every module its own panel component and a shared customization system (colors, density, font size, show/hide, reorder, saved views, refresh interval, background tint, unread badge), plus the night-sky star map, then migrate the 12 list-shaped modules.

**Architecture:** A UI kit (`src/ui/`) styled only through CSS variables; a pure prefs layer (`prefs.ts`) persisted in SQLite (`panel_prefs`); the manifest grows generic `customize`, `ui` and `badge` fields; custom panels are lazy-loaded per module and fall back to the generic `ModulePanel` until migrated. A Customize drawer is opened from a gear in the chrome strip.

**Tech Stack:** React 19, TypeScript, Tauri 2 events, SQLite via `tauri-plugin-sql` (shared `getDb()`), `node --experimental-strip-types --test`.

**Spec:** `docs/superpowers/specs/2026-10-28-panel-ui-design.md` (builds on `2026-10-28-core-shell-design.md`)

## Global Constraints

- No file over about 150 lines (tests exempt); `npm run check:size` must pass; no hosted AI; secrets stay in the OS keychain; `src/modules/pentest/scope.ts` untouched.
- Migrations are strictly ascending and equal to position in `src-tauri/src/migrations.rs`; this plan adds **19** `panel_prefs` (its ordering test updates to 19).
- Rulings from user feedback: **panel opacity is replaced by a "background tint" slider** (child webviews cannot be translucent on Windows) and **"pin on top" is dropped** (raising a panel re-creates its webview, so pinned re-raising would reload pages). Everything else in the spec's option list ships: accent, density, font size, show/hide sections, reorder sections, saved views with export/import, refresh interval (off by default, only runs while the panel is open), unread badge on the planet.
- Customization values are untrusted input (imported JSON, old DB rows): accent must match `/^#[0-9a-f]{6}$/i`, numbers are clamped, unknown keys dropped. Nothing from prefs is ever inserted as raw CSS or HTML.
- Only the main window touches SQLite for layout; panel webviews may read and write `panel_prefs` through the shared `getDb()` promise.
- The star map never runs an animation loop while hidden, in game mode, or with reduced motion.
- Customize options needing no module code come from the shell for every panel.

## Review Focus

1. A saved view from an older or newer app version (unknown or missing sections) loads without crashing and keeps the user's order and visibility.
2. An imported view JSON that is malformed or hostile (bad accent string, huge numbers, extra keys) is rejected or sanitized, never injected.
3. A manifest that gains a new section later shows it (default visibility) appended to the saved order.
4. A panel whose module has zero declared sections still renders and its drawer shows only the shell options.
5. Star map motion stops in game mode and when the window is hidden, and honors reduced motion.

## File Structure

- `src/core/module.ts` + `src/core/manifestChecks.ts`: contract additions and checks.
- `src/ui/types.ts`, `src/ui/prefs.ts`, `src/ui/prefsStore.ts`, `src/ui/tokens.css`, `src/ui/useModule.ts`, `src/ui/useCustomize.tsx`, `src/ui/CustomizeDrawer.tsx`, `src/ui/kit/*.tsx`.
- `src/shell/SettingsPanel.tsx`, `src/shell/settingsStore.ts` (Task 10).
- `src/shell/stars.ts` (pure) + `src/shell/Planet.tsx`/`StarMap.tsx` edits; `src/shell/GameHud.tsx` motion toggle.
- `src/modules/<name>/Panel.tsx` for each migrated module.
- `src-tauri/migrations/19_panel_prefs.sql`, `src-tauri/src/migrations.rs`.

---

### Task 1: Manifest contract — `customize`, `ui`, `badge`

**Files:**
- Modify: `src/core/module.ts`, `src/core/manifestChecks.ts`
- Test: `src/core/module.test.ts`

**Interfaces:**
- Produces (in `module.ts`):
  - `type OptionDef = { key: string; label: string; type: "toggle" | "select" | "number"; default: boolean | string | number; choices?: string[]; min?: number; max?: number }`
  - `type CustomizeDef = { sections?: { id: string; label: string; default?: boolean }[]; options?: OptionDef[] }`
  - `ModuleManifest.customize?: CustomizeDef`; `ModuleManifest.ui?: () => Promise<{ default: React.ComponentType<{ module: ModuleManifest }> }>`; `ModuleManifest.badge?: () => Promise<number>`
- `panel: "custom"` now requires `ui`.

- [ ] **Step 1: Write failing tests** in `module.test.ts`: `custom panel without ui is rejected`; `duplicate section ids rejected`; `duplicate option keys rejected`; `select option without choices rejected`; `number option with min > max rejected`; `option default of the wrong type rejected` (e.g. toggle with default "x"); `valid customize accepted`; `ui and badge may be omitted on list panels`.
- [ ] **Step 2: Run** the module tests. Expected: new tests FAIL.
- [ ] **Step 3: Implement** the types and a `customizeError(c?: CustomizeDef): string | null` in `manifestChecks.ts` (returns the message), wired into `validateManifest` as `${where}: ${msg}`; keep `module.ts` ≤ 150 lines (move anything else needed into `manifestChecks.ts`).
- [ ] **Step 4: Run** the TS baseline and `npx tsc --noEmit`. Expected: pass.

---

### Task 2: Prefs core and persistence

**Files:**
- Create: `src/ui/prefs.ts`, `src/ui/prefsStore.ts`, `src-tauri/migrations/19_panel_prefs.sql`
- Modify: `src-tauri/src/migrations.rs` (entry 19, test expects 19)
- Test: `src/ui/prefs.test.ts`

**Interfaces:**
- Consumes: `CustomizeDef` (Task 1).
- Produces in `prefs.ts`:
  - `type View = { name: string; accent: string; density: "compact" | "roomy"; fontScale: number; tint: number; refreshMinutes: number | null; sections: { id: string; visible: boolean }[]; options: Record<string, boolean | string | number> }`
  - `defaultView(c?: CustomizeDef, name = "Default", base?: Partial<View>): View` (accent `#396cd8`, density `"roomy"`, fontScale 1, tint 0.5, refreshMinutes null; `base` overrides the appearance fields, used for the user's global defaults from Settings)
  - `mergeView(raw: unknown, c?: CustomizeDef): View` — tolerant: unknown sections dropped, new manifest sections appended with their default visibility, accent validated, fontScale clamped to [0.8, 1.4], tint to [0, 1], refreshMinutes null or an integer in [1, 1440], options coerced to their declared type/clamped/choices, extra keys dropped; never throws
  - `cssVars(v: View): Record<string, string>` — keys `--accent`, `--density` ("0.75" or "1"), `--font-scale`, `--tint`
  - `reorderSections(v: View, from: number, to: number): View`; `setSectionVisible(v: View, id: string, visible: boolean): View`
  - `exportView(v: View): string`; `importView(json: string, c?: CustomizeDef): View` (throws `Error("invalid view")` on non-JSON or non-object)
- Produces in `prefsStore.ts`: `loadViews(moduleId: string, c?: CustomizeDef): Promise<{ views: View[]; active: string }>` (creates the Default view when none), `saveView(moduleId: string, v: View): Promise<void>`, `setActiveView(moduleId: string, name: string): Promise<void>`, `deleteView(moduleId: string, name: string): Promise<void>` (the last view cannot be deleted).
- Table: `panel_prefs(module_id TEXT NOT NULL, view TEXT NOT NULL, json TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (module_id, view))`.

- [ ] **Step 1: Write failing tests** in `prefs.test.ts`: `default view lists declared sections visible by default`; `merge drops unknown sections and keeps user order`; `merge appends a newly added section with its default visibility`; `merge rejects bad accent (url(), script, short hex) and falls back to default`; `merge clamps fontScale tint refreshMinutes`; `merge coerces option types and drops unknown options`; `merge of null or a string returns the default view`; `cssVars outputs the four variables`; `reorder moves a section and is a no-op for out-of-range indexes`; `setSectionVisible toggles only that section`; `import then export round-trips`; `import of garbage throws invalid view`; `zero-section manifest yields empty sections`.
- [ ] **Step 2: Run** `node --experimental-strip-types --test src/ui/prefs.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `prefs.ts` pure (no Tauri imports); `prefsStore.ts` over `getDb()` using `mergeView` on every row it reads; add migration 19 and its `migrations.rs` entry/test.
- [ ] **Step 4: Run** prefs tests, `cd src-tauri && cargo test --lib`, `npx tsc --noEmit`. Expected: pass (Rust ordering test now 19).

---

### Task 3: UI kit and tokens

**Files:**
- Create: `src/ui/tokens.css`, `src/ui/kit/{PanelShell,Tile,Chip,Row,Gauge,Spark,Tabs,Table,StatusLine,ErrorLine,EmptyState}.tsx`, `src/ui/kit/index.ts`
- Modify: `src/App.css` (import tokens; keep existing rules)

**Interfaces:**
- Produces (all exported from `src/ui/kit/index.ts`, every component accepts `className?: string`):
  - `PanelShell({ accent?: string; children })` — root that applies prefs vars and the panel surface
  - `Tile({ title?, children })`, `Chip({ on?, onClick?, children })`, `Row({ children, end? })` (flex row, optional right-aligned `end`)
  - `Gauge({ value: number; max?: number; label?: string; warnAt?: number })` (bar with value text), `Spark({ points: number[]; tone?: "up" | "down" | "flat" })`
  - `Tabs({ tabs: {id: string; label: string}[]; active: string; onChange(id: string): void })`
  - `Table({ columns: {key: string; label: string; width?: string}[]; rows: Record<string, unknown>[]; empty?: string })`
  - `StatusLine({ updated?: Date | string | null; autoRefresh?: string | null; error?: string | null })`, `ErrorLine({ message: string; onDismiss?(): void })`, `EmptyState({ title: string; hint?: string })`
- Tokens in `tokens.css` (`:root` dark defaults): `--accent`, `--density` (spacing multiplier), `--font-scale`, `--tint`, `--surface`, `--surface-2`, `--line`, `--text`, `--text-dim`, `--ok`, `--warn`, `--bad`; components use only these (no literal colors).

- [ ] **Step 1: Write failing tests** `src/ui/kit/kit.test.ts` for the pure helpers the kit exports from `src/ui/kit/format.ts`: `ago(date, now)` ("just now", "5m", "3h", "2d"), `pct(value, max)` clamps to 0–100, `sparkPoints(points, w, h)` returns an SVG points string inside the box and handles empty/one-point/flat series without NaN.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `format.ts` and the components; file per component, each small; a sampler page is not shipped (verification below).
- [ ] **Step 4: Verify:** `npx tsc --noEmit`, `npm run build`, TS baseline, `npm run check:size`; render a throwaway sampler of every kit component in plain Chromium (Playwright, Tauri calls stubbed, script kept outside the repo) and attach one screenshot to the report.

---

### Task 4: Customize drawer, panel route integration, chrome gear

**Files:**
- Create: `src/ui/useModule.ts`, `src/ui/useCustomize.tsx`, `src/ui/CustomizeDrawer.tsx`
- Modify: `src/shell/PanelRoute.tsx`, `src/shell/ChromeRoute.tsx`, `src/App.css`
- Test: `src/ui/useModule.test.ts` (pure helpers only)

**Interfaces:**
- Consumes: Task 1 manifest fields, Task 2 prefs/store, Task 3 kit.
- Produces:
  - `useModule(m: ModuleManifest): { rows: Row[]; busy: boolean; error: string | null; updated: Date | null; refresh(): Promise<void>; run(skill: string, args?: Record<string, unknown>): Promise<unknown> }` — `run` looks the skill up on the manifest, sets busy, refreshes after, stores the error string instead of throwing.
  - `useCustomize(m: ModuleManifest): { view: View; views: string[]; setView(v: View): Promise<void>; switchTo(name: string): Promise<void>; create(name: string): Promise<void>; remove(name: string): Promise<void>; vars: Record<string, string> }`
  - Event `panel-customize` (payload `{ id: string }`) sent from the chrome gear to that panel's content webview with `emitTo("panel-<id with . → _>", ...)`; `PanelRoute` listens only for its own id and toggles the drawer.
  - `PanelRoute` renders `m.ui` (lazy, `Suspense` fallback = `EmptyState`) when `panel === "custom"`, else the generic `ModulePanel`; both wrapped in `PanelShell` with the view's CSS variables; the module's `StatusLine` shows `updated` and the auto-refresh state.
  - Refresh interval: when `view.refreshMinutes` is set, the panel calls `refresh()` on that interval while open (default off); cleared on unmount.
  - `CustomizeDrawer` controls: accent color, density, font size, background tint, refresh interval (Off/1/5/15/60 min), each declared option, section list with visibility checkboxes and move up/down, views (switch, create, delete, export/import via a text box).

- [ ] **Step 1: Write failing tests** `useModule.test.ts` for extracted pure helpers in `src/ui/moduleRun.ts`: `findSkill(m, name)` throws `unknown skill "x"` for a missing skill; `errorText(e)` flattens Error and string; `intervalMs(minutes)` is null for null and `minutes*60000` otherwise, null for non-positive.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** helpers, hooks, drawer, route integration and the gear button (a `⚙` button in `ChromeRoute` before the close button; error handling follows the existing `fail()` pattern).
- [ ] **Step 4: Verify:** tsc, build, baseline, size guard; Chromium-with-stubs check that the drawer opens, toggling a section hides it, and the accent change updates `--accent`.

---

### Task 5: Night-sky star map

**Files:**
- Create: `src/shell/stars.ts`
- Modify: `src/shell/Planet.tsx` (`drawStars`), `src/shell/StarMap.tsx`, `src/shell/GameHud.tsx` (Star motion toggle), `src/shell/layoutStore.ts` (`getStarMotion`/`setStarMotion` on `app_settings`, default on)
- Test: `src/shell/stars.test.ts`

**Interfaces:**
- Produces in `stars.ts`: `type Star = { x: number; y: number; r: number; layer: 0 | 1 | 2; tw: number }`; `makeStars(seed: number, count: number, w: number, h: number): Star[]` (deterministic, inside the box, 3 depth layers, ~60% far/25% mid/15% near); `rotate(s: Star, cx: number, cy: number, angle: number, layer: 0 | 1 | 2): { x: number; y: number }` (near layers rotate slightly faster, angle = elapsed × 0.004 rad/s × (1 + layer × 0.5)); `twinkle(s: Star, tSec: number): number` in [0.35, 1].
- Rendering: ~450 stars in 3 colors (white, pale blue, warm), a soft nebula gradient, a few brighter stars with a small glow; planets keep their look.
- Motion loop: one `requestAnimationFrame` loop capped at 30 fps, running only when `document.visibilityState === "visible"`, game mode is not active, `prefers-reduced-motion` is not set, and the Star motion toggle is on; otherwise a single static frame. Stops on unmount and on hidden.

- [ ] **Step 1: Write failing tests** `stars.test.ts`: `makeStars is deterministic for a seed`; `stars stay inside the box`; `layer mix is roughly 60/25/15`; `rotate by 0 is identity`; `rotate by 2π returns to start (within 1e-6)`; `near layers rotate more than far`; `twinkle stays in [0.35, 1]`; `zero count returns empty`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `stars.ts`; wire drawing and the guarded loop; HUD toggle persisted via `app_settings` key `star_motion`.
- [ ] **Step 4: Verify:** tsc, build, baseline; two Chromium screenshots (t=0 and t=5 s) show rotation; confirm in the code that no `requestAnimationFrame` is scheduled in hidden/game/reduced-motion states (state this in the report).

---

### Task 6: Module panels, batch 1 — Notes, News, Deals

**Files:**
- Create: `src/modules/{notes,news,deals}/Panel.tsx`
- Modify: `src/modules/{notes,news,deals}/index.ts` (`panel: "custom"`, `ui`, `customize`)

**Interfaces:**
- Consumes: `useModule`, kit, `useCustomize` (the panel reads `view.sections` visibility/order and `view.options` via a `useCustomize(module)` call).
- Each `index.ts` keeps its skills/`load`/`schedule`; `customize.sections` as below; `badge` where stated.
- **Notes:** sections `capture` (input + Add), `inbox` (unfiled note cards with time and file-to chips: Work, Ideas, Later, plus a free text), `filed` (count + list, hidden by default); badge = number of unfiled notes.
- **News:** sections `filters` (source chips, All default), `headlines` (title, source, age, unread dot), `status` (fetch button + auto-refresh state); badge = unread count if the table tracks it, else omitted (do not add schema).
- **Deals:** sections `filters` (source chips), `deals` (price prominent when parsable from the title, store/source, age, open-in-browser), `status`.
- Panels call skills only through `run()`; rows come from `useModule().rows`; empty and error states use `EmptyState`/`ErrorLine`.

- [ ] **Step 1: Write failing tests** for the pure helpers each panel needs, in `src/modules/{notes,news,deals}/panelLogic.ts` + tests: Notes `splitFiled(rows)` (unfiled vs filed), News `sourcesOf(rows)` (unique, sorted) and `filterBySource(rows, source)`, Deals `priceOf(title)` (`"$139"`, `"$1,299.99"`, none → null) and `sourcesOf`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the logic files, the three panels, and the manifest changes.
- [ ] **Step 4: Verify:** tsc, build, baseline, size guard; Chromium-with-stubs screenshot of each panel with sample rows; confirm the generic panel is still used by modules not yet migrated.

---

### Task 7: Module panels, batch 2 — PC Care, Weather, Home Network

**Files:** `src/modules/{pccare,weather,homenet}/Panel.tsx` (+ `panelLogic.ts`), manifests updated as in Task 6.

- **PC Care:** sections `gauges` (CPU and RAM `Gauge`s), `disks` (one bar per drive), `cleanup` (temp preview then apply, two separate buttons; apply stays disabled until a preview exists; never deletes beyond the preview). Option: gauge warning threshold (number, default 85).
- **Weather:** sections `alerts` (banner for severe conditions), `places` (one tile per saved place: temperature, condition, high/low), `add` (add-place input). Option: units (select °F/°C if the data allows converting; otherwise omit the option).
- **Home Network:** sections `devices` (Table: name, IP, MAC, tag), `tools` (scan button, tag editor), `summary` (device count, new-device highlight). Badge = number of devices not seen before if derivable from existing rows, else omitted.
- Pure helpers + tests: `pctOf(used, total)`; `isSevere(row)` using the module's existing severe flag; `newDevices(rows, knownIds)`.
- Same steps and verification as Task 6.

---

### Task 8: Module panels, batch 3 — GitHub, Finance, Calendar & Tasks

**Files:** `src/modules/{github,finance,calendar}/Panel.tsx` (+ `panelLogic.ts`), manifests updated.

- **GitHub:** sections `credentials` (reuse the existing `CredentialFields` component for the PAT, shown only when no token is saved), `tabs` (Trending / Starred), `repos` (stars, language dot, short description, Clone button; already-cloned marker).
- **Finance:** sections `watchlist` (symbol, price, day change colored, `Spark`), `congress` (Table: who, ticker, size, date), `status`. Tabs switch between them.
- **Calendar & Tasks:** sections `today`, `week`, `overdue` (red); each item shows its source module tag.
- Pure helpers + tests: `changePct(prev, cur)`, `groupByDay(rows, now)`, `isOverdue(row, now)`, `languageColor(name)` with a fallback color.
- Same steps and verification as Task 6.

---

### Task 9: Module panels, batch 4 — Backup & Snapshot, Clipboard & Quick-Launch, Local File Search

**Files:** `src/modules/{backup,clipboard,filesearch}/Panel.tsx` (+ `panelLogic.ts`), manifests updated.

- **Backup:** sections `last` (last backup time and size, Back up now), `snapshots` (list with Restore…), `notice` (restart reminder). Restore keeps the existing preview-before-apply step unchanged.
- **Clipboard & Quick-Launch:** sections `launcher` (icon grid of shortcuts + Add), `history` (newest first, click to copy), `status` (auto-check state). Auto-check stays off until switched on (existing behavior).
- **File Search:** sections `search` (box, results as you type with a 250 ms debounce), `roots` (removable chips + Add), `results` (name, folder, size, date).
- Pure helpers + tests: `humanSize(bytes)`, `debounce`-free `shouldSearch(query)` (min 2 chars), `shortPath(path, max)`.
- Same steps and verification as Task 6, then run the **whole** TS baseline, `cargo test --lib`, `npm run check:size`, `npm run build`.

---

### Task 10: Settings button and Settings panel

**Files:**
- Create: `src/shell/settingsStore.ts`, `src/shell/SettingsPanel.tsx`, `src/shell/settingsLogic.ts`
- Modify: `src/shell/GameHud.tsx` (a ⚙ Settings button), `src/core/module.ts` registry usage only (no manifest change), `src/App.tsx` (route `#/panel/hub.settings` renders the Settings panel), `src/shell/panelApi.ts` (`openSettings()`)
- Test: `src/shell/settingsLogic.test.ts`

**Interfaces:**
- Consumes: kit (Task 3), `getGameModeAuto`/`setGameModeAuto`/star motion (earlier tasks), scheduler `setScheduleEnabled`/`getScheduleEnabled`, `defaultView` base (Task 2).
- Produces:
  - `settingsStore.ts`: `type Appearance = { accent: string; density: "compact" | "roomy"; fontScale: number }`; `getAppearance(): Promise<Appearance>` / `setAppearance(a: Appearance): Promise<void>` (key `appearance_defaults` in `app_settings`, validated through `mergeView`-style sanitizing); `getRestorePanels(): Promise<boolean>` / `setRestorePanels(b: boolean)` (key `restore_panels`, default true; `restore()` in `panelApi.ts` skips reopening when false).
  - `settingsLogic.ts` (pure): `scheduleRows(registry: ModuleManifest[], enabled: Record<string, boolean>): { id: string; name: string; everyMinutes: number; enabled: boolean }[]` (only modules with `schedule`, sorted by name); `sanitizeAppearance(raw: unknown): Appearance`.
  - A "Settings" panel opened as a normal panel with id `hub.settings` through the same panel manager (button in the star map HUD, next to Game mode). Sections: **General** (auto game mode, star map motion, reopen panels at startup), **Appearance** (default accent, density, font size applied to every panel whose own view has not changed it), **Background jobs** (every module with a schedule, its interval, an on/off switch, with the note that nothing runs until switched on), **Data** (button that opens the Backup & Snapshot panel; the app's data folder path shown), **About** (version from `package.json`, a link to the Releases page).
- The Settings panel is not a module: it must not appear as a planet and must not be in the registry.

- [ ] **Step 1: Write failing tests** `settingsLogic.test.ts`: `scheduleRows lists only modules with a schedule, sorted by name`; `scheduleRows uses the enabled map and defaults to off`; `sanitizeAppearance rejects a bad accent and clamps font scale`; `sanitizeAppearance of garbage returns the defaults`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** logic, store, panel, HUD button, route, `restore()` honoring `restore_panels`.
- [ ] **Step 4: Verify:** tsc, build, baseline, size guard; Chromium-with-stubs screenshot of the Settings panel; confirm the Settings panel never shows as a planet.

---

### Task 11: Solar-system map — orbits, rings, icons

**Files:**
- Create: `src/shell/orbit.ts` (pure), `src/shell/icons.ts` (glyph table), `src/shell/orbit.test.ts`, `src/shell/icons.test.ts`
- Modify: `src/core/module.ts` + `customizeChecks.ts` (manifest `ring`, `icon`), every `src/modules/*/index.ts` (add `ring`, `icon`), `src/shell/StarMap.tsx` (split first: it is at the 150-line limit — move drawing/hit-test into `src/shell/mapDraw.ts` and `src/shell/mapHit.ts`), `src/shell/Planet.tsx`, `src/shell/planets.ts`, `src/shell/GameHud.tsx` (orbit toggle + speed), `src/shell/layoutStore.ts` (keys `orbit_motion` default on, `orbit_speed` default 1), `src/ui/prefs.ts` untouched.

**Interfaces:**
- Produces:
  - `type Ring = "daily" | "media" | "system" | "security"`; manifest `ring?: Ring` (invalid → ManifestError; default `"system"`), `icon?: string` (key in `ICONS`; unknown key → ManifestError).
  - `orbit.ts`: `RING_RADIUS: Record<Ring, number>` (world units, inner to outer: daily 190, media 300, system 410, security 520) and `RING_PERIOD_S: Record<Ring, number>` (daily 600, media 780, system 960, security 1200 seconds per turn); `orbitPos(ring: Ring, index: number, count: number, tSec: number, speed: number, center: {x:number;y:number}): {x:number;y:number}` (even spacing `2π·index/count`, angle advances `2π·speed·tSec/period`, `count` ≤ 0 or non-finite inputs return the center); `advance(elapsed: number, dtMs: number, paused: boolean): number` is reused from the stars helper (do not duplicate; import it).
  - `icons.ts`: `ICONS: Record<string, string>` of SVG path data on a 24×24 grid (one per module: notes, news, pccare, weather, homenet, github, youtube, finance, deals, email, social, calendar, backup, pentest, clipboard, filesearch, plus `core`, `discord`, `chat`, `bot`) and `drawIcon(ctx, key, x, y, size, color)` using `Path2D`; unknown key draws nothing.
- Behavior: the sun at the center draws the core icon and opens Settings; each planet draws its icon in white over its accent gradient; a hovered planet eases to a stop (position held through a per-planet "slow factor" that moves toward 0 on hover and back to 1 over ~300 ms); while dragging the map or hovering, other planets keep orbiting unless motion is off; hit-testing uses the planet's CURRENT position; the motion policy (visible, not game mode, not reduced motion, motion on) governs the orbit exactly as it governs the stars, with the same single capped rAF chain; orbit speed multiplies the angle rate.

- [ ] **Step 1: Write failing tests:** `orbitPos at t=0 spaces planets evenly on the ring`; `orbitPos advances one full turn after the ring period`; `inner ring completes a turn before the outer ring`; `orbitPos with count 0 returns the center`; `orbitPos speed 2 doubles the angular rate`; `every module's ring and icon are valid` (iterate the registry in a test that imports the manifests' static metadata only); `every ICONS entry parses as a non-empty path string and starts with M`; `unknown icon key is rejected by validateManifest`; `invalid ring is rejected`; manifest tests for `ring`/`icon` defaults.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the pure modules, manifest fields and checks, assign rings per the spec (Daily: notes, news, calendar, weather, deals, email, social; Media: youtube; System: pccare, homenet, backup, filesearch, clipboard; Security: pentest, github), then split `StarMap.tsx` and implement the orbiting draw, icons, sun, slow-on-hover and Settings opening (the sun click calls `openSettings()` from Task 10 if present; until then it does nothing).
- [ ] **Step 4: Verify:** tsc, build, baseline, size guard; Chromium-with-stubs screenshots at t=0 and t=30 s showing rings and moved planets with icons; confirm hit-testing at the moved position (click opens the panel under the pointer) and that rAF counts are 0 in game-mode/hidden/reduced-motion/motion-off.

---

### Task 12: Notification moons and badge plumbing

**Files:**
- Create: `src/shell/badges.ts` (pure + store), `src/shell/badges.test.ts`, `src/shell/moons.ts` (pure moon positions)
- Modify: `src/shell/StarMap.tsx`/`mapDraw.ts` (draw moons), `src/App.tsx` (refresh badges on mount, window focus and on `panel-closed`), `src/shell/GameHud.tsx` (moons toggle), `src/shell/layoutStore.ts` (key `notif_moons` default on), `src-tauri/src/panels/manager.rs` or `webview.rs` (emit `panel-closed` {id} on close) only if no existing event can be used.

**Interfaces:**
- Produces:
  - `badges.ts`: `type Badges = Record<string, number>`; `mergeBadge(b: Badges, id: string, count: number): Badges` (negative/NaN/non-integer counts become 0, cap 999); `totalBadges(b: Badges): number`; `async function refreshBadges(registry: ModuleManifest[]): Promise<Badges>` (calls each module's `badge()` once, in parallel, one failure never blocks the others, result for a failing module is 0); event name `PLANET_BADGE = "planet-badge"` with payload `{ id: string; count: number }` (also accepted from Rust for web panels).
  - `moons.ts`: `moonCount(count: number): number` (min(count, 5)); `moonPositions(count: number, radius: number, tSec: number, id: string): {x:number;y:number}[]` (orbit around the planet, deterministic phase from the id); `badgeText(count: number): string` (`""` for 0, number up to 99, `"99+"` above).
- Behavior: moons orbit their planet, pulse once when a count increases, a number bubble shows when count > 5; hover shows "N unread"; the sun's glow scales with `totalBadges`; refresh happens only on mount, window `focus` and `panel-closed` — never on a timer; moons are not drawn when the setting is off.

- [ ] **Step 1: Write failing tests** `badges.test.ts`: `mergeBadge sanitizes negative NaN and fractional counts`; `mergeBadge caps at 999`; `totalBadges sums`; `refreshBadges survives one failing badge()`; `refreshBadges skips modules without badge`; `moonCount caps at 5`; `moonPositions are deterministic per id and on the radius`; `moonPositions of 0 is empty`; `badgeText formats 0, 7, 99, 100`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** pure parts, the store/refresh wiring, drawing, and the HUD toggle.
- [ ] **Step 4: Verify:** tsc, build, baseline, size guard; Chromium-with-stubs screenshot with sample counts (Notes 3, a fake module 12) showing moons, bubble and hover text; confirm no timers are started by badge refresh (grep + rAF/interval counts).

(The Rust `on_document_title_changed` handler that turns Discord's "(3) Discord" title into a `planet-badge` event belongs to the Discord panel plan; Task 12 only consumes the event.)
