# Sentinel backlog (queued by the owner; built in themed batches, one commit each)

Done = see git log. Order below is the planned order.

## Requested fixes and features (batch list)
1. [done] Panels closed after alt-tab; drag lag; resize grip bottom-right
2. Crash on clone; cloned repos shown in GitHub panel with open-folder / open-program
3. YouTube: no repeated history entries; YouTube live chat in Chat
4. Delete old notes / stocks / tracked items; Congress "Sync" panel; Calendar+Tasks add and import
5. Deals/promos preloaded sites + like/dislike that trains the bot
6. Social: X, Facebook, Instagram as tabs inside one Social panel
7. Kick / d.gg chat connection diagnostics (visible connection log)
8. Lab: browser bot as a tab inside the Lab (through the scope gate); Home Network detail -> "send to Lab"
9. Map: 3D look, zoom/pan only, planets orbit but cannot be dragged; master hub (missed notifications) replaces the middle Settings button, Settings to a corner icon
10. More useful bundled skills

## Ideas round 1 (all accepted)
Universal search (Ctrl+K); daily briefing; per-module do-not-disturb; bot recipes (opt-in); price-drop alerts; clipboard history search + pins; quick-capture hotkey; scheduled backup to external drive (opt-in); Home Network new-device alerts + inventory; PC Care startup manager; named panel layouts.

## Ideas round 2 (all accepted)
Habit/streak tracker; focus timer; floating reminders; contacts; expense/subscription tracker; bookmarks/read-later; local document vault; journal mode; YouTube watch-later queue; per-channel upload moons; stream multiview; chat highlights/mention log; clip bookmarker; unified inbox mode; saved bot workflows; bot teach-by-demo; scheduled bot jobs (opt-in); bot site notebook; skill marketplace view; network map; change detector; findings kanban + report templates; wordlist/payload notebook; command palette; encrypted export/import of all settings.

## Ideas round 3 (all accepted)
Game launcher; performance overlay (opt-in); update watcher; disk treemap; duplicate finder; screenshot organizer; download sorter; power-plan switch; speed-test history; backup health check; note backlinks; voice memos; PDF/web clipper; flashcards; snippet library; local chat over notes (Ollama); notes digest; podcast player; now-playing widget; Twitch live list; YouTube not-interested training; image board viewer; show tracker; game news; sports ticker; deal price history; wishlist; crypto portfolio; budgets; bill reminders; receipt vault; coupon finder; PR/issue inbox; CI moons; project launcher; gist sync; commit stats; README writer (local model); breach checker (k-anonymity); own-PC port audit; Wi-Fi report; browser profile cleaner; permission audit; hash checker; secret scanner; themes + day/night sky; panel snapping/tiling; multi-monitor placement; ambient audio (off by default); first-run tour + help panel.

Principles that still apply to everything above: local-first, no hosted AI, nothing runs in the background without opt-in, secrets only in the OS keychain, Pentest Lab stays engagement-gated.

## Lab ideas (all accepted; every one runs through the engagement scope gate)
1. Scope importer (paste a client's scope document, review, then create the engagement)
2. Per-engagement checklist templates (recon, web, network, wifi, reporting)
3. Evidence locker: attach screenshots/output to findings, hashed with timestamps
4. Run replay: re-run any logged run with the same arguments (gate re-checked)
5. Service fingerprint notes: banner/version history per host with change highlights
6. Credential-free web checks: security headers, cookie flags, TLS and cert expiry
7. DNS toolbox: records, zone hints, subdomain list from certificate transparency (in-scope domains only)
8. Port-scan profiles (quick / common / full) with rate limit and polite delay
9. CVE lookup from a local offline dataset by product+version (user-fed, no cloud)
10. Timeline view of an engagement (runs, findings, notes) for the report
11. Report templates: executive summary, technical detail, remediation table; export Markdown/HTML
12. Remediation tracker with retest button that re-runs the original check
13. Lab notebook with tagged commands and snippets per engagement
14. Scope drift alerts: a discovered host outside scope is listed but never touched
15. Bot-assisted triage: the local bot summarises run output and drafts findings for review (never runs tools out of scope)

## Final steps (owner-authorised)
- When everything above is built: open one PR, merge it, start the Windows app build (tag-driven release; tag creation may need the owner).
- Then test and "head-start" the browser bot: Playwright-driven fixture pages exercising driver.js and the agent loop with a scripted model, starter knowledge notes, a task-understanding step (restate goal, plan, success check), prompt and brain-default improvements. Real-Ollama / WebView2 behaviour still needs the owner's PC.

## Accounts: one "Connect" button (owner request)
Generic connect framework: OAuth2 PKCE (loopback via oauth_listen_once; GitHub/Twitch via device-code), tokens in the OS keychain with silent refresh, one "Connect" / "Disconnect" button per account in every module. Providers: Mastodon (dynamic client registration, no setup), Gmail + Outlook/Microsoft 365 mail (IMAP/SMTP XOAUTH2 in Rust), Google (YouTube subs import), Twitch (chat send), GitHub (device flow), Reddit, Kick, Bluesky OAuth if public clients are supported. Needs one-time client IDs (public, free) from the owner for Google, Microsoft, Twitch, Reddit, GitHub; the app ships them as config.

## Ideas round 4: 100 QoL features (all accepted, grouped)
Shell/navigation: jump-to-panel typing; panel tabs; pin on top; hover peek; per-monitor map; global summon hotkey; tray icon with counts; start with Windows (opt-in); launch into saved layout; reopen last closed panel; back/forward between panels; focus mode.
Notifications: master hub grouped + mark-all-read; snooze per module; quiet hours from calendar; priority moons; Windows toasts (off by default); daily digest mode; keyword alerts; notification history search.
Notes: markdown editor + preview; tags + folders; daily note; pin/archive; templates; attachments; version history; full-text search; export md/pdf; clipper hotkey; mind-map of links; review queue.
Calendar/tasks: month/week/day/agenda; recurring; ICS import/export; Google/Outlook sync (after connect); subtasks; smart lists; drag task to calendar; floating reminders; time blocking; natural-language add.
Mail: unified inbox; snooze; rules; unsubscribe helper; attachment download/preview; draft autosave; contacts autocomplete; threads.
YouTube/Chat/Social: playlists; channel groups; speed memory; continue watching; picture-in-picture; chat nicknames/colours; ignore list + filters; emote picker; searchable chat logs; social lists; scheduled posts (opt-in); mute words.
News/Deals/Congress/Finance: topic boosts; source tags; read-later + highlights; duplicate story grouping; deal price history + fair-price badge; deal categories; promo-code collector; wishlist alerts; bill tracker timeline; my representatives + votes; follow a bill; watchlist groups; price alerts; portfolio lots + gain/loss.
Dev/PC/Network: PR/issue inbox; local git status; open in editor/terminal; startup manager (preview); large-file finder; process viewer (confirm kill); temperature graphs; device naming/icons; uptime history; wake-on-LAN; port-change alerts; router links.
Lab/Bot: engagement templates; scope CIDR calculator; CVSS fields; screenshot evidence from bot browser; command session recording; bot goal templates; dry-run; step approval; watch pages (opt-in schedule); explain-why per step; brain share/import; weekly "what I learned".

## Style decisions (owner interview)
Flat Pro base; each module may have its own style; balanced density; tinted surfaces per-module accent; strip shows name + status dot + hover-only controls; media panels mimic real-site layout in Sentinel colours; Lab/Pentest/Bot = full terminal with hacker-movie flair; 3D map = realistic shaded planets (later).
