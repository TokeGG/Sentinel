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
    module.ts        — the ModuleManifest contract + validateManifest()
    ModulePanel.tsx   — the ONE generic panel every module renders through
    Sidebar.tsx       — left nav, built from the module registry
    db.ts             — shared SQLite handle + logActivity()
    credentials.ts    — OS keychain wrapper (TS side)
    scheduler.ts       — opt-in per-module background refresh
  modules/<name>/
    index.ts          — the module's ModuleManifest + its skills
    (other files)      — module-specific logic kept OUT of index.ts when it's
                          independently testable (see pentest/scope.ts,
                          news/rss.ts, youtube/pkce.ts)
  App.tsx             — imports every module (registers it) + mounts the shell

src-tauri/src/lib.rs  — ALL Rust commands + ALL SQLite migrations live in
                        this one file. Each module's migration is a numbered
                        `Migration { version: N, ... }` entry — version
                        numbers MUST stay strictly ascending and match their
                        position in the `migrations()` Vec, or the SQL
                        plugin applies them out of order.
```

## The module contract (read `src/core/module.ts` for the real types)

A module is a `ModuleManifest`: `id` (reverse-DNS, e.g. `"hub.notes"`),
`panel` (almost always `"list"`), `skills` (named async functions), and
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

`validateManifest()` rejects a module at registration time if any of these
reference a skill name that doesn't exist, so a typo fails loud, not silent.

## Patterns already established — copy these, don't reinvent

- **RSS/Atom fetching + dedupe**: `news/rss.ts` (pure parser, tested) +
  `news/index.ts` (fetch/store). `deals/index.ts` reuses `news/rss.ts`
  directly rather than duplicating a parser — do the same for any future
  feed-based module.
- **OAuth2 + PKCE, no client secret**: `youtube/pkce.ts` (pure, tested) +
  `youtube/index.ts`. The loopback-redirect catcher is a *generic* Rust
  command, `oauth_listen_once(port, timeout_secs)` — reused as-is by
  `social/connectors.ts` for Mastodon/Reddit on different ports. A new OAuth
  connector should reuse this command, not write a new one.
- **Multi-connector architecture**: `social/connectors.ts` — one
  `SocialConnector` interface, each platform is a standalone object in an
  array. Adding platform #5 is "write one connector, list it" — see that
  file's own comments before adding a 5th.
- **Preview-before-apply for anything destructive**: `pccare/index.ts`
  (temp-file cleanup) and `backup/index.ts` (restore). Never wire a delete
  straight to a button with no preview step.
- **Pure logic extracted for testability**: when a module's core decision
  (not its I/O) can be unit-tested without Tauri/DB, pull it into its own
  file and test it there — `pentest/scope.ts`, `news/rss.ts`,
  `youtube/pkce.ts` are the examples. The `index.ts` stays thin and
  Tauri-coupled; the extracted file stays pure and gets a `.test.ts`.

## Build & verify

```bash
npm install
npm run tauri dev          # full app, needs Tauri prerequisites installed
npx tsc --noEmit            # typecheck only, fast
npm run build                # typecheck + production frontend build
node --experimental-strip-types --test src/core/module.test.ts src/modules/news/rss.test.ts src/modules/youtube/pkce.test.ts src/modules/pentest/scope.test.ts
cd src-tauri && cargo test --lib   # Rust-side tests (file search walker)
```

35 TS tests + 5 Rust tests as of this commit. Run the relevant ones after
any change to `src/core/module.ts`, any `*/rss.ts`, `*/pkce.ts`, or
`pentest/scope.ts`.

## What's known-incomplete (check before assuming a gap is a bug)

- No UI overhaul yet — functional-first, default Tauri styling. Expected.
- `social/connectors.ts`'s Bluesky and X connectors are `authType: "manual"`
  (no OAuth) — Bluesky because AT Protocol has no public-client OAuth yet,
  X because its free API tier has no usable read endpoint (stubbed on
  purpose, throws a clear error).
- Nothing in this repo has been through a real Rust compile on Windows yet
  as of early commits — if you're asked to debug a build failure, check
  `Cargo.toml` version pins first (one was already wrong once: `imap = "3"`
  doesn't exist as a stable release, fixed to `"2"`).
- A full security review of the credential/OAuth/IMAP code hasn't happened
  yet — flagged as a known TODO, not a claim that it's been checked.
