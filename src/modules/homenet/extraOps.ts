// Home Network extras (Tauri-coupled): ping targets list, the opt-in scheduled run, nicknames store.
import { invoke } from "@tauri-apps/api/core";
import { logActivity } from "../../core/db";
import { getSetting, setSetting } from "../../ui/appSetting";
import { parseSys, SYS_KEY } from "../../shell/privacy/sysPrefs";
import { NICK_KEY, parseNicknames, parseTargets, SCAN_LAST_KEY, scanDue, setNickname, TARGETS_KEY } from "./extras";
import { pingAll } from "./netOps";
import { scanNetwork } from "./ops";

export const getTargets = async () => parseTargets(await getSetting(TARGETS_KEY));
export const saveTargets = (t: string[]) => setSetting(TARGETS_KEY, JSON.stringify(t));
export const getNicknames = async () => parseNicknames(await getSetting(NICK_KEY));
export async function saveNickname(mac: string, name: string) {
  await setSetting(NICK_KEY, JSON.stringify(setNickname(await getNicknames(), mac, name)));
}

/** Pings the user's own target list (button, or the scheduled run). */
export async function pingTargets() {
  const t = await getTargets();
  if (!t.length) return { ok: true, results: [] };
  const res = await invoke<[string, boolean][]>("ping_hosts", { ips: t });
  await logActivity("homenet", "ping_targets", `${t.length} target(s)`, `${res.filter((r) => r[1]).length} up`);
  return { ok: true, results: res.map(([ip, up]) => ({ ip, up })) };
}

/** The schedule skill: runs only while the module's Auto-refresh toggle is on. Pings devices and targets;
 *  re-scans the ARP cache only when Settings > System "scan every N hours" (default 0 = off) is due. */
export async function scheduledRun() {
  await pingAll();
  await pingTargets();
  const hours = parseSys(await getSetting(SYS_KEY)).scanHours;
  if (scanDue(await getSetting(SCAN_LAST_KEY), hours, Date.now())) {
    await scanNetwork();
    await setSetting(SCAN_LAST_KEY, new Date().toISOString());
  }
  return { ok: true };
}
