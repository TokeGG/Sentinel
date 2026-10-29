# Discord panel: Windows test checklist (2026-10-29)

Built and compile-checked only; nothing here has run in WebView2. Open the Discord planet.

1. Log in once; close and reopen the app: still logged in.
2. Join a voice channel: others hear you, you hear them (mic prompt appears at most once).
3. Turn the camera on: your video appears.
4. Click Go Live, pick a screen or window: viewers see it. Try with and without audio. If no picker appears, note it (spec fallback: Sentinel-side source picker).
5. Watch someone else's stream: video plays; resize the panel and use Full window.
6. Click an external link: it opens in the default browser, not in the panel.
7. Full window (chrome strip, right of the title): fills the main window; click again restores the previous size and position.
8. Unread moon: get a message while the panel is open; a count moon appears on the Discord planet (count only). Read it; the moon clears. Closing the panel clears it.
9. Game mode: start a game (or the manual button): Discord stays alive (hidden), voice keeps running; leaving game mode shows it again.
10. Captcha/login works (hCaptcha iframe is not blocked by the allow-list).
