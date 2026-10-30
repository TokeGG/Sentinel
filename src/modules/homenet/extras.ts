// Pure Home Network extras: device nicknames (app_settings `net_nicknames`, MAC -> name), extra ping targets
// (`net_ping_targets`), and the opt-in re-scan interval check (`homenet_scan_last`).
export const NICK_KEY = "net_nicknames";
export const TARGETS_KEY = "net_ping_targets";
export const SCAN_LAST_KEY = "homenet_scan_last";

const mac = (m: string) => m.trim().toLowerCase();

export function parseNicknames(text: string | null): Record<string, string> {
  try {
    const v = JSON.parse(text ?? "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, n] of Object.entries(v)) if (typeof n === "string" && n.trim()) out[mac(k)] = n.trim().slice(0, 60);
    return out;
  } catch { return {}; }
}

export function setNickname(all: Record<string, string>, m: string, name: string): Record<string, string> {
  const next = { ...all };
  if (name.trim()) next[mac(m)] = name.trim().slice(0, 60);
  else delete next[mac(m)];
  return next;
}

export const nickOf = (all: Record<string, string>, m: string) => all[mac(m)] ?? null;

/** IPv4 only (the Rust ping_hosts command pings IPv4 addresses and nothing else). */
export const validTarget = (t: string) => /^(\d{1,3})(\.\d{1,3}){3}$/.test(t) && t.split(".").every((x) => Number(x) <= 255);

export function parseTargets(text: string | null): string[] {
  const raw = (() => { try { const v = JSON.parse(text ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } })();
  return [...new Set(raw.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(validTarget))].slice(0, 30);
}

/** "a, b\nc" -> valid unique targets. */
export const splitTargets = (s: string) => [...new Set(s.split(/[\s,]+/).map((x) => x.trim()).filter(validTarget))].slice(0, 30);

/** hours 0 = off. Due when never scanned or older than the interval. */
export function scanDue(lastIso: string | null, hours: number, nowMs: number): boolean {
  if (!(hours > 0)) return false;
  const t = lastIso ? Date.parse(lastIso) : NaN;
  return !Number.isFinite(t) || nowMs - t >= hours * 3_600_000;
}
