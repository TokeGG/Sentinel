# Sentinel style decisions (owner interview)

- Base look: "Flat Pro" - flat dark surfaces, hairline borders, 6-8px radii, calm and fast (Discord/Linear).
- Each module may layer its own style on that base (not one look everywhere); balanced density.
- Per-panel colour = tinted surfaces: the module accent tints header, selection, cards and body slightly.
- Panel strip (24px, `shell/ChromeRoute.tsx`): small muted name, tiny status dot (lit = new items), controls appear on hover only.
- Media modules (YouTube, chat...): mimic the LAYOUT of the real sites with Sentinel colours/fonts, no branding.
- Lab / Pentest / Bot: terminal style (monospace, sharp corners, phosphor accent, subtle scanlines/glow, animated status lines). Keep animation cheap; obey the motion policy (reduced motion / ignore_reduced_motion / game mode). Step 2.
- 3D map (shaded planets, tilted orbits, parallax) is a later task; the map reads only `accent` (hue), so nothing here blocks it.

## Tokens (`src/ui/tokens.css`)
Layers `--base` < `--raised` < `--overlay`; per panel `--surface`, `--surface-2`, `--line` (tinted by `--accent` x `--tint`).
Accent family: `--accent`, `--accent-soft`, `--accent-line`, `--accent-text`, `--on-accent`.
Scale: `--sp-1..5` (4/8/16/24/32), `--r-sm/--radius/--r-lg` (6/8/8), `--fs-xs..xl`, `--elev-1/2`, `--hover`, `--press`, `--focus`.
Fixed sizes: `--titlebar-h` 32 (TITLEBAR_H in shell/layout.ts), `--chrome-h` 24 (CHROME_H in panels/geometry.rs); tests enforce sync.
Accents: unique per module, validated by `src/ui/accents.test.ts`.
