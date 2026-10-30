// Pure disk-full forecast. History = one sample per disk per day in app_settings `disk_hist`
// (recorded only when PC Care reads metrics; no background sampling).
export interface DiskSample { day: string; mount: string; used: number; total: number }
export const HIST_KEY = "disk_hist";
const KEEP = 120;

export function addSamples(hist: DiskSample[], disks: { mount: string; used_gb: number; total_gb: number }[], day: string): DiskSample[] {
  const rest = hist.filter((s) => !(s.day === day && disks.some((d) => d.mount === s.mount)));
  const add = disks.filter((d) => d.total_gb > 0).map((d) => ({ day, mount: d.mount, used: +d.used_gb.toFixed(2), total: +d.total_gb.toFixed(2) }));
  const all = [...rest, ...add].sort((a, b) => a.day.localeCompare(b.day));
  const byMount = new Map<string, DiskSample[]>();
  for (const s of all) byMount.set(s.mount, [...(byMount.get(s.mount) ?? []), s]);
  return [...byMount.values()].flatMap((v) => v.slice(-KEEP));
}

export function parseHist(text: string | null): DiskSample[] {
  try {
    const v = JSON.parse(text ?? "[]");
    return Array.isArray(v) ? v.filter((s) => s && typeof s.day === "string" && typeof s.mount === "string" && Number.isFinite(s.used) && Number.isFinite(s.total)) : [];
  } catch { return []; }
}

const dayNum = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;

export interface Forecast { mount: string; perDay: number; daysLeft: number | null; samples: number }

/** Least-squares GB/day over the samples; daysLeft null = not growing or under 3 samples. */
export function forecast(hist: DiskSample[], mount: string): Forecast {
  const s = hist.filter((x) => x.mount === mount);
  if (s.length < 3) return { mount, perDay: 0, daysLeft: null, samples: s.length };
  const xs = s.map((x) => dayNum(x.day));
  const mx = xs.reduce((a, b) => a + b, 0) / s.length;
  const my = s.reduce((a, b) => a + b.used, 0) / s.length;
  let num = 0, den = 0;
  s.forEach((x, i) => { num += (xs[i] - mx) * (x.used - my); den += (xs[i] - mx) ** 2; });
  const perDay = den ? num / den : 0;
  const last = s[s.length - 1];
  const free = last.total - last.used;
  return { mount, perDay: +perDay.toFixed(3), daysLeft: perDay > 0.001 ? Math.max(0, Math.round(free / perDay)) : null, samples: s.length };
}

export const forecastText = (f: Forecast) =>
  f.samples < 3 ? `${f.mount}: need ${3 - f.samples} more day(s) of readings`
    : f.daysLeft === null ? `${f.mount}: not filling up` : `${f.mount}: full in about ${f.daysLeft} day(s) (${f.perDay} GB/day)`;
