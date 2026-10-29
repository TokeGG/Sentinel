// Pure: fallback member list from the public unitedstates/congress-legislators dataset (no key, static JSON),
// used when GovTrack's role endpoint fails. Members keep GovTrack ids (id.govtrack) so follows/my reps match.
import type { Member } from "./parse.ts";
import { partyCode } from "./parse.ts";

export const LEGISLATORS_URL = "https://unitedstates.github.io/congress-legislators/legislators-current.json";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

export function parseLegislators(json: unknown): Member[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((x) => {
    const o = obj(x);
    const id = str(obj(o?.id)?.govtrack);
    const n = obj(o?.name);
    const terms = Array.isArray(o?.terms) ? o!.terms : [];
    const t = obj(terms[terms.length - 1]);
    const name = str(n?.official_full) || `${str(n?.first)} ${str(n?.last)}`.trim();
    if (!id || !name || !t) return [];
    const type = str(t.type);
    const chamber = type === "sen" ? "senate" : type === "rep" ? "house" : "";
    const url = str(t.url);
    return [{
      id, name: `${chamber === "senate" ? "Sen." : "Rep."} ${name}`, party: partyCode(str(t.party)), state: str(t.state).toUpperCase(), chamber,
      district: typeof t.district === "number" ? t.district : null, title: chamber === "senate" ? "Senator" : "Representative",
      link: /^https:\/\//.test(url) ? url : `https://www.govtrack.us/congress/members/${id}`,
    } as Member];
  });
}
