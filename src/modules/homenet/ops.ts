// Home Network skills (Tauri-coupled).
import { invoke } from "@tauri-apps/api/core";
import { getDb, logActivity } from "../../core/db";
import { addScopeEntry } from "../pentest/api";
import { ipOf, noteSeen, saveInfo } from "./netStore";

type Args = Record<string, unknown> | undefined;

export async function scanNetwork() {
  const devices = await invoke<{ ip: string; mac: string }[]>("get_network_devices");
  const d = await getDb();
  for (const dev of devices) {
    await d.execute(`INSERT INTO network_devices (ip, mac) VALUES ($1, $2) ON CONFLICT(mac) DO UPDATE SET ip = $1, last_seen = datetime('now')`, [dev.ip, dev.mac]);
    await noteSeen(dev.mac);
  }
  await logActivity("homenet", "scan_network", "read OS ARP cache (passive, no active sweep)", `${devices.length} device(s)`);
  return { ok: true, count: devices.length };
}

export async function tagDevice(args?: Args) {
  const mac = String(args?.mac ?? "");
  const tag = String(args?.tag ?? "");
  await (await getDb()).execute("UPDATE network_devices SET tag = $1 WHERE mac = $2", [tag, mac]);
  await logActivity("homenet", "tag_device", `tagged ${mac} as "${tag}"`, "ok");
  return { ok: true };
}

export async function forgetDevice(args?: Args) {
  const mac = String(args?.mac ?? "");
  if (!mac) throw new Error("device mac missing");
  await (await getDb()).execute("DELETE FROM network_devices WHERE mac = $1", [mac]);
  await logActivity("homenet", "forget_device", `forgot ${mac}`, "ok (reappears if the next scan sees it)");
  return { ok: true };
}

export async function deviceInfoSave(args?: Args) {
  const mac = String(args?.mac ?? "");
  if (!mac) throw new Error("device mac missing");
  await saveInfo(mac, String(args?.hostname ?? "").trim().slice(0, 100), String(args?.notes ?? "").trim().slice(0, 1000));
  return { ok: true };
}

/** The IP is read from the saved device list (not from the UI) and added as an explicit include of an ACTIVE engagement. */
export async function sendToLab(args?: Args) {
  const ip = await ipOf(String(args?.mac ?? ""));
  if (!ip) throw new Error("unknown device");
  const r = await addScopeEntry(Number(args?.engagementId), ip);
  await logActivity("homenet", "send_to_lab", `${ip} -> engagement #${args?.engagementId}`, r.already ? "already in scope" : "added");
  return r;
}
