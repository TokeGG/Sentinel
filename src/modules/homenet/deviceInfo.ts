// Pure view-model helpers for the richer Home Network device rows.
import { vendorOf } from "./oui.ts";

/** "open: 22, 80" -> [22, 80]; "no open ports ..." -> []; anything else -> null. */
export function parseOpen(summary: string): number[] | null {
  const m = /^open: ([\d, ]+)$/.exec(summary.trim());
  if (m) return m[1].split(",").map((x) => Number(x.trim())).filter((n) => n > 0);
  return /^no open ports/.test(summary.trim()) ? [] : null;
}

/** Latest allowed port-scan summary per IP (rows are oldest first). null = never scanned. */
export function portsByIp(runs: { target: string; summary: string }[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const r of runs) {
    const p = parseOpen(r.summary);
    if (p) out.set(r.target.trim(), p);
  }
  return out;
}

export interface DeviceInfo {
  ip: string; mac: string; vendor: string; hostname: string; notes: string; tag: string;
  firstSeen: string; lastSeen: string; ports: number[] | null;
}
export function deviceInfo(r: Record<string, unknown>, ports: Map<string, number[]>): DeviceInfo {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    ip: s(r.ip), mac: s(r.mac), vendor: vendorOf(s(r.mac)), hostname: s(r.hostname), notes: s(r.notes), tag: s(r.tag),
    firstSeen: s(r.first_seen) || "before tracking", lastSeen: s(r.last_seen), ports: ports.get(s(r.ip).trim()) ?? null,
  };
}
export const portsText = (p: number[] | null) => (p === null ? "not scanned" : p.length ? p.join(", ") : "none open");
