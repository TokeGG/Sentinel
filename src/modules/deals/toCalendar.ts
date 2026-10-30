// Pure: a deal row -> Calendar add_item args (task today, deal link kept; only http(s) links).
export function dealCalendarItem(r: { title: unknown; link: unknown }, now: Date) {
  const link = String(r.link ?? "");
  return {
    kind: "task",
    title: `Deal: ${String(r.title ?? "").slice(0, 140)}`,
    day: now.toISOString().slice(0, 10),
    url: /^https?:\/\//i.test(link) ? link : "",
    notes: "From Deals",
  };
}
