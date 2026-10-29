// Client IDs (app_settings, not secret) and client secrets (keychain only).
import { deleteCredential, getCredential, setCredential } from "../credentials";
import { clientIdSettingKey, resolveClientId } from "./clients.ts";
import { clientGroups } from "./providers.ts";
import { SERVICE, dropSetting, getSetting, putSetting } from "./store.ts";

const secretKey = (group: string) => `client_secret:${group}`;

export async function getOverrides(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const g of clientGroups()) out[g.group] = (await getSetting(clientIdSettingKey(g.group))) ?? "";
  return out;
}
export const clientIdFor = async (group: string): Promise<string> =>
  resolveClientId(group, { [group]: (await getSetting(clientIdSettingKey(group))) ?? "" });

export async function setClientId(group: string, id: string): Promise<void> {
  if (id.trim()) await putSetting(clientIdSettingKey(group), id.trim());
  else await dropSetting(clientIdSettingKey(group));
}
export const getClientSecret = (group: string): Promise<string | undefined> =>
  getCredential(SERVICE, secretKey(group)).then((v) => v || undefined).catch(() => undefined);
export async function setClientSecret(group: string, secret: string): Promise<void> {
  if (secret.trim()) await setCredential(SERVICE, secretKey(group), secret.trim());
  else await deleteCredential(SERVICE, secretKey(group)).catch(() => {});
}
