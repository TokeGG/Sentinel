// Pure date math for built-in holidays: Easter (computus), nth/last weekday, US observed rule.
const p2 = (n: number) => String(n).padStart(2, "0");
export const ymd = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
};
export const addDays = (day: string, n: number) => ymd(+day.slice(0, 4), +day.slice(5, 7), +day.slice(8, 10) + n);
const dow = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/** Western (Gregorian) Easter Sunday, anonymous Gregorian algorithm. */
export function easter(y: number): string {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}

/** nth (1-based) weekday (0 = Sun) of a month; n = -1 = last. */
export function nthWeekday(y: number, m: number, wd: number, n: number): string {
  if (n < 0) { const last = ymd(y, m + 1, 0); return addDays(last, -((dow(last) - wd + 7) % 7)); }
  const first = ymd(y, m, 1);
  return addDays(first, ((wd - dow(first) + 7) % 7) + 7 * (n - 1));
}

/** US federal observed day: Saturday -> Friday, Sunday -> Monday. */
export function observed(day: string): string {
  const w = dow(day);
  return w === 6 ? addDays(day, -1) : w === 0 ? addDays(day, 1) : day;
}
