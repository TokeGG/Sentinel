// Provider registry for the generic account-connect framework. Pure data: a new
// provider is one entry here (+ an identity lookup in identity.ts). Every
// provider is a PUBLIC client: PKCE or device code, never an embedded secret.
export type Flow = "loopback-pkce" | "device-code";

export interface Provider {
  id: string;
  label: string;
  flow: Flow;
  /** Authorization endpoint (loopback flow). `{instance}` is filled for dynamic providers. */
  authUrl?: string;
  /** Device authorization endpoint (device-code flow). */
  deviceUrl?: string;
  tokenUrl: string;
  scopes: string[];
  /** Client-ID group shared by providers of one registration (clients.ts); null = registered on the fly. */
  clientGroup: string | null;
  /** Loopback redirect (fixed port: providers want the exact URI registered). "/" is sent without a trailing slash. */
  redirect?: { host: "127.0.0.1" | "localhost"; port: number; path: string };
  /** Extra authorization-URL params (e.g. Google's offline access). */
  authExtra?: Record<string, string>;
  /** false = the provider ignores PKCE (Reddit). Default true. */
  pkce?: boolean;
  /** Token endpoint wants HTTP Basic with the client id and an empty secret (Reddit installed apps). */
  basicAuth?: boolean;
  /** Provider insists on a client secret even for desktop apps (Google). Kept in the keychain, never in app_settings. */
  clientSecret?: boolean;
  /** Extra headers for token/identity requests. */
  headers?: Record<string, string>;
  /** Verify the granted scopes cover the requested ones (providers that echo scopes verbatim). */
  strictScopes?: boolean;
  /** Mastodon-style: the account key is `user@host`; the host is the instance. */
  dynamicInstance?: boolean;
  /** One line for Settings > Accounts: what connecting enables. */
  purpose: string;
}

const loop = (port: number, host: "127.0.0.1" | "localhost" = "127.0.0.1") => ({ host, port, path: "/" });
const UA = { "User-Agent": "sentinel-hub/0.1 (desktop app)" };

export const PROVIDERS: Provider[] = [
  { id: "mastodon", label: "Mastodon", flow: "loopback-pkce", authUrl: "https://{instance}/oauth/authorize", tokenUrl: "https://{instance}/oauth/token",
    scopes: ["read", "write:statuses", "write:favourites"], clientGroup: null, redirect: loop(53683), dynamicInstance: true, strictScopes: true,
    purpose: "Home feed, posting, boosts and likes. No setup: the app registers itself with your instance." },
  { id: "google-mail", label: "Gmail", flow: "loopback-pkce", authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://mail.google.com/", "openid", "email"], clientGroup: "google", redirect: loop(53690), authExtra: { access_type: "offline", prompt: "consent" }, clientSecret: true,
    purpose: "Email panel: IMAP and SMTP over OAuth (no app password)." },
  { id: "google-youtube", label: "YouTube (Google)", flow: "loopback-pkce", authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/youtube.readonly", "openid", "email"], clientGroup: "google", redirect: loop(53690), authExtra: { access_type: "offline", prompt: "consent" }, clientSecret: true,
    purpose: "YouTube panel: import your subscriptions (channel ids only)." },
  { id: "microsoft-mail", label: "Outlook / Microsoft 365", flow: "loopback-pkce", authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["https://outlook.office.com/IMAP.AccessAsUser.All", "https://outlook.office.com/SMTP.Send", "offline_access", "openid", "email"],
    clientGroup: "microsoft", redirect: loop(53691, "localhost"), purpose: "Email panel: IMAP and SMTP over OAuth (no app password)." },
  { id: "twitch", label: "Twitch", flow: "device-code", deviceUrl: "https://id.twitch.tv/oauth2/device", tokenUrl: "https://id.twitch.tv/oauth2/token",
    scopes: ["chat:read", "chat:edit"], clientGroup: "twitch", strictScopes: true, purpose: "Chat panel: send messages in Twitch chat." },
  { id: "github", label: "GitHub", flow: "device-code", deviceUrl: "https://github.com/login/device/code", tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["read:user"], clientGroup: "github", headers: { Accept: "application/json" }, purpose: "GitHub panel: your starred repos; higher API rate limits for skill installs." },
  { id: "reddit", label: "Reddit", flow: "loopback-pkce", authUrl: "https://www.reddit.com/api/v1/authorize", tokenUrl: "https://www.reddit.com/api/v1/access_token",
    scopes: ["read", "identity", "vote", "submit"], clientGroup: "reddit", redirect: loop(53684), authExtra: { duration: "permanent" }, pkce: false, basicAuth: true,
    headers: UA, purpose: "Social panel: your Reddit feed, votes and comments." },
];

export const getProvider = (id: string): Provider => {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown account provider: ${id}`);
  return p;
};

export const redirectUri = (p: Provider): string => {
  if (!p.redirect) throw new Error(`${p.id} has no loopback redirect`);
  const { host, port, path } = p.redirect;
  return `http://${host}:${port}${path === "/" ? "" : path}`;
};

/** Fills `{instance}` in a templated endpoint; plain endpoints pass through. */
export const endpoint = (url: string, instance?: string): string => (instance ? url.replace("{instance}", instance) : url);

/** Client-ID groups, in display order, with the providers each unlocks. */
export function clientGroups(): { group: string; secret: boolean; providers: Provider[] }[] {
  const out: { group: string; secret: boolean; providers: Provider[] }[] = [];
  for (const p of PROVIDERS) {
    if (!p.clientGroup) continue;
    let g = out.find((x) => x.group === p.clientGroup);
    if (!g) out.push((g = { group: p.clientGroup, secret: false, providers: [] }));
    g.providers.push(p);
    g.secret ||= Boolean(p.clientSecret);
  }
  return out;
}
