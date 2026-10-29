// Home Network extras (Tauri-coupled): pings (manual or opt-in schedule), wake-on-LAN, icons, change events.
import { invoke } from "@tauri-apps/api/core";
import { getDb, logActivity } from "../../core/db";
import { DEVICE_ICONS, diffScan } from "./netLogic";

type Args = Record<string, unknown> | undefined;

/** Called by scanNetwork BEFORE it upserts, so "new" means never in the DB before. */
export async function recordScanEvents(now: { ip: string; mac: string }[]) {
  const d = await getDb();
  const known = new Map((await d.select<{ mac: string; ip: string }[]>("SELECT mac, ip FROM network_devices")).map((r) => [r.mac, r.ip]));
  for (const e of diffScan(known, now)) await d.execute("INSERT INTO net_events (kind, mac, detail) VALUES ($1,$2,$3)", [e.kind, e.mac, e.detail]);
}

export async function pingAll() {
  const d = await getDb();
  const devs = await d.select<{ mac: string; ip: string }[]>("SELECT mac, ip FROM network_devices");
  const res = await invoke<[string, boolean][]>("ping_hosts", { ips: devs.map((x) => x.ip) });
  const up = new Map(res);
  for (const x of devs) await d.execute("INSERT INTO net_uptime (mac, up) VALUES ($1,$2)", [x.mac, up.get(x.ip) ? 1 : 0]);
  await d.execute("DELETE FROM net_uptime WHERE at < datetime('now', '-30 days')");
  const n = res.filter((r) => r[1]).length;
  await logActivity("homenet", "ping_all", `${devs.length} device(s)`, `${n} up`);
  return { ok: true, up: n };
}

export async function wakeDevice(args?: Args) {
  const mac = String(args?.mac ?? "");
  await invoke("wake_on_lan", { mac });
  await logActivity("homenet", "wake_on_lan", mac, "magic packet sent");
  return { ok: true };
}

export async function setIcon(args?: Args) {
  const mac = String(args?.mac ?? ""), icon = String(args?.icon ?? "");
  if (!mac || !DEVICE_ICONS.includes(icon)) throw new Error("unknown icon");
  await (await getDb()).execute("INSERT INTO net_device_style (mac, icon) VALUES ($1,$2) ON CONFLICT(mac) DO UPDATE SET icon = $2", [mac, icon]);
  return { ok: true };
}

export async function markEventsSeen() {
  await (await getDb()).execute("UPDATE net_events SET seen = 1 WHERE seen = 0");
  return { ok: true };
}

export interface EventRow { id: number; kind: string; mac: string; detail: string; at: string; seen: number }
export async function recentEvents(): Promise<EventRow[]> {
  return (await getDb()).select<EventRow[]>("SELECT * FROM net_events ORDER BY id DESC LIMIT 50");
}

/** Moon count: unseen NEW-device events only (a count, never names). */
export async function newDeviceCount(): Promise<number> {
  const r = await (await getDb()).select<{ n: number }[]>("SELECT COUNT(*) AS n FROM net_events WHERE seen = 0 AND kind = 'new'");
  return r[0]?.n ?? 0;
}

export const gatewayIp = () => invoke<string | null>("default_gateway");
