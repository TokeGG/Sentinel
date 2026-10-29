import { fetch } from "@tauri-apps/plugin-http";
import type { HttpRes } from "./tokens.ts";
import type { Req } from "./requests.ts";

/** Sends a built request through the Tauri HTTP plugin (no CORS). Bodies are never logged. */
export const send = async (r: Req): Promise<HttpRes> => fetch(r.url, { method: r.method, headers: r.headers, body: r.body });

export async function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  if (!res.ok) throw new Error(`${new URL(url).host} answered HTTP ${res.status}`);
  return res.json();
}
