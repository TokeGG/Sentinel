// Pure helpers for the PC Care panel. Units follow the Rust PcMetrics:
// RAM in MB, disks in GB, temp-file sizes in bytes.
type Row = Record<string, unknown>;
export type Unit = "mb" | "gb" | "bytes";

/** Section declarations; Panel renders exactly these ids. */
export const pccareSections = [
  { id: "gauges", label: "CPU & RAM" },
  { id: "disks", label: "Disks" },
  { id: "cleanup", label: "Temp cleanup" },
  { id: "actions", label: "Refresh" },
  { id: "tools", label: "Tools" },
];

export const PC_TOOL_TABS = [
  { id: "startup", label: "Startup" }, { id: "disk", label: "Disk" }, { id: "dupes", label: "Duplicates" },
  { id: "procs", label: "Processes" }, { id: "system", label: "System" }, { id: "files", label: "Sort files" },
  { id: "net", label: "Network" }, { id: "security", label: "Security" },
  { id: "games", label: "Game profiles" }, { id: "health", label: "Health" }, { id: "updates", label: "Updates" },
];

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** used/total as a percent clamped to 0-100 (one decimal); 0 for bad input. */
export function pctOf(used: number, total: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, (used / total) * 100)) * 10) / 10;
}

const PER_GB: Record<Unit, number> = { mb: 1024, gb: 1, bytes: 1024 ** 3 };

/** "7.9 GB" from a value in the given unit; "—" if not a number. */
export function gbText(value: number, unit: Unit): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value / PER_GB[unit]).toFixed(1)} GB`;
}

/** "4.0 / 16.0 GB" */
export function usageText(used: number, total: number, unit: Unit): string {
  return `${gbText(used, unit).replace(" GB", "")} / ${gbText(total, unit)}`;
}

export function humanBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 ** 2) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

export function previewSummary(files: { size_bytes: number }[]) {
  const count = files.length;
  const bytes = files.reduce((s, f) => s + (Number.isFinite(f.size_bytes) ? f.size_bytes : 0), 0);
  const text = count === 0 ? "Nothing to clean" : `${count} ${count === 1 ? "file" : "files"} · ${humanBytes(bytes)}`;
  return { count, bytes, text };
}

/** Splits load() rows (tagged by `kind`) into metrics vs the cleanup preview. */
export function splitRows(rows: Row[]) {
  const cpuRow = rows.find((r) => r.kind === "cpu");
  const ramRow = rows.find((r) => r.kind === "ram");
  const used = num(ramRow?.used_mb);
  const total = num(ramRow?.total_mb);
  const disks = rows
    .filter((r) => r.kind === "disk")
    .map((r) => ({ mount: String(r.mount ?? ""), used: num(r.used_gb) ?? 0, total: num(r.total_gb) ?? 0 }));
  const files = rows
    .filter((r) => r.kind === "tmp")
    .map((r) => ({ path: String(r.path ?? ""), size_bytes: num(r.size_bytes) ?? 0 }));
  return {
    cpu: num(cpuRow?.percent),
    ram: used !== null && total !== null ? { used, total } : null,
    disks,
    files,
    hasMetrics: Boolean(cpuRow || ramRow || disks.length),
    previewed: files.length > 0 || rows.some((r) => r.kind === "tmp-none"),
  };
}
