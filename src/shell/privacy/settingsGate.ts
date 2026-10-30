// "Password-protect Settings": the app PIN is asked before the Settings panel opens (main window only).
import { requestUnlock } from "./lockStore";
import { loadSys } from "./sysPrefsStore";

export async function settingsGate(): Promise<boolean> {
  const p = await loadSys().catch(() => null);
  if (!p?.lockSettings) return true;
  return requestUnlock("Enter your PIN to open Settings");
}
