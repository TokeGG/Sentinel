import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { logActivity } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";

let lastBackups: { id: string; title: string }[] = [];

async function backupNow() {
  const dir = await openDialog({ directory: true, multiple: false });
  if (!dir || Array.isArray(dir)) return { ok: false, cancelled: true };

  const backupDir = await invoke<string>("backup_database", { destDir: dir });
  lastBackups = [{ id: backupDir, title: `Backed up to ${backupDir}` }, ...lastBackups].slice(0, 20);
  await logActivity("backup", "backup_now", "manual snapshot", backupDir);
  return { ok: true, backupDir };
}

async function restoreFrom(args?: Record<string, unknown>) {
  const dir = args?.dir
    ? String(args.dir)
    : await openDialog({ directory: true, multiple: false }).then((d) =>
        d && !Array.isArray(d) ? d : null
      );
  if (!dir) return { ok: false, cancelled: true };

  await invoke("restore_database", { backupDir: dir });
  await logActivity("backup", "restore_from", dir, "restored — restart the app to see it take effect");
  return { ok: true };
}

async function loadRows(): Promise<Record<string, unknown>[]> {
  return lastBackups;
}

export const backupModule: ModuleManifest = {
  id: "hub.backup",
  name: "Backup & Snapshot",
  description:
    "One-click backup/restore of Sentinel's own database — not your whole PC. Restart the app after a restore.",
  panel: "list",
  skills: [
    { name: "backup_now", run: backupNow },
    { name: "restore_from", run: restoreFrom },
  ],
  load: loadRows,
  actions: [
    { label: "Backup now…", skill: "backup_now" },
    { label: "Restore from…", skill: "restore_from" },
  ],
};

registerModule(backupModule);
