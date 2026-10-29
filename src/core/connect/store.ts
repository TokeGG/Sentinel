// Tauri-coupled storage for the connect framework. Secrets (refresh tokens,
// non-expiring access tokens, client secrets) go to the OS keychain only; the
// accounts table and client IDs hold non-secret data. Short-lived access tokens
// of refreshable providers stay in memory (Windows credentials are size-capped).
import { deleteCredential, getCredential, setCredential } from "../credentials";
import { getDb } from "../db";
import type { TokenSet } from "./oauth.ts";
import type { TokenStore } from "./tokens.ts";

export const SERVICE = "hub.accounts";
export const tokenKey = (provider: string, account: string): string => `${provider}:${account}`;

const mem = new Map<string, TokenSet>();
const gone = (service: string, key: string) => deleteCredential(service, key).catch(() => {});

export const keychainTokens: TokenStore = {
  async get(key) {
    const hit = mem.get(key);
    if (hit) return hit;
    const refresh = await getCredential(SERVICE, `${key}:refresh`).catch(() => null);
    if (refresh) return { accessToken: "", refreshToken: refresh, expiresAt: 0, scopes: [] }; // forces a silent refresh
    const access = await getCredential(SERVICE, `${key}:access`).catch(() => null);
    return access ? { accessToken: access, scopes: [] } : null;
  },
  async set(key, t) {
    mem.set(key, t);
    if (t.refreshToken) {
      await setCredential(SERVICE, `${key}:refresh`, t.refreshToken);
      await gone(SERVICE, `${key}:access`);
    } else await setCredential(SERVICE, `${key}:access`, t.accessToken);
  },
  async remove(key) {
    mem.delete(key);
    await gone(SERVICE, `${key}:refresh`);
    await gone(SERVICE, `${key}:access`);
  },
};

export interface AccountRow { provider: string; account: string; label: string; connectedAt: string; lastError: string | null }
interface Raw { provider: string; account: string; label: string; connected_at: string; last_error: string | null }

export async function listRows(provider?: string): Promise<AccountRow[]> {
  const d = await getDb();
  const rows = provider
    ? await d.select<Raw[]>("SELECT * FROM accounts WHERE provider = $1 ORDER BY connected_at DESC, rowid DESC", [provider])
    : await d.select<Raw[]>("SELECT * FROM accounts ORDER BY provider, connected_at DESC");
  return rows.map((r) => ({ provider: r.provider, account: r.account, label: r.label, connectedAt: r.connected_at, lastError: r.last_error }));
}

export async function saveRow(provider: string, account: string, label: string): Promise<void> {
  const d = await getDb();
  await d.execute(
    "INSERT INTO accounts (provider, account, label, connected_at, last_error) VALUES ($1,$2,$3,datetime('now'),NULL) ON CONFLICT(provider, account) DO UPDATE SET label=$3, connected_at=datetime('now'), last_error=NULL",
    [provider, account, label]
  );
}
export async function setLastError(provider: string, account: string, err: string | null): Promise<void> {
  await (await getDb()).execute("UPDATE accounts SET last_error = $3 WHERE provider = $1 AND account = $2", [provider, account, err]);
}
export async function dropRow(provider: string, account: string): Promise<void> {
  await (await getDb()).execute("DELETE FROM accounts WHERE provider = $1 AND account = $2", [provider, account]);
}

export async function getSetting(key: string): Promise<string | null> {
  const r = await (await getDb()).select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [key]);
  return r[0]?.value ?? null;
}
export async function putSetting(key: string, value: string): Promise<void> {
  await (await getDb()).execute("INSERT INTO app_settings (key, value) VALUES ($1,$2) ON CONFLICT(key) DO UPDATE SET value = $2", [key, value]);
}
export async function dropSetting(key: string): Promise<void> {
  await (await getDb()).execute("DELETE FROM app_settings WHERE key = $1", [key]);
}
