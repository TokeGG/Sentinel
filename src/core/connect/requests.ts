// Pure builders for token-endpoint requests (code exchange, refresh, device poll).
import { form } from "./oauth.ts";

export interface TokenEndpoint {
  url: string;
  clientId: string;
  clientSecret?: string;
  /** HTTP Basic with the client id and an empty secret (Reddit installed apps). */
  basicAuth?: boolean;
  headers?: Record<string, string>;
}
export interface Req { url: string; method: "POST"; headers: Record<string, string>; body: string }

export function tokenRequest(e: TokenEndpoint, params: Record<string, string>): Req {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...e.headers };
  const body: Record<string, string> = { ...params };
  if (e.basicAuth) headers.Authorization = `Basic ${btoa(`${e.clientId}:`)}`;
  else body.client_id = e.clientId;
  if (e.clientSecret) body.client_secret = e.clientSecret;
  return { url: e.url, method: "POST", headers, body: form(body) };
}

export const codeExchange = (e: TokenEndpoint, code: string, redirectUri: string, verifier?: string): Req =>
  tokenRequest(e, { grant_type: "authorization_code", code, redirect_uri: redirectUri, ...(verifier ? { code_verifier: verifier } : {}) });

export const refreshGrant = (e: TokenEndpoint, refreshToken: string): Req =>
  tokenRequest(e, { grant_type: "refresh_token", refresh_token: refreshToken });

/** `scopes` is Twitch's name for the requested scopes on the poll; other providers ignore it. */
export const deviceGrant = (e: TokenEndpoint, deviceCode: string, scopes: string[] = []): Req =>
  tokenRequest(e, { grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: deviceCode, ...(scopes.length ? { scopes: scopes.join(" ") } : {}) });

export const deviceStart = (url: string, clientId: string, scopes: string[], headers?: Record<string, string>): Req => ({
  url, method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...headers },
  body: form({ client_id: clientId, scope: scopes.join(" ") }),
});
