// Pure: Nager.Date public holidays (key-less). URL builder + parser of the JSON body.
import type { Holiday } from "./holidays.ts";

export const nagerUrl = (year: number, cc: string) => `https://date.nager.at/api/v3/PublicHolidays/${year}/${cc.toUpperCase()}`;
export const validCountry = (cc: string) => /^[A-Za-z]{2}$/.test(cc.trim());

export function parseNager(body: unknown, cc: string): Holiday[] {
  if (!Array.isArray(body)) throw new Error("holiday list is not an array");
  const out: Holiday[] = [];
  for (const h of body as Record<string, unknown>[]) {
    const day = String(h?.date ?? "");
    const name = String(h?.name ?? h?.localName ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !name) continue;
    out.push({ key: `${cc.toUpperCase()}-${day}-${out.length}`, day, title: name, set: `nager:${cc.toUpperCase()}` });
  }
  return out;
}
