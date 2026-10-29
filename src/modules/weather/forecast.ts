// Pure: Open-Meteo `daily` block -> up to 5 forecast days (local dates from the API's timezone=auto).
export type Day = { day: string; hi: number | null; lo: number | null; code: number | null };
type Daily = { time?: unknown[]; temperature_2m_max?: unknown[]; temperature_2m_min?: unknown[]; weather_code?: unknown[] };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parseDaily(d: Daily | undefined, max = 5): Day[] {
  const t = Array.isArray(d?.time) ? d!.time : [];
  return t.slice(0, max).filter((x): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x)).map((day, i) => ({
    day, hi: num(d?.temperature_2m_max?.[i]), lo: num(d?.temperature_2m_min?.[i]), code: num(d?.weather_code?.[i]),
  }));
}

/** "Today" for the first day, else the weekday of the date (no timezone shift: parsed as a plain date). */
export function dayName(day: string, index: number): string {
  if (index === 0) return "Today";
  const [y, m, d] = day.split("-").map(Number);
  return WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export const FORECAST_QUERY = "&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=5&timezone=auto";
