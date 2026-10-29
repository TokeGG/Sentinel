// Pure: turns raw connect failures into a precise message + next step, and the
// per-provider "Test" check (client ID format + endpoint config). No I/O.
import { endpoint, redirectUri, type Provider } from "./providers.ts";

/** Client ID shapes as issued today (lenient where providers vary). */
const ID_FORMAT: Record<string, { re: RegExp; example: string }> = {
  google: { re: /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/, example: "1234567890-abc123.apps.googleusercontent.com" },
  microsoft: { re: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, example: "a GUID like 0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b" },
  twitch: { re: /^[a-z0-9]{30}$/, example: "30 lowercase letters/digits" },
  github: { re: /^(Iv[0-9]\.[0-9a-f]{16}|Ov[0-9A-Za-z]{18}|[0-9a-f]{20})$/, example: "Ov23li... (20 chars) or Iv1.xxxxxxxxxxxxxxxx" },
  reddit: { re: /^[A-Za-z0-9_-]{14,30}$/, example: "the 14-30 character string under the app name" },
};

export interface Check { ok: boolean; line: string }

export function checkProvider(p: Provider, clientId: string): Check[] {
  const out: Check[] = [];
  const https = (u?: string) => Boolean(u) && endpoint(u!, "example.social").startsWith("https://");
  if (p.flow === "loopback-pkce") {
    out.push({ ok: https(p.authUrl), line: `Authorization endpoint ${p.authUrl ?? "(missing)"}` });
    out.push(p.redirect ? { ok: true, line: `Redirect ${redirectUri(p)} (must be registered exactly like this)` } : { ok: false, line: "No loopback redirect configured" });
  } else out.push({ ok: https(p.deviceUrl), line: `Device endpoint ${p.deviceUrl ?? "(missing)"}` });
  out.push({ ok: https(p.tokenUrl), line: `Token endpoint ${p.tokenUrl}` });
  if (!p.clientGroup) {
    out.push({ ok: true, line: "Client ID: none needed (registered automatically with your instance)" });
    return out;
  }
  const id = clientId.trim();
  const f = ID_FORMAT[p.clientGroup];
  if (!id) out.push({ ok: false, line: `Client ID: not set. Add it under Client IDs below (see docs/ACCOUNTS.md).` });
  else if (f && !f.re.test(id)) out.push({ ok: false, line: `Client ID "${id.slice(0, 60)}" does not look like a ${p.clientGroup} client ID (expected ${f.example}).` });
  else out.push({ ok: true, line: "Client ID format looks right" });
  return out;
}

const has = (m: string, ...k: string[]) => k.some((x) => m.toLowerCase().includes(x.toLowerCase()));

/** Precise message + next step for a failed Connect. `raw` may come from Rust, the provider or the browser opener. */
export function explainError(p: Provider, raw: string): string {
  const port = p.redirect?.port;
  if (has(raw, "port_in_use")) return `Port ${port} is busy (an earlier sign-in is still waiting, or another program uses it). Press Cancel on other sign-ins or close that program, then Connect again.`;
  if (has(raw, "port_blocked")) return `Sentinel could not listen on 127.0.0.1:${port}; a firewall or security tool may block it. Allow Sentinel on private networks, then Connect again.`;
  if (has(raw, "cancelled")) return "Sign-in cancelled.";
  if (has(raw, "timeout:")) return `No sign-in arrived within 3 minutes. If the browser showed an error, check the redirect is registered as ${p.redirect ? redirectUri(p) : "required"}; then Connect again.`;
  if (has(raw, "opener", "not allowed", "open_url", "openUrl")) return `Could not open your browser (${raw.slice(0, 160)}). Use the sign-in link shown below.`;
  if (has(raw, "AADSTS9002326")) return "Microsoft rejected the token request as a browser request. Update Sentinel (token requests must go through the app) and Connect again.";
  if (has(raw, "AADSTS700016", "invalid_client", "unauthorized_client", "client_id")) return p.clientGroup
    ? `${p.label} does not recognise the client ID (${raw.slice(0, 120)}). Check it under Client IDs (use Test) and that the app registration is a public/desktop client.`
    : `${p.label} forgot this app's registration; it was reset. Press Connect again.`;
  if (has(raw, "redirect_uri", "redirect uri", "AADSTS50011")) return `${p.label} says the redirect does not match. Register exactly ${p.redirect ? redirectUri(p) : "the redirect from docs/ACCOUNTS.md"} in your app registration.`;
  if (has(raw, "device_flow_disabled")) return "GitHub: tick 'Enable Device Flow' in your OAuth app settings, then Connect again.";
  if (has(raw, "access_denied", "refused")) return "Sign-in was refused on the website. Press Connect and accept the permissions.";
  if (has(raw, "could not reach", "error sending request", "dns", "offline")) return `Could not reach ${p.label} (${raw.slice(0, 120)}). Check your internet connection or firewall.`;
  return `${p.label} sign-in failed: ${raw.slice(0, 240)}`;
}
