// Pure: every changeable value of the system/privacy batch, stored as one JSON row in app_settings `sys_prefs`.
// Everything that does work in the background defaults to OFF (0 / false).
export interface SysPrefs {
  tempWarnC: number; // sensor temperature warning (Celsius)
  diskAlertPct: number; // disk usage alert (% full)
  startupDelaySec: number; // wait before reopening panels at startup
  lowPower: boolean; // fewer animations (motion policy)
  presentation: boolean; // presentation mode: chosen panels closed, counts hidden
  presentationPanels: string[]; // module ids closed in presentation mode
  hideCounts: boolean; // hide unread counts on the title bar
  incognito: boolean; // no activity-log writes this session (reset at startup)
  autoClearDays: number; // 0 = off; else delete history older than N days at startup
  backupRemindDays: number; // 0 = off; backup moon after N days
  lockOnStart: boolean; // ask for the PIN when Sentinel starts
  lockSettings: boolean; // ask for the PIN before opening Settings
  scanHours: number; // 0 = off; Home Network re-scan interval while its Auto-refresh is on
}

export const SYS_KEY = "sys_prefs";
export const DEFAULT_SYS: SysPrefs = {
  tempWarnC: 85, diskAlertPct: 90, startupDelaySec: 0, lowPower: false, presentation: false, presentationPanels: [],
  hideCounts: false, incognito: false, autoClearDays: 0, backupRemindDays: 0, lockOnStart: false, lockSettings: false, scanHours: 0,
};

const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
};
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

export function sanitizeSys(raw: unknown): SysPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SYS;
  return {
    tempWarnC: num(r.tempWarnC, d.tempWarnC, 40, 110),
    diskAlertPct: num(r.diskAlertPct, d.diskAlertPct, 50, 99),
    startupDelaySec: num(r.startupDelaySec, d.startupDelaySec, 0, 120),
    lowPower: bool(r.lowPower, d.lowPower),
    presentation: bool(r.presentation, d.presentation),
    presentationPanels: Array.isArray(r.presentationPanels)
      ? [...new Set(r.presentationPanels.filter((x): x is string => typeof x === "string"))].slice(0, 100) : [],
    hideCounts: bool(r.hideCounts, d.hideCounts),
    incognito: bool(r.incognito, d.incognito),
    autoClearDays: num(r.autoClearDays, d.autoClearDays, 0, 3650),
    backupRemindDays: num(r.backupRemindDays, d.backupRemindDays, 0, 365),
    lockOnStart: bool(r.lockOnStart, d.lockOnStart),
    lockSettings: bool(r.lockSettings, d.lockSettings),
    scanHours: num(r.scanHours, d.scanHours, 0, 168),
  };
}

export function parseSys(text: string | null): SysPrefs {
  try { return sanitizeSys(text ? JSON.parse(text) : null); } catch { return sanitizeSys(null); }
}

/** Title-bar counts are hidden by the toggle or while presenting. */
export const countsHidden = (p: SysPrefs) => p.hideCounts || p.presentation;
