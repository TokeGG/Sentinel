# Discord Panel — Design (early test build)

Decision from the design interview: embed the **official Discord web app** in a panel (persistent login profile `discord`). No custom client, no user-token use (ToS).

## Hard requirements (user)
- Voice and video calls work inside the panel.
- **Go Live (stream your screen or a window) works.**
- **Watching other people's streams works**, with the panel resizable to a large size and an optional full-window mode.
- Stays logged in between launches; no desktop Discord needed.

## Known risks (cannot be verified without a Windows run)
- WebView2 permission prompts for microphone, camera and display capture: the web app needs `getUserMedia` / `getDisplayMedia` to be allowed. Tauri's `WebviewBuilder::on_permission_request` is available and will be used to allow media permissions only for `discord.com` origins and remember the choice.
- Screen-share picker: must appear when Go Live is clicked. If WebView2 shows no picker, fallback is a Sentinel-side source picker (list windows/screens from Rust) feeding the webview, which is a bigger change.
- System audio with a stream: browsers share tab or system audio only in some modes; may not carry game or desktop sound.
- Keyboard push-to-talk while the app is unfocused is not available to a web page (use voice activity or an in-panel key).

## Design
- Module `hub.discord`: `panel: "web"`, `web: { url: "https://discord.com/app", profile: "discord" }`, planet and panel like any other module. Game mode keeps it suspended, never destroyed (already in the keep list).
- Navigation guard (`on_navigation`) on every web panel: only `https` to an allow-list of hosts for that module (`discord.com`, `*.discord.com`, `discord.gg`, `*.discordapp.com`, `*.discordapp.net`); other links open in the system browser. Never allow the app's own origin (`tauri.localhost`) so a remote page can never reach IPC.
- Permissions: allow microphone, camera and display capture for the allow-listed hosts only; deny everything else by default.
- Panel size: min 480x360, default 1100x720; "Full window" toggle in the chrome strip (maximizes the panel to the main window client area, restores on toggle).
- Unread badge on the Discord planet is not available (no access to page state); skip.

## Test checklist for the user (Windows)
1. Log in once; close and reopen the app: still logged in.
2. Join a voice channel: others hear you; you hear them (mic permission prompt appears once).
3. Turn camera on: video appears.
4. Click Go Live, pick a screen or window: viewers see it; try with and without audio.
5. Watch someone else's stream: video plays; resize the panel and use Full window.
6. Click an external link: it opens in the default browser, not in the panel.

## Order
Build right after the panel UI foundation (early test build), so permission and picker problems show up before more is built on top.
