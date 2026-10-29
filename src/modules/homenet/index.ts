import { invoke } from "@tauri-apps/api/core";
import { getDb, logActivity } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";
import { homenetSections } from "./panelLogic";

interface RawDevice {
  ip: string;
  mac: string;
}

interface DeviceRow extends Record<string, unknown> {
  id: number;
  ip: string;
  mac: string;
  tag: string | null;
  last_seen: string;
}

async function scanNetwork() {
  const devices = await invoke<RawDevice[]>("get_network_devices");
  const d = await getDb();
  for (const dev of devices) {
    await d.execute(
      `INSERT INTO network_devices (ip, mac) VALUES ($1, $2)
       ON CONFLICT(mac) DO UPDATE SET ip = $1, last_seen = datetime('now')`,
      [dev.ip, dev.mac]
    );
  }
  await logActivity(
    "homenet",
    "scan_network",
    "read OS ARP cache (passive, no active sweep)",
    `${devices.length} device(s)`
  );
  return { ok: true, count: devices.length };
}

async function tagDevice(args?: Record<string, unknown>) {
  const mac = String(args?.mac ?? "");
  const tag = String(args?.tag ?? "");
  const d = await getDb();
  await d.execute("UPDATE network_devices SET tag = $1 WHERE mac = $2", [tag, mac]);
  await logActivity("homenet", "tag_device", `tagged ${mac} as "${tag}"`, "ok");
  return { ok: true };
}

async function loadDevices(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  const rows = await d.select<DeviceRow[]>(
    "SELECT * FROM network_devices ORDER BY last_seen DESC"
  );
  return rows.map((r) => ({
    id: r.id,
    title: `${r.ip} — ${r.mac}`,
    label: r.tag,
    ip: r.ip,
    mac: r.mac,
    tag: r.tag,
    last_seen: r.last_seen,
  }));
}

export const homeNetModule: ModuleManifest = {
  id: "hub.homenet",
  name: "Home Network",
  accent: "#2ee6d0",
  ring: "system",
  icon: "homenet",
  description:
    "Devices from your OS's own ARP cache — passive, no active scan. Doubles as the allow-list source for the Pentest Lab's own-infrastructure scope.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: homenetSections },
  skills: [
    { name: "scan_network", run: scanNetwork },
    { name: "tag_device", run: tagDevice },
  ],
  load: loadDevices,
  actions: [{ label: "Scan now", skill: "scan_network" }],
};

registerModule(homeNetModule);
