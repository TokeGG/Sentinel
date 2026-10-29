// Pure helpers for the Home Network panel.
type Row = Record<string, unknown>;

export const homenetSections = [
  { id: "summary", label: "Summary" },
  { id: "devices", label: "Devices" },
  { id: "scan", label: "Scan network" },
  { id: "tag", label: "Tag editor" },
];

/** IPv4 as a sortable number; Infinity for anything that is not a dotted quad. */
export function ipKey(ip: unknown): number {
  if (typeof ip !== "string") return Infinity;
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return Infinity;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return Infinity;
    n = n * 256 + Number(p);
  }
  return n;
}

/** New array sorted by IP numerically (then MAC); unparseable IPs last. */
export function sortDevices<T extends Row>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ka = ipKey(a.ip);
    const kb = ipKey(b.ip);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return String(a.mac ?? "").localeCompare(String(b.mac ?? ""));
  });
}

/** Rows whose id is not in knownIds (ids compared as strings). */
export function newDevices<T extends Row>(rows: T[], knownIds: Set<string>): T[] {
  return rows.filter((r) => !knownIds.has(String(r.id)));
}

/** The only name the data holds is the user's tag; null = unknown device. */
export function deviceName(r: Row): string | null {
  return typeof r.tag === "string" && r.tag.trim() ? r.tag.trim() : null;
}
