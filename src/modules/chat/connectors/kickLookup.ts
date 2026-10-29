// Pure Kick chatroom-id resolution: tries several public endpoints in order,
// with browser-like headers, or accepts a manually supplied id. Fetch is injected.
import { excerpt } from "../connLog.ts";
import { chatroomId } from "./kickParse.ts";
import type { RoomRef } from "../types.ts";

export interface FetchRes { status: number; ok: boolean; text(): Promise<string> }
export type Fetch = (url: string, init: { headers: Record<string, string> }) => Promise<FetchRes>;

export const KICK_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://kick.com/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

const direct = (j: unknown): number | null => {
  const id = (j as { id?: unknown } | null)?.id;
  return typeof id === "number" ? id : null;
};
const endpoints = (s: string) => [
  { name: "v2", url: `https://kick.com/api/v2/channels/${s}`, pick: chatroomId },
  { name: "v1", url: `https://kick.com/api/v1/channels/${s}`, pick: chatroomId },
  { name: "v2/chatroom", url: `https://kick.com/api/v2/channels/${s}/chatroom`, pick: direct },
];

/** Room target "slug" or "slug@12345" (manually supplied chatroom id). */
export function splitKickTarget(t: string): { slug: string; chatroom?: number } {
  const [slug, id] = t.split("@");
  return /^\d{1,12}$/.test(id ?? "") ? { slug, chatroom: Number(id) } : { slug };
}
export function withKickId(ref: RoomRef, id: string): RoomRef {
  return ref.site === "kick" && /^\d{1,12}$/.test(id.trim()) ? { ...ref, target: `${ref.target}@${id.trim()}` } : ref;
}

export async function resolveChatroom(slug: string, fetch: Fetch, log: (m: string) => void, manual?: number): Promise<number> {
  if (manual !== undefined) {
    log(`using the manually entered chatroom id ${manual} (no lookup)`);
    return manual;
  }
  const failed: string[] = [];
  for (const [i, e] of endpoints(encodeURIComponent(slug)).entries()) {
    try {
      log(`lookup ${e.name}: GET ${e.url}`);
      const res = await fetch(e.url, { headers: KICK_HEADERS });
      const body = await res.text().catch(() => "");
      log(`lookup ${e.name}: HTTP ${res.status}${res.ok ? "" : ` body: ${excerpt(body)}`}`);
      if (res.status === 404 && i === 0) throw new Error(`Kick channel "${slug}" not found`);
      if (!res.ok) {
        failed.push(`${e.name} HTTP ${res.status}`);
        continue;
      }
      let id: number | null = null;
      try {
        id = e.pick(JSON.parse(body));
      } catch { /* not json */ }
      if (id !== null) {
        log(`chatroom id ${id} from ${e.name}`);
        return id;
      }
      failed.push(`${e.name} unexpected body`);
      log(`lookup ${e.name}: unexpected shape: ${excerpt(body)}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes("not found")) throw err;
      const m = err instanceof Error ? err.message : String(err);
      failed.push(`${e.name} ${m}`);
      log(`lookup ${e.name}: request failed: ${excerpt(m)}`);
    }
  }
  throw new Error(`Kick channel lookup failed (${failed.join(", ")}), probably Cloudflare. Use the embed instead, or re-add the room with the chatroom id.`);
}
