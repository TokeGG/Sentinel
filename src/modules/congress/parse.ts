// Pure GovTrack API v2 parsers (bills, votes, current roles). Every field is read
// defensively: the API shape is not pinned, so a missing/odd field becomes null/"",
// and an unusable object is skipped rather than failing the sync.
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null);
const url = (v: unknown): string | null => (/^https?:\/\//i.test(str(v)) ? str(v) : null);
const list = (j: unknown): Obj[] => {
  const o = obj(j);
  return (Array.isArray(o?.objects) ? o!.objects : []).map(obj).filter((x): x is Obj => x !== null);
};

export interface Bill {
  id: string; congress: number | null; number: string; title: string; status: string; statusLabel: string;
  statusDate: string | null; introduced: string | null; sponsor: string | null; link: string | null;
  history: { date: string; text: string }[];
}
export interface Vote {
  id: string; chamber: "house" | "senate" | ""; question: string; result: string; votedAt: string | null;
  yes: number | null; no: number | null; other: number | null; bill: string | null; link: string | null;
}
export interface Member {
  id: string; name: string; party: string; state: string; chamber: "house" | "senate" | "";
  district: number | null; title: string | null; link: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}/;
/** `major_actions` entries are loosely typed ([date, ..., text] arrays or objects). */
function actions(v: unknown): Bill["history"] {
  if (!Array.isArray(v)) return [];
  const out: Bill["history"] = [];
  for (const a of v) {
    const o = obj(a);
    const parts = Array.isArray(a) ? a.map(str).filter(Boolean) : [];
    const date = o ? str(o.datetime ?? o.date) : (parts.find((p) => DATE.test(p)) ?? "");
    const text = o ? str(o.text ?? o.label ?? o.description) : (parts.filter((p) => p !== date && !/^[\d.]+$/.test(p)).pop() ?? "");
    if (DATE.test(date) && text) out.push({ date: date.slice(0, 10), text });
  }
  return out.slice(-8);
}

export function parseBills(json: unknown): Bill[] {
  return list(json).flatMap((o) => {
    const id = str(o.id);
    const title = str(o.title_without_number) || str(o.title).replace(/^[^:]{1,20}:\s*/, "");
    if (!id || !title) return [];
    const sp = obj(o.sponsor) ?? obj(obj(o.sponsor_role)?.person);
    return [{
      id, congress: int(o.congress), number: str(o.display_number) || id, title,
      status: str(o.current_status), statusLabel: str(o.current_status_label) || str(o.current_status),
      statusDate: str(o.current_status_date).slice(0, 10) || null, introduced: str(o.introduced_date).slice(0, 10) || null,
      sponsor: sp ? str(sp.name) || null : null, link: url(o.link), history: actions(o.major_actions),
    }];
  });
}

export function parseVotes(json: unknown): Vote[] {
  return list(json).flatMap((o) => {
    const id = str(o.id);
    const question = str(o.question) || str(o.category_label);
    if (!id || !question) return [];
    const ch = str(o.chamber).toLowerCase();
    const rb = obj(o.related_bill);
    return [{
      id, chamber: ch === "house" || ch === "senate" ? ch : "", question, result: str(o.result),
      votedAt: str(o.created).slice(0, 10) || null, yes: int(o.total_plus), no: int(o.total_minus), other: int(o.total_other),
      bill: rb ? str(rb.display_number) || null : null, link: url(o.link),
    }];
  });
}

/** "Sen. Bernard Sanders [I-VT]" -> "Sen. Bernard Sanders". */
export const cleanName = (s: string) => s.replace(/\s*\[[^\]]*\]\s*$/, "").trim();

export function partyCode(p: string): string {
  const s = p.trim().toLowerCase();
  return s.startsWith("dem") ? "D" : s.startsWith("rep") ? "R" : s.startsWith("ind") ? "I" : s ? s[0].toUpperCase() : "";
}

export function parseMembers(json: unknown): Member[] {
  return list(json).flatMap((o) => {
    const p = obj(o.person);
    const id = str(p?.id);
    const name = cleanName(str(p?.name));
    if (!p || !id || !name) return [];
    const rt = str(o.role_type).toLowerCase();
    return [{
      id, name, party: partyCode(str(o.party)), state: str(o.state).toUpperCase(),
      chamber: rt === "senator" ? "senate" : rt === "representative" ? "house" : "", district: int(o.district),
      title: str(o.title_long) || null, link: url(p.link),
    }];
  });
}

export const STAGES = ["Introduced", "Committee", "Passed one chamber", "Passed both", "Law"];

/** Where a GovTrack status sits on STAGES; `failed` for dead/vetoed bills. */
export function statusStage(status: string): { stage: number; failed: boolean } {
  const s = status.toLowerCase();
  if (/^(prov_kill|fail|vetoed)/.test(s)) return { stage: s.startsWith("vetoed") ? 3 : 1, failed: true };
  if (s.startsWith("enacted")) return { stage: 4, failed: false };
  if (s.startsWith("passed")) return { stage: 3, failed: false };
  if (s.startsWith("pass_over") || s.startsWith("pass_back") || s === "conference") return { stage: 2, failed: false };
  if (s === "referred" || s === "reported") return { stage: 1, failed: false };
  return { stage: 0, failed: false };
}

export type Step = { label: string; state: "done" | "current" | "todo" | "failed" };
export function timeline(status: string): Step[] {
  const { stage, failed } = statusStage(status);
  return STAGES.map((label, i) => ({ label, state: i < stage ? "done" : i === stage ? (failed ? "failed" : "current") : "todo" }));
}
