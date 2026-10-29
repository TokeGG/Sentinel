// SQLite access for Home Network (Tauri-coupled). Extra per-device info lives in network_device_meta (migration 34).
import { getDb } from "../../core/db";
import { deviceInfo, portsByIp } from "./deviceInfo";
import { portChanges } from "./netLogic";

export interface DeviceRow extends Record<string, unknown> {
  id: number; ip: string; mac: string; tag: string | null; last_seen: string; hostname: string | null; notes: string | null; first_seen: string | null; icon: string | null; uptime: number | null;
}

export async function loadDevices(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  const rows = await d.select<DeviceRow[]>(
    `SELECT n.*, m.hostname, m.notes, m.first_seen, s.icon, (SELECT ROUND(AVG(u.up) * 100) FROM net_uptime u WHERE u.mac = n.mac) AS uptime FROM network_devices n LEFT JOIN network_device_meta m ON m.mac = n.mac LEFT JOIN net_device_style s ON s.mac = n.mac ORDER BY n.last_seen DESC`
  );
  const runs = await d.select<{ target: string; summary: string }[]>("SELECT target, summary FROM pentest_runs WHERE tool_id = 'port-scan' AND verdict = 'allowed' ORDER BY id");
  const ports = portsByIp(runs);
  const changes = portChanges(runs);
  return rows.map((r) => {
    const i = deviceInfo(r, ports);
    return { id: r.id, title: `${r.ip} — ${r.mac}`, label: r.tag, ip: r.ip, mac: r.mac, tag: r.tag, last_seen: r.last_seen, hostname: i.hostname, notes: i.notes, first_seen: r.first_seen, vendor: i.vendor, ports: i.ports, portChange: changes.get(r.ip.trim()) ?? null, icon: r.icon ?? "", uptime: r.uptime };
  });
}

export async function noteSeen(mac: string): Promise<void> {
  await (await getDb()).execute("INSERT OR IGNORE INTO network_device_meta (mac) VALUES ($1)", [mac]);
}
export async function saveInfo(mac: string, hostname: string, notes: string): Promise<void> {
  await (await getDb()).execute(
    "INSERT INTO network_device_meta (mac, hostname, notes) VALUES ($1,$2,$3) ON CONFLICT(mac) DO UPDATE SET hostname = $2, notes = $3", [mac, hostname, notes]);
}
export async function ipOf(mac: string): Promise<string | null> {
  return (await (await getDb()).select<{ ip: string }[]>("SELECT ip FROM network_devices WHERE mac = $1", [mac]))[0]?.ip ?? null;
}
