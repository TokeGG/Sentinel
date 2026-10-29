// "Sync Congress": GovTrack API v2 (https://www.govtrack.us/api/v2/, free, no key). Runs only on the
// button (or the opt-in schedule). One failing part does not block the others.
import { fetch } from "@tauri-apps/plugin-http";
import { logActivity } from "../../core/db";
import { parseBills, parseMembers, parseVotes, type Bill } from "./parse";
import { flagBillUpdates, followedBillIds, saveBills, saveMembers, saveVotes } from "./store";

const API = "https://www.govtrack.us/api/v2";

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${API}/${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`GovTrack ${res.status} for ${path.split("?")[0]}`);
  return res.json();
}

export async function syncCongress() {
  const errors: string[] = [];
  const part = async <T,>(name: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };
  const counts = { bills: 0, votes: 0, members: 0 };
  await part("bills", async () => {
    const recent = parseBills(await getJson("bill?order_by=-current_status_date&limit=60"));
    // Followed bills are fetched by id so they keep updating after they leave the recent list.
    const have = new Set(recent.map((b) => b.id));
    const extra: Bill[] = [];
    for (const id of (await followedBillIds()).filter((i) => !have.has(i))) {
      const one = await part(`bill ${id}`, async () => parseBills({ objects: [await getJson(`bill/${encodeURIComponent(id)}`)] }));
      if (one) extra.push(...one);
    }
    await saveBills([...recent, ...extra]);
    counts.bills = recent.length + extra.length;
  });
  await part("votes", async () => {
    const v = parseVotes(await getJson("vote?order_by=-created&limit=50"));
    await saveVotes(v);
    counts.votes = v.length;
  });
  await part("members", async () => {
    const m = parseMembers(await getJson("role?current=true&limit=700"));
    await saveMembers(m);
    counts.members = m.length;
  });
  const updated = await flagBillUpdates();
  const total = counts.bills + counts.votes + counts.members;
  await logActivity("congress", "sync_congress", "GovTrack API (bills, votes, members)", `${total} item(s)${updated ? `, ${updated} followed bill update(s)` : ""}${errors.length ? `, ${errors.length} error(s)` : ""}`);
  if (total === 0 && errors.length) throw new Error(errors.join("; "));
  return { ok: true, ...counts, updated, errors };
}
