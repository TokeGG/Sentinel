// Pure names shared by the chrome strip (sender) and PanelRoute (listener).

/** Chrome gear -> that panel's content webview; payload `{ id }`. */
export const PANEL_CUSTOMIZE = "panel-customize";

/** Content-webview label; must match `label()` in src-tauri/src/panels/ids.rs. */
export const panelLabel = (id: string): string => `panel-${id.replace(/\./g, "_")}`;
