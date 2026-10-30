// TOTP secrets live ONLY in the OS keychain (service hub.totp); app_settings `totp_labels` keeps the names (no secrets).
import { deleteCredential, getCredential, setCredential } from "./credentials";
import { getSetting, setSetting } from "../ui/appSetting";

const SVC = "hub.totp", KEY = "totp_labels";
export async function labels(): Promise<string[]> {
  try { const a = JSON.parse((await getSetting(KEY)) ?? "[]"); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}
export async function addCode(label: string, secret: string) {
  const l = await labels();
  if (l.includes(label)) throw new Error("a code with that name exists");
  await setCredential(SVC, label, secret);
  await setSetting(KEY, JSON.stringify([...l, label]));
}
export async function removeCode(label: string) {
  await deleteCredential(SVC, label);
  await setSetting(KEY, JSON.stringify((await labels()).filter((x) => x !== label)));
}
export const secretOf = (label: string) => getCredential(SVC, label);
