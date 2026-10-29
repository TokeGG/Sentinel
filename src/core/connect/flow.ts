// The two interactive sign-in flows. Both end in a TokenSet; nothing is stored here.
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { send } from "./http.ts";
import { buildAuthUrl, parseTokenResponse, type TokenSet } from "./oauth.ts";
import { challengeS256, newState, newVerifier } from "./pkce.ts";
import { redirectUri, type Provider } from "./providers.ts";
import { codeExchange, deviceGrant, deviceStart, type TokenEndpoint } from "./requests.ts";
import { classifyPoll, nextInterval, parseDeviceStart, prettyCode } from "./deviceLogic.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Endpoints { authUrl?: string; tokenUrl: string }
export interface DevicePrompt { userCode: string; verificationUri: string; expiresAt: number }

/** Browser sign-in: PKCE + state, redirect caught by the generic Rust listener (127.0.0.1, state-checked). */
export async function loopbackSignIn(p: Provider, ep: TokenEndpoint, authUrl: string): Promise<TokenSet> {
  const state = newState();
  const verifier = newVerifier();
  const redirect = redirectUri(p);
  const usePkce = p.pkce !== false;
  const url = buildAuthUrl({
    authUrl, clientId: ep.clientId, redirectUri: redirect, scopes: p.scopes, state, extra: p.authExtra,
    challenge: usePkce ? await challengeS256(verifier) : "",
  });
  const waiting = invoke<string>("oauth_listen_once", { port: p.redirect!.port, timeoutSecs: 180, path: "/", state });
  waiting.catch(() => {}); // surfaced by the await below; avoids an unhandled-rejection if openUrl throws first
  await sleep(150); // let the listener bind before the browser can redirect
  await openUrl(url);
  const code = await waiting;
  const res = await send(codeExchange(ep, code, redirect, usePkce ? verifier : undefined));
  return parseTokenResponse(await res.json().catch(() => ({})), Date.now());
}

/** Device-code sign-in: shows the user code via onPrompt, opens the verification page, polls with backoff. */
export async function deviceSignIn(p: Provider, ep: TokenEndpoint, onPrompt: (d: DevicePrompt | null) => void, cancelled: () => boolean): Promise<TokenSet> {
  const start = await send(deviceStart(p.deviceUrl!, ep.clientId, p.scopes, p.headers));
  const d = parseDeviceStart(await start.json().catch(() => ({})), Date.now());
  onPrompt({ userCode: prettyCode(d.userCode), verificationUri: d.verificationUri, expiresAt: d.expiresAt });
  await openUrl(d.verificationUri).catch(() => {}); // the panel also shows the link
  let interval = d.interval;
  try {
    while (Date.now() < d.expiresAt) {
      await sleep(interval * 1000);
      if (cancelled()) throw new Error("Sign-in cancelled.");
      const res = await send(deviceGrant(ep, d.deviceCode, p.scopes));
      const body = await res.json().catch(() => ({}));
      const r = classifyPoll(body);
      if (r.kind === "done") return parseTokenResponse(body, Date.now());
      if (r.kind === "denied") throw new Error("Sign-in was refused on the website.");
      if (r.kind === "expired") break;
      if (r.kind === "error") throw new Error(`Sign-in failed: ${r.detail}`);
      interval = nextInterval(interval, r.kind);
    }
    throw new Error("The sign-in code expired. Press Connect to get a new one.");
  } finally {
    onPrompt(null);
  }
}
