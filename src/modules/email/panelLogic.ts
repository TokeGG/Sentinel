// Pure helpers for the Email panel: sections, list formatting, sorting, search, cache diffing.
import { hhmm, type ClockFmt } from "../../shell/desk/uiDefaults.ts";
import type { Msg } from "./types.ts";

export const emailSections = [
  { id: "folders", label: "Folders" },
  { id: "list", label: "Message list" },
  { id: "reader", label: "Reading pane" },
  { id: "compose", label: "Compose" },
];

/** Newest first; equal/zero dates fall back to higher UID (no threading). */
export const sortMessages = (ms: Msg[]): Msg[] => [...ms].sort((a, b) => b.dateTs - a.dateTs || b.uid - a.uid);

/** Case-insensitive match over cached sender, subject and preview. Empty query keeps all. */
export function searchMessages(ms: Msg[], q: string): Msg[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return ms;
  return ms.filter((m) => {
    const hay = `${m.fromName} ${m.fromAddr} ${m.subject} ${m.preview}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export const senderLabel = (m: Pick<Msg, "fromName" | "fromAddr">) => m.fromName.trim() || m.fromAddr || "(unknown)";
export const subjectLabel = (s: string) => s.trim() || "(no subject)";
export const previewLine = (s: string, max = 110) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** Today -> "14:05"; this year -> "Mar 3"; older -> "Mar 3, 2023"; unknown -> "". */
export function dateLabel(ts: number, now: Date = new Date(), clock: ClockFmt = "24h"): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  if (d.toDateString() === now.toDateString()) return hhmm(d.getHours(), d.getMinutes(), clock);
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.getFullYear() === now.getFullYear() ? md : `${md}, ${d.getFullYear()}`;
}
export const fullDate = (ts: number) => (ts ? new Date(ts * 1000).toLocaleString() : "");
export const sizeLabel = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** UIDs cached for a folder that a fresh newest-page no longer contains (deleted/moved elsewhere). */
export function staleUids(cached: number[], fetched: number[]): number[] {
  if (!fetched.length) return [];
  const min = Math.min(...fetched), have = new Set(fetched);
  return cached.filter((u) => u >= min && !have.has(u));
}

export const unreadCount = (ms: Msg[]) => ms.filter((m) => !m.seen).length;
export const hasMore = (cachedCount: number, total: number) => cachedCount < total;

/** http(s) URLs found in plain text, deduped, trailing punctuation trimmed. */
export function urlsIn(text: string): { text: string; url: string }[] {
  const found = (text.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? []).map((u) => u.replace(/[.,;:!?]+$/, ""));
  return [...new Set(found)].slice(0, 50).map((url) => ({ text: url, url }));
}

/** Stable 0-359 hue for an avatar colour from a name/address; first letter/digit as its glyph. */
export const avatarHue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
export const initialOf = (s: string) => (s.trim().match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase();

/** Virtual folders shown above the account's real folders. */
export const VIRTUAL = { unified: "__unified", snoozed: "__snoozed", drafts: "__drafts" } as const;
export const isVirtual = (f: string) => Object.values(VIRTUAL).includes(f as never);
export const virtualLabel: Record<string, string> = { [VIRTUAL.unified]: "All inboxes", [VIRTUAL.snoozed]: "Snoozed", [VIRTUAL.drafts]: "Drafts (local)" };
/** Hides messages snoozed into the future, except in the Snoozed folder. */
export function visibleNow(ms: Msg[], snooze: Map<string, number>, folder: string, nowTs: number): Msg[] {
  if (folder === VIRTUAL.snoozed) return ms;
  return ms.filter((m) => !((snooze.get(`${m.accountId}/${m.folder}/${m.uid}`) ?? 0) > nowTs));
}
