import { getCredential } from "../../core/credentials";
import { getAccessToken, primaryAccount } from "../../core/connect";

export const MODULE_ID = "hub.github";

export async function authHeaders(): Promise<Record<string, string>> {
  // Device-flow sign-in (Settings > Accounts) first; the pasted PAT is the fallback.
  const signedIn = (await primaryAccount("github").catch(() => null)) ? await getAccessToken("github").catch(() => "") : "";
  const token = signedIn || (await getCredential(MODULE_ID, "pat"));
  return token ? { Authorization: `Bearer ${token}` } : {};
}
