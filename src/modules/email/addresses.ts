// Address parsing/validation for the compose form. Pure.
import type { Addr } from "./types.ts";

const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:".]+$/;
export const isEmail = (s: string) => s.length <= 254 && EMAIL.test(s.trim());

/** "Ann <a@x.com>, b@x.com; \"Lee, Bo\" <l@x.com>" -> entries; invalid ones listed in `bad`. */
export function parseAddressList(input: string): { ok: Addr[]; bad: string[] } {
  const parts: string[] = [];
  let cur = "", quoted = false;
  for (const ch of input) {
    if (ch === '"') quoted = !quoted;
    if ((ch === "," || ch === ";") && !quoted) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  const ok: Addr[] = [], bad: string[] = [];
  for (const raw of parts.map((p) => p.trim()).filter(Boolean)) {
    const m = /^(.*)<([^<>]*)>$/.exec(raw);
    const address = (m ? m[2] : raw).trim();
    const name = m ? m[1].trim().replace(/^"|"$/g, "").trim() : "";
    if (isEmail(address)) ok.push({ name, address }); else bad.push(raw);
  }
  return { ok, bad };
}

/** RFC-style display form; names with specials are quoted, quotes/CR/LF stripped. */
export function formatAddr(a: Addr): string {
  const name = a.name.replace(/["\r\n\\]/g, "").trim();
  if (!name) return a.address;
  return /[,;:<>()@.]/.test(name) ? `"${name}" <${a.address}>` : `${name} <${a.address}>`;
}
export const formatList = (l: Addr[]) => l.map(formatAddr).join(", ");
export const displayName = (a: { name: string; address: string }) => a.name.trim() || a.address || "(unknown)";

export interface RecipientCheck { to: Addr[]; cc: Addr[]; bcc: Addr[]; errors: string[] }
export function checkRecipients(to: string, cc: string, bcc: string): RecipientCheck {
  const t = parseAddressList(to), c = parseAddressList(cc), b = parseAddressList(bcc);
  const errors = [...t.bad, ...c.bad, ...b.bad].map((x) => `Invalid address: ${x}`);
  if (!t.ok.length && !c.ok.length && !b.ok.length && !errors.length) errors.push("Add at least one recipient");
  return { to: t.ok, cc: c.ok, bcc: b.ok, errors };
}
