// Non-module panels added by the desktop batch (opened like hub.settings/hub.master).
export const PALETTE_ID = "hub.palette";
export const BRIEFING_ID = "hub.briefing";
export const HELP_ID = "hub.help";
export const CAPTURE_ID = "hub.capture";
export const SNAP_ID = "hub.snap"; // Snap Layouts picker
export const DESK_SIZES: Record<string, { w: number; h: number }> = {
  [PALETTE_ID]: { w: 620, h: 440 },
  [BRIEFING_ID]: { w: 520, h: 600 },
  [HELP_ID]: { w: 560, h: 600 },
  [CAPTURE_ID]: { w: 420, h: 240 },
  [SNAP_ID]: { w: 460, h: 340 },
};
// Events: any webview -> main window.
export const SHELL_CMD = "shell-cmd";
export const PANEL_FOCUSED = "panel-focused";
export const PANEL_CLOSED = "panel-closed";
