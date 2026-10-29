// Pure view logic for the account rows and the connect button.
import type { AccountRow } from "./store.ts";
import type { Provider } from "./providers.ts";

export const DOCS_URL = "https://github.com/TokeGG/Sentinel/blob/main/docs/ACCOUNTS.md";

export const statusText = (rows: AccountRow[]): string =>
  rows.length === 0 ? "Not connected" : `Connected as ${rows.map((r) => r.label || r.account).join(", ")}`;

/** "Connect" first time, "Reconnect" when a refresh failed, "Add another" for multi-account providers. */
export function connectLabel(p: Provider, rows: AccountRow[]): string {
  if (rows.some((r) => r.lastError)) return "Reconnect";
  if (rows.length === 0) return "Connect";
  return p.dynamicInstance || p.id.endsWith("-mail") ? "Add another" : "Reconnect";
}

export const firstError = (rows: AccountRow[]): string | null => rows.find((r) => r.lastError)?.lastError ?? null;

/** What the "Add a client ID" step asks for, per client group. */
export function clientIdPrompt(group: string, wantsSecret: boolean): string {
  const base = `Paste the ${group[0].toUpperCase()}${group.slice(1)} client ID`;
  return wantsSecret ? `${base} and client secret (Google issues one to desktop apps; it is stored in the Windows keychain)` : base;
}

/** Account-form helper for Email: which OAuth buttons exist, and the preset each one fills. */
export const MAIL_OAUTH = [
  { providerId: "google-mail", label: "Sign in with Google", preset: "gmail-oauth" },
  { providerId: "microsoft-mail", label: "Sign in with Microsoft", preset: "outlook-oauth" },
] as const;
