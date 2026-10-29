// Tauri side of subsImport.ts: pages the API with a fresh token per call, adds new channels.
import { fetch } from "@tauri-apps/plugin-http";
import { getAccessToken } from "../../core/connect";
import { getDb } from "../../core/db";
import { newIds, parseSubsPage, subsUrl } from "./subsImport";
import { addChannel } from "./store";

export async function importSubscriptions(): Promise<{ count: number }> {
  const ids: string[] = [];
  let next: string | null = null;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(subsUrl(next), { headers: { Authorization: `Bearer ${await getAccessToken("google-youtube")}` } });
    if (!res.ok) throw new Error(`YouTube subscriptions: ${res.status}`);
    const page = parseSubsPage(await res.json());
    ids.push(...page.ids);
    if (!(next = page.next)) break;
  }
  const rows = await (await getDb()).select<{ channel_id: string }[]>("SELECT channel_id FROM youtube_channels");
  const todo = newIds(ids, new Set(rows.map((r) => r.channel_id)));
  for (const id of todo) await addChannel({ url: id }).catch(() => {});
  return { count: todo.length };
}
