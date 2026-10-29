// Snooze, unsubscribe, contacts autocomplete, attachment preview kind, drafts. Pure.
import { parseAddressList } from "./addresses.ts";

const DAY = 86400;
/** Snooze choices relative to `now` (unix seconds, local time). */
export function snoozeChoices(now: Date): { label: string; until: number }[] {
  const at = (days: number, h: number) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(h, 0, 0, 0); return Math.floor(d.getTime() / 1000); };
  const sat = (6 - now.getDay() + 7) % 7 || 7;
  return [
    { label: "In 3 hours", until: Math.floor(now.getTime() / 1000) + 3 * 3600 },
    { label: "Tomorrow 08:00", until: at(1, 8) },
    { label: "This weekend", until: at(sat, 9) },
    { label: "Next week", until: at(7, 8) },
  ];
}
export const isSnoozed = (until: number | undefined, nowTs: number) => !!until && until > nowTs;
export const snoozeLabel = (until: number) => new Date(until * 1000).toLocaleString();
export { DAY };

export interface Unsub { https: string | null; mailto: { to: string; subject: string; body: string } | null }
/** List-Unsubscribe: "<https://...>, <mailto:x@y?subject=..>" -> the first https and the first mailto. */
export function parseUnsubscribe(raw: string): Unsub {
  const items = [...raw.matchAll(/<([^<>]+)>/g)].map((m) => m[1].trim());
  const https = items.find((u) => /^https:\/\//i.test(u)) ?? null;
  const mt = items.find((u) => /^mailto:/i.test(u));
  let mailto: Unsub["mailto"] = null;
  if (mt) {
    const [addr, q = ""] = mt.slice(7).split("?");
    const p = new URLSearchParams(q);
    const to = decodeURIComponent(addr);
    if (parseAddressList(to).ok.length === 1) mailto = { to, subject: p.get("subject") ?? "unsubscribe", body: p.get("body") ?? "unsubscribe" };
  }
  return { https, mailto };
}

/** Autocomplete for the last comma-separated token: names/addresses containing it, deduped, max 8. */
export function suggest(input: string, pool: { name: string; address: string }[], max = 8): string[] {
  const tok = (input.split(/[,;]/).pop() ?? "").trim().toLowerCase();
  if (tok.length < 2) return [];
  const seen = new Set<string>(), out: string[] = [];
  for (const c of pool) {
    const a = c.address.toLowerCase();
    if (seen.has(a) || !(a.includes(tok) || c.name.toLowerCase().includes(tok))) continue;
    seen.add(a); out.push(c.name ? `${c.name} <${c.address}>` : c.address);
    if (out.length >= max) break;
  }
  return out;
}
/** Replaces the last token of `input` with `pick`, keeping earlier recipients. */
export const applySuggestion = (input: string, pick: string) => {
  const parts = input.split(/[,;]/); parts.pop();
  return [...parts.map((p) => p.trim()).filter(Boolean), pick].join(", ") + ", ";
};
/** Pool from contacts rows ("a@x, b@y") and sent-mail To fields. */
export function contactPool(contacts: { name: string; emails: string }[], sentTo: string[]): { name: string; address: string }[] {
  const out = contacts.flatMap((c) => c.emails.split(/[,;\s]+/).filter((e) => e.includes("@")).map((address) => ({ name: c.name, address })));
  for (const t of sentTo) out.push(...parseAddressList(t).ok);
  return out;
}

export type PreviewKind = "image" | "pdf" | "text" | "none";
const IMG = /^image\/(png|jpe?g|gif|webp|bmp)$/i;
export function previewKind(mime: string, name: string): PreviewKind {
  if (IMG.test(mime)) return "image"; // never svg (scriptable)
  if (/^application\/pdf$/i.test(mime) || /\.pdf$/i.test(name)) return "pdf";
  if (/^text\/(plain|csv)$/i.test(mime) || /\.(txt|csv|log|md)$/i.test(name)) return "text";
  return "none";
}
export const decodeText = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

export interface StoredDraft { id: string; accountId: string; to: string; cc: string; bcc: string; subject: string; body: string; inReplyTo: string; updatedAt: number }
export const draftEmpty = (d: { to: string; cc: string; bcc: string; subject: string; body: string }) => !`${d.to}${d.cc}${d.bcc}${d.subject}${d.body}`.trim();
export const draftTitle = (d: { subject: string; to: string }) => d.subject.trim() || (d.to.trim() ? `To ${d.to.trim()}` : "(empty draft)");
