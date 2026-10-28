# Sentinel

Local-first, modular desktop hub (Tauri + React + TypeScript). See the full
plan: https://claude.ai/artifact/9XSLWd8XTtd7vpWvSfNUQ3

## Status

**Foundation (Milestone 0):** done for a first pass.
- [x] Tauri + React + TS scaffold, SQLite via `tauri-plugin-sql`
- [x] Module manifest contract (`src/core/module.ts`): `id`, `panel`, `skills`,
      `load`, `actions` (zero-arg skill buttons), `quickAdd` (one-field add form)
- [x] Manifest validation + tests (bad id shape, dupes, unknown panel kind,
      dupe skill names, missing `load()`, dangling action/quickAdd refs)
- [x] Generic panel renderer (`src/core/ModulePanel.tsx`) — zero
      module-specific UI code for any `list`/`table` module
- [x] Star-map app shell + panel manager + shared `activity_log`
- [x] Opt-in job scheduler (`src/core/scheduler.ts`): per-module toggle persisted
      in SQLite, nothing runs until switched on
- [x] OS-keychain credential helper (`set_credential`/`get_credential`/
      `delete_credential` in Rust via the `keyring` crate — Windows Credential
      Manager / macOS Keychain / Linux Secret Service; `src/core/credentials.ts`
      on the TS side) — built now because GitHub Discovery needed a real
      secret. Manifest gained `credentialFields`, rendered by the generic
      panel as password inputs that save straight to the keychain and are
      never echoed back, never written to SQLite.

**Track A (read-only, zero new risk) — in progress:**
- [x] Notes (`src/modules/notes`) — proved the pattern end to end
- [x] News (`src/modules/news`) — RSS/Atom, regex parser (tested, no deps),
      dedup via SQLite `UNIQUE(source_id, guid)`, fetched over
      `tauri-plugin-http`
- [x] PC Care (`src/modules/pccare`) — read-only CPU/RAM/disk snapshot via a
      Rust `sysinfo` command (`get_pc_metrics`); no cleanup actions yet
- [x] Weather & Alerts (`src/modules/weather`) — Open-Meteo (free, no key, no
      account) for geocoding + forecast; severe-condition flag on current
      weather code
- [x] Home Network (`src/modules/homenet`) — reads the OS's own ARP cache
      (`arp -a`, passive, no raw sockets/admin) via `get_network_devices`;
      doubles as the Pentest Lab allow-list source later
- [x] GitHub Discovery (`src/modules/github`) — trending (public search API,
      no auth), your starred repos (needs the PAT, entered via the
      Credentials section — never paste it in chat), and "Clone…" per row:
      opens a folder picker, shells `git clone`, logs it. Never executes
      anything from a cloned repo.
- [x] YouTube (`src/modules/youtube`) — OAuth2 + PKCE against the Client ID
      you enter in-app, no client secret anywhere. `oauth_listen_once` (Rust)
      is a one-shot loopback listener on `127.0.0.1:53682` that catches
      Google's redirect and closes — not a persistent server. `connect` does
      the sign-in once; `fetch_subscriptions` lists your subscribed channels
      (MVP scope — per-channel "new upload" polling is the natural next
      increment, not built yet). PKCE helpers tested (4 tests).

**Track A is functionally complete** for its first pass: Notes, News, PC
Care, Weather, Home Network, GitHub Discovery, YouTube — confirmed running
on real Windows as of this commit (Foundation + Track A smoke-tested).

**Track B (account-connected) — in progress:**
- [x] Finance (`src/modules/finance`) — stock/ETF quotes via Stooq, crypto via
      CoinGecko, both free/no-key. Also syncs public Senate/House stock
      trade disclosures (STOCK Act data, free, no key) and surfaces trades on
      tickers you're already watching first. Field-name mapping on the
      congress-trades JSON is defensive/best-effort — verify it parses
      sensibly on first real fetch and tell me if a field comes back empty.
- [x] Deals & Promos (`src/modules/deals`) — identical RSS/Atom pattern to
      News, reuses its `parseFeed` directly (no duplicated parser).
- [x] Email (`src/modules/email`) — generic IMAP (read-only fetch) + SMTP
      (send) via the `imap`, `native-tls`, and `lettre` Rust crates. Fetch is
      wired to the UI (Credentials form + "Fetch inbox" button); `send_mail`
      is a working skill but has **no compose UI yet** — the generic panel
      only supports single-field quick-add, not a multi-field form. Next
      increment if you want to actually send from the app rather than just
      read.
- [x] Social Media (`src/modules/social`) — multi-connector architecture
      (`connectors.ts`): Mastodon and Reddit use real one-click OAuth
      ("Connect" button → browser → approve → done, reusing the same
      `oauth_listen_once` loopback pattern as YouTube, on ports 53683/53684)
      — no password ever stored. Bluesky has no public-client OAuth yet (AT
      Protocol needs a hosted client-metadata file), so it's handle + app
      password instead — one-time entry, never your real account password.
      X is stubbed with a clear error: free API tier has no usable read
      endpoint. Adding a 5th platform later = write one connector file,
      list it in `connectors` — nothing else changes.

**Core shell (sub-project 1) — not yet run in a real window:**
- [x] Star-map home screen; modules open as floating panels (each a content
      webview plus a thin chrome strip), layout persisted in SQLite
- [x] `"web"` panel kind (`web: { url, profile }`) for embedded sites
- [x] Game mode: manual button + auto detection (persisted `game_mode_auto`
      toggle); pauses the scheduler and destroys/suspends panels
- [x] Refactors: `lib.rs` split into `commands/` + numbered SQL migrations,
      `ModulePanel` split, table-driven manifest checks, `npm run check:size`
- [ ] Windows webview spike, GPU-load trigger, local-model unload: not done

## Still needed from you

- **Google Cloud**: register `http://127.0.0.1:53682` as an **Authorized
  redirect URI** on that OAuth client (Console → APIs & Services →
  Credentials → your Desktop client → Authorized redirect URIs). Desktop
  clients sometimes need this added explicitly even though they're "public"
  clients. Also double check YouTube Data API v3 shows Enabled.
- **GitHub PAT**: revoke the one pasted earlier, generate a fresh one, enter
  it in-app (GitHub Discovery → Credentials) — never in chat.
- **Email**: no new secret needed from you beyond your own mailbox's IMAP/SMTP
  host, port, username, and password — enter those in-app once you're ready
  to test it (most providers: IMAP port 993, SMTP port 587).
- **Reddit**: create one "installed app" at reddit.com/prefs/apps (type:
  installed app, redirect URI: `http://127.0.0.1:53684`), paste its Client ID
  into the Social module's Credentials section, then click "Connect Reddit."
- **Mastodon**: just enter your instance URL (e.g. `https://mastodon.social`)
  and click "Connect Mastodon" — the app registers itself with your instance
  automatically, no prior setup needed on your end.
- **Bluesky**: generate an App Password at bsky.app → Settings → App
  Passwords (not your real account password), enter your handle + that app
  password.

Enter all credentials through the app's own Credentials fields once you're
running it — that's what the keychain helper is for, never in chat.

**Track D + remaining Foundation items — done:**
- [x] Calendar & Tasks (`src/modules/calendar`) — no new table; aggregates
      dated rows already sitting in other modules (deals, unfiled notes,
      watchlist checks). Grows automatically as more modules add dated data.
- [x] Backup & Snapshot (`src/modules/backup`) — copies `sentinel.db` (+
      WAL/SHM sidecars) to a folder you pick, timestamped; restore is the
      reverse, both explicit/manual, nothing automatic.
- [x] Job scheduler (`src/core/scheduler.ts`) — **off by default everywhere**,
      persisted per-module in `schedule_settings`. News/Weather/Finance/Deals/
      YouTube (new uploads)/Clipboard all have an "Auto-refresh" checkbox;
      flipping it on is the only thing that ever starts a timer. Matches
      "no background task without explicit enable" from your spec.
- [x] Generic multi-field forms (`ModuleManifest.forms`, rendered by
      `ModulePanel`) — closed the gap noted last pass. Wired onto Email's
      `send_mail` (To/Subject/Body) and Pentest's `add_engagement`,
      `scan_target`, `generate_report`. Nothing is skill-only/unreachable
      from the UI anymore.
- [x] YouTube per-channel new-upload polling (`fetch_new_uploads`) —
      resolves each subscribed channel's uploads playlist once, then pulls
      its 5 most recent videos; dedup via `video_id UNIQUE`. Panel falls
      back to the plain channel list until the first run.
- [x] PC Care cleanup — "Preview temp cleanup" lists the OS temp folder
      (read-only, nothing else — never Documents/Downloads/browser
      profiles); "Apply cleanup" deletes exactly what was previewed, with a
      Rust-side defense-in-depth check that refuses any path outside the
      temp dir even though the caller should never send one.
- [x] Clipboard History & Quick-Launch (`src/modules/clipboard`) — add
      app/file/folder shortcuts, one click opens them; clipboard polling is
      off by default (same scheduler pattern), captures text changes when
      switched on.
- [x] Local File Search (`src/modules/filesearch`) — filename search over
      folders you explicitly add, std-library recursive walk (no indexing
      crate), capped at 500 results and depth 12 so it can't hang on a huge
      tree.
- [x] Pentest Lab (`src/modules/pentest`) — built last, most carefully, per
      the roadmap:
      - **Engagements** are the only way anything gets authorized: client
        name, scope (comma-separated targets), an authorization reference
        (your SOW/ROE text or link), and a date window. A target is only
        ever scanned if it's (a) in an *active* engagement's scope right now,
        or (b) a device your own Home Network scan already found — your own
        infra needs no separate engagement.
      - `scan_target` is a plain TCP connect scan over an explicit port list
        (default: a short common-ports list) — recon only, no exploitation
        tooling, no stealth. The Rust command itself (`tcp_port_scan`) has no
        concept of scope; the gate lives entirely in the TS module, before
        the command is ever called.
      - `generate_report` builds a Markdown report and writes it to a folder
        you pick (`write_text_file`), named per-engagement and timestamped.
      - Every scan attempt — allowed or refused — is logged to the shared
        activity log with its reason. A refusal is never silent.

**The full module roadmap from the plan doc is now built: all 18 modules.**
76 TS tests and 48 Rust tests passing, clean typecheck, clean build.

## Untested on a real OS yet

Everything from "Email" onward in the status list above — `imap`,
`native-tls`, `lettre`, the clipboard-manager plugin, and every new Rust
command (`tcp_port_scan`, `backup_database`, `restore_database`,
`write_text_file`, `preview_temp_cleanup`, `apply_temp_cleanup`,
`search_files`) — is new since your last real `cargo build` and hasn't
been compiled and run on Windows yet (it does compile and pass `cargo test
--lib` on Linux). When you next run `npm run tauri dev`, expect a long
rebuild (18 migrations plus many crates); send me any compiler error and I'll fix it fast.

Given the size of this pass, a few things worth testing deliberately once
it's running, beyond the obvious click-around:
- **Pentest Lab's scope gate** — add an engagement, try scanning a target
  *not* in its scope (should refuse), then one that is (should run).
- **PC Care cleanup** — preview first, confirm the listed files are actually
  in your temp folder before hitting Apply.
- **Scheduler toggles** — flip one on, close and reopen the app, confirm it
  resumed (that's `initScheduler` reading `schedule_settings` back).

## Run the tests

```bash
npm test                    # TS baseline: 76 tests
node --test scripts/check-file-size.test.mjs   # 4 tests
npm run check:size          # no file over 150 lines (legacy allow-list)
cd src-tauri && cargo test --lib   # 48 Rust tests
```

The Rust tests cover the file-search walker (`commands/files.rs`), panel
state/geometry/ids/persistence (`panels/`), migration ordering, and
game-mode decisions (`gamemode/decide.rs`). Pentest scope gating is tested in
`src/modules/pentest/scope.ts`'s pure function, and manifest validation in
`src/core/module.test.ts`.

Note: the `imap` pin was once wrong (`"3"` has no stable release) and is fixed to `"2"`.

## Running the app

Needs the Tauri prerequisites installed first:
https://tauri.app/start/prerequisites/

```bash
npm install
npm run tauri dev
```

## Adding a module

1. Create `src/modules/<name>/index.ts`.
2. Define a `ModuleManifest` (see `src/core/module.ts`) with an `id`, `panel`
   kind, and `skills`. Add `load` for a list/table panel, `actions` for
   zero-arg buttons (e.g. "Fetch now"), `quickAdd` for a one-field add form
   (e.g. "add a feed URL") — see News and Notes for both patterns.
3. Add a numbered SQL migration `src-tauri/migrations/NN_<module>.sql` if it
   needs storage, and list it in `src-tauri/src/migrations.rs` (versions
   strictly ascending). Add a `#[tauri::command]` under
   `src-tauri/src/commands/` if it needs native OS access (see
   `get_pc_metrics`), and register it in `generate_handler!` in `lib.rs`.
4. `registerModule(yourManifest)` at the bottom of the file, and `import` it
   once from `src/App.tsx`.
5. Write a test for anything with real logic (parsing, validation) — see
   `module.test.ts` and `news/rss.test.ts`.

A `panel: "list"` module needs nothing else — the generic panel renders it,
including multi-field forms (`forms`), a single-field add (`quickAdd`),
zero-arg buttons (`actions`), a per-row action (`rowAction`), a secrets form
(`credentialFields`), and an opt-in auto-refresh toggle (`schedule`). A
`"chat"` or `"custom"` panel would get its own component — none exist yet;
every module so far fits the generic `"list"` panel.

## What's left (the honest list)

- **UI overhaul** — next up, by your request. Everything above is
  functional-first, default Tauri styling.
- **Social's `authType: "manual"` connectors** (Bluesky, X) have no
  `connect()` skill wired to a button the way oauth connectors do — Bluesky
  works via its credential fields + "Fetch all feeds"; X is intentionally a
  stub.
- No automated test coverage for anything added this pass beyond the
  existing 15 (manifest validation, RSS parsing, PKCE) — the new modules'
  logic (scope gating, scheduler, file search bounds) is reviewed-by-eye,
  not unit-tested yet. Worth adding once the shape of each settles post-UI-
  overhaul, rather than testing against UI that's about to change.
- Full security review deferred until this is in a real repo, per your plan
  to have it audited there (`/code-review`, `/security-review`) — the
  credential/OAuth/IMAP code in particular deserves that pass.
