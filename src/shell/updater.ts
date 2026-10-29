// Manual, opt-in update check (Settings > Updates). Nothing here runs unless the
// user presses the button: no startup or background network call.
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateInfo = { version: string; notes: string };
type Update = NonNullable<Awaited<ReturnType<typeof check>>>;

let pending: Update | null = null;

export function describeUpdate(u: { version: string; body?: string | null }): UpdateInfo {
  return { version: u.version, notes: (u.body ?? "").trim() };
}

// null = already up to date.
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  pending = await check();
  return pending ? describeUpdate(pending) : null;
}

export async function installUpdate(): Promise<void> {
  if (!pending) throw new Error("No update to install: check for updates first.");
  await pending.downloadAndInstall();
  await relaunch();
}
