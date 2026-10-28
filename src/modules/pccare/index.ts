import { invoke } from "@tauri-apps/api/core";
import { logActivity } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";

interface DiskMetric {
  mount: string;
  used_gb: number;
  total_gb: number;
}

interface PcMetrics {
  cpu_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  disks: DiskMetric[];
}

interface TempFile {
  path: string;
  size_bytes: number;
}

let last: PcMetrics | null = null;
let previewedFiles: TempFile[] | null = null; // null = showing metrics, not preview mode

async function getMetrics() {
  previewedFiles = null; // refreshing metrics exits preview mode
  last = await invoke<PcMetrics>("get_pc_metrics");
  await logActivity(
    "pccare",
    "get_metrics",
    "read-only snapshot",
    `CPU ${last.cpu_percent.toFixed(0)}%, RAM ${last.ram_used_mb}/${last.ram_total_mb} MB`
  );
  return last;
}

// Allowlisted to exactly the OS temp directory — see the Rust command's own
// comment. Read-only: nothing is deleted by this step.
async function previewCleanup() {
  previewedFiles = await invoke<TempFile[]>("preview_temp_cleanup");
  const totalBytes = previewedFiles.reduce((sum, f) => sum + f.size_bytes, 0);
  await logActivity(
    "pccare",
    "preview_cleanup",
    "listed temp dir (read-only)",
    `${previewedFiles.length} file(s), ${(totalBytes / 1e6).toFixed(1)} MB`
  );
  return { ok: true, count: previewedFiles.length };
}

// Only ever deletes exactly the paths this session's own preview just
// listed — never re-scans, never takes a path from anywhere else.
async function applyCleanup() {
  if (!previewedFiles || previewedFiles.length === 0) {
    throw new Error('nothing previewed — click "Preview temp cleanup" first');
  }
  const paths = previewedFiles.map((f) => f.path);
  const [deleted, failed] = await invoke<[number, number]>("apply_temp_cleanup", { paths });
  await logActivity("pccare", "apply_cleanup", `${paths.length} file(s) targeted`, `${deleted} deleted, ${failed} failed`);
  previewedFiles = null;
  return { ok: true, deleted, failed };
}

async function loadRows(): Promise<Record<string, unknown>[]> {
  if (previewedFiles) {
    return previewedFiles.map((f, i) => ({
      id: `tmp-${i}`,
      title: `${f.path} (${(f.size_bytes / 1024).toFixed(0)} KB)`,
    }));
  }
  const m = last ?? (await getMetrics());
  const rows: Record<string, unknown>[] = [
    { id: "cpu", title: `CPU: ${m.cpu_percent.toFixed(1)}%` },
    {
      id: "ram",
      title: `RAM: ${m.ram_used_mb} / ${m.ram_total_mb} MB (${((m.ram_used_mb / m.ram_total_mb) * 100).toFixed(0)}%)`,
    },
  ];
  for (const d of m.disks) {
    rows.push({
      id: `disk-${d.mount}`,
      title: `${d.mount}: ${d.used_gb.toFixed(1)} / ${d.total_gb.toFixed(1)} GB`,
    });
  }
  return rows;
}

export const pcCareModule: ModuleManifest = {
  id: "hub.pccare",
  name: "PC Care",
  description:
    'Live CPU/RAM/disk metrics. "Preview temp cleanup" lists your OS temp folder (read-only); "Apply cleanup" deletes exactly what was previewed, nothing else. "Refresh" returns to the metrics view.',
  panel: "list",
  skills: [
    { name: "get_metrics", run: getMetrics },
    { name: "preview_cleanup", run: previewCleanup },
    { name: "apply_cleanup", run: applyCleanup },
  ],
  load: loadRows,
  actions: [
    { label: "Refresh", skill: "get_metrics" },
    { label: "Preview temp cleanup", skill: "preview_cleanup" },
    { label: "Apply cleanup", skill: "apply_cleanup" },
  ],
};

registerModule(pcCareModule);
