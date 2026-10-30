// Pure: plain-word explanations for Settings > Database check.
export interface RepairReport {
  fixes: ({ Checksum: number } | { DropUnknown: number } | { DropFailed: number })[];
  backup: string | null;
  error: string | null;
}

export function explainLoadProblem(problem: string | null): string {
  if (!problem) return "The database opened normally; all updates were applied.";
  const v = /VersionMismatch\((\d+)\)|migration (\d+) was previously applied but has been modified/i.exec(problem);
  if (v) return `Compatibility mode: update ${v[1] ?? v[2]} was changed after your database had already applied it, so the database refused all newer updates. Sentinel creates the missing tables itself; Repair fixes the record so updates apply again.`;
  const m = /VersionMissing\((\d+)\)|migration (\d+) was previously applied but is missing/i.exec(problem);
  if (m) return `Compatibility mode: your database was used by a newer or test build (update ${m[1] ?? m[2]} is unknown to this one). Repair forgets that entry; your data stays.`;
  const d = /Dirty\((\d+)\)|dirty/i.exec(problem);
  if (d) return `Compatibility mode: update ${d[1] ?? ""} stopped half way earlier. Repair clears it so it can run again.`;
  if (/Bootstrap failed/i.test(problem)) return `Some tables could not be created: ${problem}`;
  return `Compatibility mode: the database update step failed (${problem}). Sentinel created the missing tables itself.`;
}

export function describeRepair(r: RepairReport | null): string {
  if (!r) return "";
  if (r.error) return `Repair failed: ${r.error}`;
  if (!r.fixes.length) return "Nothing to repair: the update record matches this version.";
  const parts = r.fixes.map((f) =>
    "Checksum" in f ? `re-stamped ${f.Checksum}` : "DropUnknown" in f ? `forgot unknown ${f.DropUnknown}` : `cleared failed ${f.DropFailed}`);
  return `Repaired (${parts.join(", ")}). Backup: ${r.backup ?? "none"}. Restart Sentinel to apply pending updates.`;
}
