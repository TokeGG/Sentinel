// Optional: import your YouTube subscriptions (channel ids only) through the
// connected Google account (Settings > Accounts > YouTube). Pure parsing here.
export interface SubsPage { ids: string[]; next: string | null }

const CH = /^UC[\w-]{22}$/;

export function parseSubsPage(j: unknown): SubsPage {
  const o = (j ?? {}) as { items?: unknown[]; nextPageToken?: unknown };
  const ids = (o.items ?? [])
    .map((it) => (it as { snippet?: { resourceId?: { channelId?: unknown } } })?.snippet?.resourceId?.channelId)
    .filter((x): x is string => typeof x === "string" && CH.test(x));
  return { ids, next: typeof o.nextPageToken === "string" && o.nextPageToken ? o.nextPageToken : null };
}

export const subsUrl = (pageToken: string | null): string =>
  "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50" + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");

/** Ids not yet followed, in order, without duplicates. */
export const newIds = (ids: string[], have: Set<string>): string[] => [...new Set(ids)].filter((i) => !have.has(i));
