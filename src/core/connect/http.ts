// HTTP for the connect flow. Goes through the Rust `oauth_http` command so no
// webview Origin header is sent (Microsoft rejects token redemption from a native
// client that carries one: AADSTS9002326). Falls back to the http plugin only if
// the command is not registered in this build. Bodies are never logged.
import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import type { HttpRes } from "./tokens.ts";
import type { Req } from "./requests.ts";

interface Out { status: number; body: string }
const notRegistered = (e: unknown) => /oauth_http.*not found|not found.*oauth_http|unknown command/i.test(String(e));

function wrap(o: Out): HttpRes {
  return { ok: o.status >= 200 && o.status < 300, status: o.status, json: async () => JSON.parse(o.body || "null") };
}

async function request(method: "GET" | "POST", url: string, headers: Record<string, string>, body?: string): Promise<HttpRes> {
  try {
    return wrap(await invoke<Out>("oauth_http", { method, url, headers, body: body ?? null }));
  } catch (e) {
    if (!notRegistered(e)) throw e instanceof Error ? e : new Error(String(e));
    return fetch(url, { method, headers, body });
  }
}

export const send = (r: Req): Promise<HttpRes> => request(r.method, r.url, r.headers, r.body);

export async function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const res = await request("GET", url, { Accept: "application/json", ...headers });
  if (!res.ok) throw new Error(`${new URL(url).host} answered HTTP ${res.status}`);
  return res.json();
}

export async function postJson(url: string, payload: unknown): Promise<HttpRes> {
  return request("POST", url, { "Content-Type": "application/json", Accept: "application/json" }, JSON.stringify(payload));
}
