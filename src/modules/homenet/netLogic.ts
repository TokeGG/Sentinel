// Pure Home Network helpers: change detection between scans, port changes, uptime, map layout, icons.
import { parseOpen } from "./deviceInfo.ts";

export const DEVICE_ICONS = ["", "PC", "Laptop", "Phone", "Tablet", "TV", "Console", "Printer", "NAS", "Router", "Camera", "Speaker", "IoT"];

export interface NetEvent { kind: "new" | "back" | "ip"; mac: string; detail: string }

/** Events for this scan vs what the DB knew: never-seen MAC = new, known MAC with another IP = ip change. */
export function diffScan(known: Map<string, string>, now: { ip: string; mac: string }[]): NetEvent[] {
  const out: NetEvent[] = [];
  for (const d of now) {
    const prev = known.get(d.mac);
    if (prev === undefined) out.push({ kind: "new", mac: d.mac, detail: `new device at ${d.ip}` });
    else if (prev !== d.ip) out.push({ kind: "ip", mac: d.mac, detail: `IP ${prev} -> ${d.ip}` });
  }
  return out;
}

/** Per IP: ports opened/closed between its last two allowed port scans (rows oldest first). */
export function portChanges(runs: { target: string; summary: string }[]): Map<string, { opened: number[]; closed: number[] }> {
  const hist = new Map<string, number[][]>();
  for (const r of runs) {
    const p = parseOpen(r.summary);
    if (p) hist.set(r.target.trim(), [...(hist.get(r.target.trim()) ?? []), p].slice(-2));
  }
  const out = new Map<string, { opened: number[]; closed: number[] }>();
  for (const [ip, h] of hist) {
    if (h.length < 2) continue;
    const [a, b] = h;
    const opened = b.filter((x) => !a.includes(x)), closed = a.filter((x) => !b.includes(x));
    if (opened.length || closed.length) out.set(ip, { opened, closed });
  }
  return out;
}

/** Percent of pings that were up (null = never pinged). */
export function uptimePct(pings: { up: number | boolean }[]): number | null {
  if (!pings.length) return null;
  return Math.round((pings.filter((p) => Boolean(p.up)).length / pings.length) * 100);
}

export interface MapNode { id: string; label: string; x: number; y: number; gateway: boolean }

/** Gateway in the centre, every other device on a circle around it (SVG units, box w x h). */
export function mapLayout(devs: { mac: string; ip: string; label: string }[], gateway: string | null, w = 400, h = 300): MapNode[] {
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 30;
  const gw = devs.find((d) => d.ip === gateway);
  const rest = devs.filter((d) => d !== gw);
  const nodes: MapNode[] = [{ id: gw?.mac ?? "gateway", label: gw?.label ?? (gateway ? `Router ${gateway}` : "Router"), x: cx, y: cy, gateway: true }];
  rest.forEach((d, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, rest.length) - Math.PI / 2;
    nodes.push({ id: d.mac, label: d.label, x: Math.round(cx + r * Math.cos(a)), y: Math.round(cy + r * Math.sin(a)), gateway: false });
  });
  return nodes;
}

/** http://<gateway>/ if it is a private IPv4, else null (never links out to a public address). */
export function routerUrl(ip: string | null): string | null {
  if (!ip || !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)\d{1,3}\.\d{1,3}(\.\d{1,3})?$/.test(ip)) return null;
  return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? `http://${ip}/` : null;
}
