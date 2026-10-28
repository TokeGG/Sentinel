# Webview overlap spike — run on Windows

Not run in CI (needs WebView2 and a display). Run once with `npm run tauri dev` after Task 7 lands, open five panels (YouTube, Discord, three modules), then fill this in.

| Check | Result |
|---|---|
| Raise a lower panel above others: ms, any flicker | |
| Session (login) survives raise via re-create with shared profile | |
| Memory: msedgewebview2 tree with 5 panels vs 1 (MB) | |
| Clicks and keyboard focus reach the topmost panel | |

**Decision rule:** keep B (all webviews) if raise < 300 ms with session preserved and 5 panels add < 1 GB. Otherwise switch to A (web panels always above normal panels) by making `focus_panel` skip raising non-web panels.
