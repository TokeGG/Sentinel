// "Sync Congress": GovTrack API v2 (https://www.govtrack.us/api/v2/, free, no key). Runs only on the
// button (or the opt-in schedule). One failing part does not block the others.
import { fetch } from "@tauri-apps/plugin-http";
import { logActivity } from "../../core/db";
import { parseBills, parseMembers, parseVotes, type Bill, type Member } from "./parse";
import { getSeat, saveRepVotes, snapFollowed } from "./repStore";
import { myReps, parseVoterVotes } from "./reps";
import { flagBillUpdates, followedBillIds, saveBills, saveMembers, saveVotes } from "./store";
import { jsonOrError, netError, requireObjects } from "./apiResult";
import { LEGISLATORS_URL, parseLegislators } from "./legislators";

const API = "https://www.govtrack.us/api/v2";
const HEADERS = { Accept: "application/json", "User-Agent": "Sentinel-desktop/1.0 (local app; GovTrack API v2)" };

async function getUrl(url: string): Promise<unknown> {
  let res: Response;
  try { res = await fetch(url, { headers: HEADERS }); } catch (e) { throw netError(url, e); }
  return jsonOrError(url, res.status, res.headers.get("content-type") ?? "", await res.text());
}
const getJson = async (path: string) => getUrl(`${API}/${path}`);
const getList = async (path: string) => requireObjects(`${API}/${path}`, await getJson(path));

/** Current members: GovTrack roles in pages of 300 (no oversized limit), else the congress-legislators JSON. */
async function fetchMembers(errors: string[]): Promise<Member[]> {
  try {
    const out: Member[] = [];
    for (let offset = 0; offset < 1200; offset += 300) {
      const page = parseMembers(await getList(`role?current=true&limit=300&offset=${offset}`));
      out.push(...page);
      if (page.length < 300) break;
    }
    if (out.length) return out;
    throw new Error("GovTrack returned no current members");
  } catch (e) {
    errors.push(`members (GovTrack, used fallback list): ${e instanceof Error ? e.message : String(e)}`);
    return parseLegislators(await getUrl(LEGISLATORS_URL));
  }
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
  let members: Member[] = [];
  await part("bills", async () => {
    const recent = parseBills(await getList("bill?order_by=-current_status_date&limit=60"));
    // Followed bills are fetched by id so they keep updating after they leave the recent list.
    const have = new Set(recent.map((b) => b.id));
    const extra: Bill[] = [];
    for (const id of (await followedBillIds()).filter((i) => !have.has(i))) {
      const one = await part(`bill ${id}`, async () => parseBills({ objects: [await getJson(`bill/${encodeURIComponent(id)}`)] }));
      if (one) extra.push(...one);
    }
    await saveBills([...recent, ...extra]);
    await snapFollowed([...recent, ...extra], await followedBillIds());
    counts.bills = recent.length + extra.length;
  });
  await part("votes", async () => {
    const v = parseVotes(await getList("vote?order_by=-created&limit=50"));
    await saveVotes(v);
    counts.votes = v.length;
  });
  await part("members", async () => {
    const m = await fetchMembers(errors);
    await saveMembers(m);
    counts.members = m.length;
    members = m;
  });
  // My representatives' recent votes: only when a seat is set (Congress > My reps).
  const seat = await getSeat();
  if (seat) for (const r of myReps(members, seat))
    await part(`votes of ${r.name}`, async () => saveRepVotes(r.id, parseVoterVotes(await getList(`vote_voter?person=${encodeURIComponent(r.id)}&order_by=-created&limit=20`))));
  const updated = await flagBillUpdates();
  const total = counts.bills + counts.votes + counts.members;
  await logActivity("congress", "sync_congress", "GovTrack API (bills, votes, members)", `${total} item(s)${updated ? `, ${updated} followed bill update(s)` : ""}${errors.length ? `, ${errors.length} error(s)` : ""}`);
  if (total === 0 && errors.length) throw new Error(errors.join("; "));
  return { ok: true, ...counts, updated, errors };
}
