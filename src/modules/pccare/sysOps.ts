// PC Care extras (Tauri-coupled): disk history, overlay stats for the Terminal home, update checks.
import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { getSetting, setSetting } from "../../ui/appSetting";
import { addSamples, HIST_KEY, parseHist, type DiskSample } from "./forecast";
import { isNewer, parseUpdates, UPDATE_KEY, type OverlayStats, type UpdateEntry } from "./alerts";

const today = () => new Date().toISOString().slice(0, 10);

/** Called when PC Care reads metrics (user action or its opt-in schedule); never samples on its own. */
export async function recordDisks(disks: { mount: string; used_gb: number; total_gb: number }[]): Promise<void> {
  await setSetting(HIST_KEY, JSON.stringify(addSamples(await diskHistory(), disks, today())));
}
export const diskHistory = async (): Promise<DiskSample[]> => parseHist(await getSetting(HIST_KEY));

/** CPU/GPU overlay data for the Terminal home (call on demand). GPU load has no portable source: null. */
export async function getOverlayStats(): Promise<OverlayStats> {
  const m = await invoke<{ cpu_percent: number; ram_used_mb: number; ram_total_mb: number }>("get_pc_metrics").catch(() => null);
  const s = await invoke<{ temp: number | null }[]>("list_sensors").catch(() => []);
  const temps = s.map((x) => x.temp).filter((t): t is number => typeof t === "number");
  return {
    cpu: m ? m.cpu_percent : null,
    ram: m && m.ram_total_mb > 0 ? (m.ram_used_mb / m.ram_total_mb) * 100 : null,
    gpu: null,
    temp: temps.length ? Math.max(...temps) : null,
  };
}

export const getUpdates = async () => parseUpdates(await getSetting(UPDATE_KEY));
export const saveUpdates = (u: UpdateEntry[]) => setSetting(UPDATE_KEY, JSON.stringify(u));

export interface UpdateResult { entry: UpdateEntry; latest: string | null; newer: boolean; error?: string }

/** Button only: asks GitHub for each entry's latest release tag. */
export async function checkUpdates(list: UpdateEntry[]): Promise<UpdateResult[]> {
  const out: UpdateResult[] = [];
  for (const entry of list) {
    try {
      const r = await fetch(`https://api.github.com/repos/${entry.repo}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
      if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
      const tag = String(((await r.json()) as { tag_name?: string }).tag_name ?? "");
      out.push({ entry, latest: tag || null, newer: isNewer(tag, entry.installed) });
    } catch (e) { out.push({ entry, latest: null, newer: false, error: String(e) }); }
  }
  return out;
}
