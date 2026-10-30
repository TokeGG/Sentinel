// Pure PC extras: threshold alerts, best-effort per-app power share, speed chart points, overlay lines,
// desktop sort plan (reuses sorter.ts) and the manual update-check list.
import { planSort, type DirFile, type Move } from "./sorter.ts";

export interface Disk { mount: string; used_gb: number; total_gb: number }
export interface Sensor { label: string; temp: number | null }
export interface Proc { pid: number; name: string; cpu: number; mem_mb: number }

export const diskAlerts = (disks: Disk[], pct: number) =>
  disks.filter((d) => d.total_gb > 0 && (d.used_gb / d.total_gb) * 100 >= pct)
    .map((d) => `${d.mount} is ${Math.round((d.used_gb / d.total_gb) * 100)}% full (alert at ${pct}%)`);

export const hotSensors = (s: Sensor[], c: number) =>
  s.filter((x) => x.temp !== null && x.temp >= c).map((x) => `${x.label} at ${Math.round(x.temp!)}°C (warn at ${c}°C)`);

/** Share of CPU per app as a power proxy (Windows exposes no per-app watts to us). null = not available. */
export function powerShare(procs: Proc[], top = 10): { name: string; share: number }[] | null {
  const total = procs.reduce((a, p) => a + Math.max(0, p.cpu), 0);
  if (!procs.length || total <= 0) return null;
  const by = new Map<string, number>();
  for (const p of procs) by.set(p.name, (by.get(p.name) ?? 0) + Math.max(0, p.cpu));
  return [...by.entries()].map(([name, c]) => ({ name, share: Math.round((c / total) * 1000) / 10 }))
    .filter((x) => x.share > 0).sort((a, b) => b.share - a.share).slice(0, top);
}

/** Oldest-first Mbps values for a sparkline (rows come newest first). */
export const speedSeries = (rows: { mbps: number }[]) => rows.map((r) => r.mbps).filter(Number.isFinite).reverse();

export interface OverlayStats { cpu: number | null; ram: number | null; gpu: number | null; temp: number | null }
export const overlayLines = (s: OverlayStats) => [
  `CPU ${s.cpu === null ? "n/a" : `${Math.round(s.cpu)}%`}`, `RAM ${s.ram === null ? "n/a" : `${Math.round(s.ram)}%`}`,
  `GPU ${s.gpu === null ? "n/a" : `${Math.round(s.gpu)}%`}`, `TEMP ${s.temp === null ? "n/a" : `${Math.round(s.temp)}°C`}`,
];

const SKIP = /\.(lnk|url|ini)$/i;
/** Desktop clean-up: same rules as the download sorter, shortcuts and desktop.ini stay. */
export const planDesktop = (dir: string, files: DirFile[]): Move[] => planSort(dir, files.filter((f) => !SKIP.test(f.name)));

export interface UpdateEntry { name: string; repo: string; installed: string }
export const UPDATE_KEY = "update_list";
export const validRepo = (r: string) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(r.trim());

export function parseUpdates(text: string | null): UpdateEntry[] {
  try {
    const v = JSON.parse(text ?? "[]");
    return Array.isArray(v) ? v.filter((e) => e && typeof e.name === "string" && validRepo(String(e.repo ?? "")))
      .map((e) => ({ name: e.name.slice(0, 80), repo: e.repo.trim(), installed: String(e.installed ?? "").slice(0, 40) })).slice(0, 50) : [];
  } catch { return []; }
}

const parts = (v: string) => v.replace(/^v/i, "").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
/** true when `latest` is a higher version than `installed` (empty installed = unknown -> false). */
export function isNewer(latest: string, installed: string): boolean {
  if (!installed.trim() || !latest.trim()) return false;
  const a = parts(latest), b = parts(installed);
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}
