// Conversation threading: References / In-Reply-To first, then normalised subject. Pure.
import type { Msg } from "./types.ts";

export interface ThreadMeta { messageId: string; inReplyTo: string; refs: string }
export interface Thread { key: string; msgs: Msg[]; latest: Msg; unread: number }

const PREFIX = /^\s*((re|fwd?|fw|aw|sv|antw)(\[\d+\])?\s*:\s*)+/i;
/** "Re: Fwd: [x] Hello " -> "[x] hello" (prefixes stripped, whitespace collapsed, lower case). */
export const normSubject = (s: string) => s.replace(PREFIX, "").replace(/\s+/g, " ").trim().toLowerCase();
const clean = (id: string) => id.trim().replace(/^<|>$/g, "");
export const msgKey = (m: Pick<Msg, "accountId" | "folder" | "uid">) => `${m.accountId}/${m.folder}/${m.uid}`;

/** Groups messages into threads, newest thread first, messages oldest first inside. */
export function threadMsgs(ms: Msg[], meta: Map<string, ThreadMeta>): Thread[] {
  const parent = new Map<string, string>();
  const find = (k: string): string => { let r = k; while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!; return r; };
  const join = (a: string, b: string) => { const x = find(a), y = find(b); if (x !== y) parent.set(y, x); };
  const byId = new Map<string, string>(), bySubj = new Map<string, string>();
  for (const m of ms) {
    const k = msgKey(m); parent.set(k, k);
    const id = clean(meta.get(k)?.messageId ?? "");
    if (id) byId.set(`id:${id}`, k);
  }
  for (const m of ms) {
    const k = msgKey(m), mt = meta.get(k);
    const ids = mt ? [...mt.refs.split(/\s+/), mt.inReplyTo].map(clean).filter(Boolean) : [];
    for (const id of ids) {
      const other = byId.get(`id:${id}`);
      if (other) join(other, k); else if (!byId.has(`id:${id}`)) { byId.set(`id:${id}`, k); }
    }
    const s = normSubject(m.subject);
    if (s && !ids.length && PREFIX.test(m.subject) && bySubj.has(s)) join(bySubj.get(s)!, k);
    if (s && !bySubj.has(s)) bySubj.set(s, k);
  }
  const groups = new Map<string, Msg[]>();
  for (const m of ms) { const r = find(msgKey(m)); groups.set(r, [...(groups.get(r) ?? []), m]); }
  return [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => a.dateTs - b.dateTs || a.uid - b.uid);
    return { key, msgs: sorted, latest: sorted[sorted.length - 1], unread: sorted.filter((x) => !x.seen).length };
  }).sort((a, b) => b.latest.dateTs - a.latest.dateTs);
}
