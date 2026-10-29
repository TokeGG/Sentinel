import { fetch } from "@tauri-apps/plugin-http";
import { connectMastodon, isConnected, mastoAuth } from "./accountToken";
import { mastoPatch, mastoReplyBody, mastoUrl, type MastoAction } from "./actions";
import { parseMastodon } from "./parse";
import type { PostRef, SocialConnector } from "./types";

// One-click OAuth via core/connect (dynamic client registration, PKCE, Settings > Accounts).

const REAUTH = 'refused — click "Connect Mastodon" again to grant likes, boosts and replies';

async function act(p: PostRef, a: MastoAction) {
  const { base, token } = await mastoAuth();
  const res = await fetch(mastoUrl(base, p, a), { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 403) throw new Error(`Mastodon ${REAUTH}`);
  if (!res.ok) throw new Error(`Mastodon ${a} failed: ${res.status}`);
  return mastoPatch(a);
}

export const mastodon: SocialConnector = {
  id: "mastodon",
  label: "Mastodon",
  authType: "oauth",
  connectedKey: "access_token",
  credentials: [{ key: "instance_url", label: "Instance URL (e.g. https://mastodon.social)" }],
  connect: connectMastodon,
  isConnected: () => isConnected("mastodon"),
  async fetchFeed() {
    const { base, token } = await mastoAuth();
    const res = await fetch(`${base}/api/v1/timelines/home?limit=40`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Mastodon fetch failed: ${res.status}`);
    return parseMastodon(await res.json());
  },
  async post(text) {
    const { base, token } = await mastoAuth();
    const res = await fetch(`${base}/api/v1/statuses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: text }),
    });
    if (res.status === 403) throw new Error('Mastodon post refused — click "Connect Mastodon" again to grant posting');
    if (!res.ok) throw new Error(`Mastodon post failed: ${res.status}`);
  },
  like: (p) => act(p, "favourite"),
  unlike: (p) => act(p, "unfavourite"),
  share: (p) => act(p, "reblog"),
  unshare: (p) => act(p, "unreblog"),
  async reply(p, text) {
    const { base, token } = await mastoAuth();
    const res = await fetch(`${base}/api/v1/statuses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(mastoReplyBody(p, text)),
    });
    if (res.status === 403) throw new Error(`Mastodon ${REAUTH}`);
    if (!res.ok) throw new Error(`Mastodon reply failed: ${res.status}`);
  },
};
