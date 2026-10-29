// Pure: numeric database id from a skill arg or a prefixed panel row id ("clip-4" -> 4).
export function numericId(v: unknown): number {
  const t = typeof v === "number" ? String(v) : String(v ?? "").replace(/^[A-Za-z_]+-/, "");
  const n = t.trim() === "" ? NaN : Number(t);
  if (!Number.isInteger(n) || n < 0) throw new Error("id missing or invalid");
  return n;
}

/** Whole days for a "clear older than N days" arg; 0 means everything. */
export function daysArg(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 36500) throw new Error("days must be a whole number >= 0");
  return n;
}
