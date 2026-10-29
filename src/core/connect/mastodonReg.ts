// Mastodon dynamic client registration: POST /api/v1/apps per instance. The
// client_id lives in app_settings; the client_secret in the keychain.
import { deleteCredential, getCredential, setCredential } from "../credentials";
import { registrationSig } from "./mastodonLogic.ts";
import { SERVICE, getSetting, putSetting } from "./store.ts";
import { fetch } from "@tauri-apps/plugin-http";

const idKey = (host: string) => `mastodon_client:${host}`;
const secretKey = (host: string) => `client_secret:mastodon:${host}`;

export async function registerApp(host: string, redirect: string, scopes: string[]): Promise<{ clientId: string; clientSecret?: string }> {
  const sig = registrationSig(redirect, scopes);
  const saved = await getSetting(idKey(host));
  if (saved) {
    const j = JSON.parse(saved) as { id: string; sig: string };
    if (j.sig === sig) return { clientId: j.id, clientSecret: (await getCredential(SERVICE, secretKey(host)).catch(() => null)) || undefined };
  }
  const res = await fetch(`https://${host}/api/v1/apps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "Sentinel Hub", redirect_uris: redirect, scopes: scopes.join(" ") }),
  });
  if (!res.ok) throw new Error(`${host} refused the app registration (HTTP ${res.status}). Is the instance name right?`);
  const app = (await res.json()) as { client_id?: string; client_secret?: string };
  if (!app.client_id) throw new Error(`${host} sent an unexpected registration reply`);
  await putSetting(idKey(host), JSON.stringify({ id: app.client_id, sig }));
  if (app.client_secret) await setCredential(SERVICE, secretKey(host), app.client_secret);
  else await deleteCredential(SERVICE, secretKey(host)).catch(() => {});
  return { clientId: app.client_id, clientSecret: app.client_secret };
}

export const mastodonSecret = (host: string): Promise<string | undefined> =>
  getCredential(SERVICE, secretKey(host)).then((v) => v || undefined).catch(() => undefined);
export const mastodonClientId = async (host: string): Promise<string> => {
  const s = await getSetting(idKey(host));
  if (!s) throw new Error(`${host} is not registered yet. Press Connect.`);
  return (JSON.parse(s) as { id: string }).id;
};
