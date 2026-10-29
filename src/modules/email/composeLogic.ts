// Reply / reply-all / forward drafts. Pure. Plain-text quoting only.
import type { Addr, Body, Msg } from "./types.ts";
import { formatAddr, formatList } from "./addresses.ts";

export interface Draft { to: string; cc: string; bcc: string; subject: string; body: string; inReplyTo: string }
export const emptyDraft = (): Draft => ({ to: "", cc: "", bcc: "", subject: "", body: "", inReplyTo: "" });
export type Mode = "reply" | "replyAll" | "forward";

const prefixed = (subject: string, p: "Re" | "Fwd") =>
  new RegExp(`^\\s*(${p === "Re" ? "re" : "fwd?|fw"})\\s*:`, "i").test(subject) ? subject : `${p}: ${subject}`;

export const quoteText = (t: string) => t.replace(/\r\n/g, "\n").split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n");
const when = (ts: number) => (ts ? new Date(ts * 1000).toUTCString() : "an earlier date");
const sender = (m: Msg) => formatAddr({ name: m.fromName, address: m.fromAddr });

/** Plain text of a message for quoting (HTML-only mail falls back to its preview). */
export const quotable = (b: Body | null, m: Msg) => (b?.text ?? "").trim() || m.preview;

export function buildDraft(mode: Mode, m: Msg, b: Body | null, me: string): Draft {
  const body = quotable(b, m);
  const meLc = me.toLowerCase();
  if (mode === "forward") {
    const hdr = `---------- Forwarded message ----------\nFrom: ${sender(m)}\nDate: ${when(m.dateTs)}\nSubject: ${m.subject}\nTo: ${m.to}\n\n`;
    return { ...emptyDraft(), subject: prefixed(m.subject, "Fwd"), body: `\n\n${hdr}${body}` };
  }
  const replyTo: Addr[] = b?.replyTo.length ? b.replyTo : [{ name: m.fromName, address: m.fromAddr }];
  const d: Draft = {
    ...emptyDraft(), to: formatList(replyTo), subject: prefixed(m.subject, "Re"), inReplyTo: b?.messageId ? `<${b.messageId.replace(/^<|>$/g, "")}>` : "",
    body: `\n\nOn ${when(m.dateTs)}, ${sender(m)} wrote:\n${quoteText(body)}\n`,
  };
  if (mode === "replyAll" && b) {
    const taken = new Set(replyTo.map((a) => a.address.toLowerCase()).concat(meLc));
    const rest = [...b.to, ...b.cc].filter((a) => !taken.has(a.address.toLowerCase()));
    const uniq = rest.filter((a, i) => rest.findIndex((x) => x.address.toLowerCase() === a.address.toLowerCase()) === i);
    d.cc = formatList(uniq);
  }
  return d;
}
