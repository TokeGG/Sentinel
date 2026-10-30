// App lock state for the main window. The PIN hash lives only in the OS keychain (`hub.lock` / `pin`).
// Windows Hello: no Tauri biometric plugin is a dependency, so PIN only (noted in Settings > Privacy).
import { deleteCredential, getCredential, setCredential } from "../../core/credentials";
import { hashPin, verifyPin } from "./pin";

const SERVICE = "hub.lock";
const KEY = "pin";
type Waiter = (ok: boolean) => void;
let locked = false;
let reason = "";
let waiters: Waiter[] = [];
const subs = new Set<() => void>();
const ping = () => subs.forEach((f) => f());

export const lockState = () => ({ locked, reason });
export function subscribeLock(f: () => void): () => void {
  subs.add(f);
  return () => void subs.delete(f);
}

export const hasPin = async () => !!(await getCredential(SERVICE, KEY).catch(() => null));
export async function setPin(pin: string): Promise<void> {
  await setCredential(SERVICE, KEY, await hashPin(pin));
}
export async function checkPin(pin: string): Promise<boolean> {
  return verifyPin(pin, await getCredential(SERVICE, KEY));
}
/** Removing the PIN requires the current one. */
export async function removePin(current: string): Promise<boolean> {
  if (!(await checkPin(current))) return false;
  await deleteCredential(SERVICE, KEY);
  return true;
}

/** Shows the lock screen; resolves true once the right PIN is typed (or at once when no PIN is set). */
export async function requestUnlock(why: string): Promise<boolean> {
  if (!(await hasPin())) return true;
  locked = true;
  reason = why;
  ping();
  return new Promise<boolean>((res) => waiters.push(res));
}

export function finishUnlock(ok: boolean) {
  locked = false;
  const w = waiters;
  waiters = [];
  ping();
  w.forEach((f) => f(ok));
}
