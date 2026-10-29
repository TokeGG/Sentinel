import { getCredential } from "../../../core/credentials";

export const MODULE_ID = "hub.social";
export const UA = "sentinel-hub/0.1 (desktop app)";

export async function cred(platform: string, key: string): Promise<string> {
  const v = await getCredential(MODULE_ID, `${platform}_${key}`);
  if (!v) throw new Error(`not connected yet — click "Connect" for this platform first`);
  return v;
}
