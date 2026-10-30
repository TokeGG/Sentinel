// Applies the chosen theme to this webview's :root. Used by the main window AND every panel/chrome
// webview, so panels follow the theme too. No theme chosen + Terminal home = the terminal theme.
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getSetting } from "../../ui/appSetting";
import { DESK_CHANGED, getDesk } from "./store";
import { isTheme, THEMES } from "./theme";
import { cleanCustom, customVars, DEFAULT_CUSTOM, SEASON_VARS, seasonOf } from "./look";

const ALL_KEYS = [...Object.values(THEMES), customVars({ ...DEFAULT_CUSTOM, font: "x" }), ...Object.values(SEASON_VARS)].flatMap(Object.keys);

/** Theme id actually used: an explicit choice wins; otherwise the home style decides. */
export const effectiveTheme = (theme: string, home: string) => (theme && theme !== "default" ? theme : (home || "terminal") === "terminal" ? "terminal" : "default");

export async function applyTheme(): Promise<void> {
  const root = document.documentElement.style;
  for (const k of ALL_KEYS) root.removeProperty(k);
  let c: unknown = null;
  try { c = JSON.parse((await getSetting("custom_theme")) ?? "null"); } catch { /* default */ }
  THEMES.custom = customVars(cleanCustom(c));
  const id = effectiveTheme(await getDesk("theme"), await getDesk("home_style"));
  const vars = (await getSetting("seasonal_theme")) === "1" ? SEASON_VARS[seasonOf(new Date())] : isTheme(id) ? THEMES[id] : {};
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
}

/** Panels and chrome strips: apply now and whenever any webview changes desk settings. */
export function useThemeSync(): void {
  useEffect(() => {
    applyTheme().catch(() => {});
    const un = listen(DESK_CHANGED, () => void applyTheme().catch(() => {}));
    return () => void un.then((f) => f());
  }, []);
}
