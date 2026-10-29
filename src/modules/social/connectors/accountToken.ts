// Bridges Mastodon/Reddit to core/connect (Settings > Accounts). A connected
// account wins; older keychain sign-ins (`<platform>_access_token`) still work.
import { getCredential } from "../../../core/credentials";
import { connect, getAccessToken, primaryAccount } from "../../../core/connect";
import { clientIdFor, setClientId } from "../../../core/connect/clientStore";
import { hostOfAccount } from "../../../core/connect/mastodonLogic";
import { MODULE_ID, cred } from "./common";

export interface Auth { token: string; base: string }

export async function mastoAuth(): Promise<Auth> {
  const acct = await primaryAccount("mastodon").catch(() => null);
  if (acct) return { token: await getAccessToken("mastodon", acct), base: `https://${hostOfAccount(acct)}` };
  return { token: await cred("mastodon", "access_token"), base: (await cred("mastodon", "instance_url")).replace(/\/+$/, "") };
}

export async function redditToken(): Promise<string> {
  const acct = await primaryAccount("reddit").catch(() => null);
  return acct ? getAccessToken("reddit", acct) : cred("reddit", "access_token");
}

export async function connectMastodon(): Promise<void> {
  const instance = await cred("mastodon", "instance_url").catch(() => {
    throw new Error('enter your instance URL above first, then click "Connect"');
  });
  await connect("mastodon", { instance });
}

/** Reuses a Client ID pasted in the Social panel (older builds) if Settings has none. */
export async function connectReddit(): Promise<void> {
  const legacy = await getCredential(MODULE_ID, "reddit_client_id").catch(() => null);
  if (legacy && !(await clientIdFor("reddit"))) await setClientId("reddit", legacy);
  await connect("reddit");
}

export async function isConnected(platform: "mastodon" | "reddit"): Promise<boolean> {
  if (await primaryAccount(platform).catch(() => null)) return true;
  return Boolean(await getCredential(MODULE_ID, `${platform}_access_token`).catch(() => null));
}
