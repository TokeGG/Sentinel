// SQLite for mail extras (migration 38): thread/unsubscribe headers, snoozes, rules,
// local drafts, contact pool. Never holds credentials.
import { getDb } from "../../core/db";
import type { ThreadMeta } from "./threads.ts";
import type { Rule } from "./rules.ts";
import type { StoredDraft } from "./mailExtras.ts";

export interface MetaIn { accountId: string; folder: string; uid: number; messageId: string; inReplyTo: string; refs: string; unsub: string }
export async function saveMeta(ms: MetaIn[]) {
  const d = await getDb();
  for (const m of ms) await d.execute("INSERT OR REPLACE INTO mail_meta (account_id,folder,uid,message_id,in_reply_to,refs,unsub) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [m.accountId, m.folder, m.uid, m.messageId ?? "", m.inReplyTo ?? "", m.refs ?? "", m.unsub ?? ""]);
}
export async function loadMeta(): Promise<Map<string, ThreadMeta & { unsub: string }>> {
  const d = await getDb();
  const r = await d.select<{ account_id: string; folder: string; uid: number; message_id: string; in_reply_to: string; refs: string; unsub: string }[]>("SELECT * FROM mail_meta");
  return new Map(r.map((x) => [`${x.account_id}/${x.folder}/${x.uid}`, { messageId: x.message_id, inReplyTo: x.in_reply_to, refs: x.refs, unsub: x.unsub }]));
}

export async function snoozes(): Promise<Map<string, number>> {
  const d = await getDb();
  const r = await d.select<{ account_id: string; folder: string; uid: number; until_ts: number }[]>("SELECT * FROM mail_snooze");
  return new Map(r.map((x) => [`${x.account_id}/${x.folder}/${x.uid}`, x.until_ts]));
}
export async function setSnooze(accountId: string, folder: string, uid: number, until: number | null) {
  const d = await getDb();
  if (until === null) await d.execute("DELETE FROM mail_snooze WHERE account_id=$1 AND folder=$2 AND uid=$3", [accountId, folder, uid]);
  else await d.execute("INSERT OR REPLACE INTO mail_snooze (account_id,folder,uid,until_ts) VALUES ($1,$2,$3,$4)", [accountId, folder, uid, until]);
}

export async function listRules(): Promise<Rule[]> {
  const d = await getDb();
  const r = await d.select<{ id: number; field: string; needle: string; action: string; arg: string; enabled: number }[]>("SELECT * FROM mail_rules ORDER BY id");
  return r.map((x) => ({ ...x, field: x.field as Rule["field"], action: x.action as Rule["action"], enabled: !!x.enabled }));
}
export async function addRule(r: Omit<Rule, "id" | "enabled">) {
  await (await getDb()).execute("INSERT INTO mail_rules (field,needle,action,arg) VALUES ($1,$2,$3,$4)", [r.field, r.needle.trim(), r.action, r.arg.trim()]);
}
export async function removeRule(id: number) { await (await getDb()).execute("DELETE FROM mail_rules WHERE id=$1", [id]); }

export async function saveDraft(x: StoredDraft) {
  await (await getDb()).execute("INSERT OR REPLACE INTO mail_drafts (id,account_id,json,updated_at) VALUES ($1,$2,$3,$4)", [x.id, x.accountId, JSON.stringify(x), x.updatedAt]);
}
export async function listDrafts(): Promise<StoredDraft[]> {
  const r = await (await getDb()).select<{ json: string }[]>("SELECT json FROM mail_drafts ORDER BY updated_at DESC");
  return r.flatMap((x) => { try { return [JSON.parse(x.json) as StoredDraft]; } catch { return []; } });
}
export async function deleteDraft(id: string) { await (await getDb()).execute("DELETE FROM mail_drafts WHERE id=$1", [id]); }

/** Contacts module rows + To fields of cached Sent mail (for autocomplete). */
export async function contactSources(): Promise<{ contacts: { name: string; emails: string }[]; sentTo: string[] }> {
  const d = await getDb();
  const contacts = await d.select<{ name: string; emails: string }[]>("SELECT name, emails FROM contacts").catch(() => []);
  const sent = await d.select<{ to_addrs: string }[]>(
    "SELECT m.to_addrs FROM mail_messages m JOIN mail_folders f ON f.account_id=m.account_id AND f.name=m.folder WHERE f.role='sent' ORDER BY m.date_ts DESC LIMIT 1000").catch(() => []);
  return { contacts, sentTo: sent.map((x) => x.to_addrs) };
}
