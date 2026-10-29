// Account-connect API: connect(), disconnect(), getAccessToken(). Tokens live in
// the OS keychain (store.ts); refresh is silent; nothing here logs a token.
import { missingScopes } from "./oauth.ts";
import { clientIdFor, getClientSecret } from "./clientStore.ts";
import { deviceSignIn, loopbackSignIn, type DevicePrompt } from "./flow.ts";
import { send } from "./http.ts";
import { identify } from "./identity.ts";
import { hostOfAccount, normalizeInstance } from "./mastodonLogic.ts";
import { mastodonClientId, mastodonSecret, registerApp } from "./mastodonReg.ts";
import { endpoint, getProvider, redirectUri, type Provider } from "./providers.ts";
import type { TokenEndpoint } from "./requests.ts";
import { dropRow, keychainTokens, listRows, saveRow, setLastError, tokenKey, type AccountRow } from "./store.ts";
import { ReauthError, freshAccessToken } from "./tokens.ts";

export { ReauthError };
export type { AccountRow, DevicePrompt };

/** Thrown by connect() when the provider's client ID is not configured: the UI shows the "Add a client ID" step. */
export class MissingClientId extends Error {
  constructor(public group: string, public providerLabel: string) {
    super(`${providerLabel} needs a client ID first. See docs/ACCOUNTS.md.`);
    this.name = "MissingClientId";
  }
}

const listeners = new Set<() => void>();
/** Subscribe to connect/disconnect/error changes (Settings > Accounts, Email form). */
export const onAccountsChanged = (fn: () => void): (() => void) => (listeners.add(fn), () => void listeners.delete(fn));
const changed = () => listeners.forEach((f) => f());
const prompts = new Map<string, DevicePrompt>();
export const devicePrompt = (providerId: string): DevicePrompt | undefined => prompts.get(providerId);
const cancelled = new Set<string>();
export const cancelConnect = (providerId: string): void => void cancelled.add(providerId);

export const listAccounts = (providerId?: string): Promise<AccountRow[]> => listRows(providerId);

async function endpointFor(p: Provider, instance?: string): Promise<{ ep: TokenEndpoint; authUrl?: string }> {
  const tokenUrl = endpoint(p.tokenUrl, instance);
  const authUrl = p.authUrl ? endpoint(p.authUrl, instance) : undefined;
  const base = { url: tokenUrl, basicAuth: p.basicAuth, headers: p.headers };
  if (p.dynamicInstance) {
    const host = instance!;
    return { ep: { ...base, clientId: await mastodonClientId(host), clientSecret: await mastodonSecret(host) }, authUrl };
  }
  const clientId = await clientIdFor(p.clientGroup!);
  if (!clientId) throw new MissingClientId(p.clientGroup!, p.label);
  return { ep: { ...base, clientId, clientSecret: p.clientSecret ? await getClientSecret(p.clientGroup!) : undefined }, authUrl };
}

export async function connect(providerId: string, opts: { instance?: string; onPrompt?: (d: DevicePrompt | null) => void } = {}): Promise<AccountRow> {
  const p = getProvider(providerId);
  let instance: string | undefined;
  if (p.dynamicInstance) {
    instance = normalizeInstance(opts.instance ?? "") ?? undefined;
    if (!instance) throw new Error("Enter your Mastodon instance first, e.g. mastodon.social");
    await registerApp(instance, redirectUri(p), p.scopes);
  }
  const { ep, authUrl } = await endpointFor(p, instance);
  cancelled.delete(p.id);
  const tokens = p.flow === "device-code"
    ? await deviceSignIn(p, ep, (d) => { d ? prompts.set(p.id, d) : prompts.delete(p.id); opts.onPrompt?.(d); changed(); }, () => cancelled.has(p.id))
    : await loopbackSignIn(p, ep, authUrl!);
  const gap = p.strictScopes && tokens.scopes.length ? missingScopes(tokens.scopes, p.scopes) : [];
  if (gap.length) throw new Error(`${p.label} did not grant: ${gap.join(", ")}. Press Connect again and accept every permission.`);
  const who = await identify(p, tokens, instance);
  await keychainTokens.set(tokenKey(p.id, who.account), tokens);
  await saveRow(p.id, who.account, who.label);
  changed();
  return (await listRows(p.id)).find((r) => r.account === who.account)!;
}

export async function disconnect(providerId: string, account: string): Promise<void> {
  await keychainTokens.remove(tokenKey(providerId, account));
  await dropRow(providerId, account);
  changed();
}

/** The most recently connected account of a provider, or null. */
export const primaryAccount = async (providerId: string): Promise<string | null> => (await listRows(providerId))[0]?.account ?? null;

const failing = new Set<string>();
/** A valid access token for (provider, account); refreshes silently. `account` defaults to the primary one. */
export async function getAccessToken(providerId: string, account?: string): Promise<string> {
  const p = getProvider(providerId);
  const acct = account ?? (await primaryAccount(providerId));
  if (!acct) throw new ReauthError(`${p.label} is not connected. Press Connect in Settings > Accounts.`);
  const key = tokenKey(p.id, acct);
  try {
    const { ep } = await endpointFor(p, p.dynamicInstance ? hostOfAccount(acct) : undefined);
    const t = await freshAccessToken({ now: Date.now, send, store: keychainTokens }, key, ep);
    if (failing.delete(key)) { await setLastError(p.id, acct, null); changed(); }
    return t;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    failing.add(key);
    await setLastError(p.id, acct, msg).catch(() => {});
    changed();
    throw e;
  }
}
