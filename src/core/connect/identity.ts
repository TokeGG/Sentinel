// Who just signed in? Reads our own id_token claims or one cheap API call.
import { getJson } from "./http.ts";
import { jwtClaims, type TokenSet } from "./oauth.ts";
import { mastodonAccount } from "./mastodonLogic.ts";
import type { Provider } from "./providers.ts";

export interface Identity { account: string; label: string }

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const bearer = (t: string, p: Provider) => ({ Authorization: `Bearer ${t}`, ...p.headers });

export async function identify(p: Provider, t: TokenSet, instance?: string): Promise<Identity> {
  const tok = t.accessToken;
  let name = "";
  if (p.id.startsWith("google") || p.id.startsWith("microsoft")) {
    const c = jwtClaims(t.idToken);
    name = (str(c.email) || str(c.preferred_username) || str(c.upn)).toLowerCase();
  } else if (p.id === "twitch") {
    name = str(((await getJson("https://id.twitch.tv/oauth2/validate", { Authorization: `OAuth ${tok}` })) as { login?: unknown }).login);
  } else if (p.id === "github") {
    name = str(((await getJson("https://api.github.com/user", bearer(tok, p))) as { login?: unknown }).login);
  } else if (p.id === "reddit") {
    name = str(((await getJson("https://oauth.reddit.com/api/v1/me", bearer(tok, p))) as { name?: unknown }).name);
  } else if (p.id === "mastodon" && instance) {
    const me = (await getJson(`https://${instance}/api/v1/accounts/verify_credentials`, bearer(tok, p))) as { acct?: unknown };
    name = mastodonAccount(str(me.acct), instance);
  }
  if (!name) throw new Error(`Signed in, but ${p.label} did not say who you are. Try again.`);
  return { account: name, label: name };
}
