// Local "Recommended" ranking (no network, no model): watch + thumbs-up
// affinity, title keywords, mild recency, minus what you disliked or hid.
import { decay, hiddenOf, isHidden, mergeWatched, type Sig, type Watched } from "./library.ts";

export interface Video { videoId: string; channelId: string; channel: string; title: string; publishedAt: string | null }
export interface Scored extends Video { score: number; why: string }

const STOP = new Set(("the and for you your with this that from are was were not but have has had how what why when who " +
  "its into out new all can will just about our their they them more most than then too very official video videos " +
  "full episode part live").split(" "));

export function tokenize(title: string): string[] {
  const t = title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
  return [...new Set(t)];
}

type Acc = { aff: Map<string, number>; kw: Map<string, number> };
const acc = (): Acc => ({ aff: new Map(), kw: new Map() });
function add(a: Acc, channelId: string | null, title: string, wt: number) {
  if (channelId) a.aff.set(channelId, (a.aff.get(channelId) ?? 0) + wt);
  for (const t of tokenize(title)) a.kw.set(t, (a.kw.get(t) ?? 0) + wt);
}
const sat = (x: number) => x / (x + 1); // one event ~0.5, never beyond 1
const meanTok = (toks: string[], f: (t: string) => number) => (toks.length ? toks.reduce((x, t) => x + f(t), 0) / toks.length : 0);

/** Rank UNWATCHED, not-hidden videos. A video counts once however many history rows it has. */
export function recommend(videos: Video[], watched: Watched[], now = Date.now(), limit = 8, signals: Sig[] = [], bonus?: (v: Video) => number): Scored[] {
  const hist = mergeWatched(watched);
  const seen = new Set(hist.map((w) => w.videoId));
  const hidden = hiddenOf(signals);
  const pos = acc();
  const neg = acc();
  for (const w of hist) add(pos, w.channelId, w.title, decay(w.watchedAt, now, 30));
  for (const s of signals) {
    if (s.kind !== "video") continue;
    const wt = decay(s.at, now, 30);
    if (s.signal === "like") add(pos, s.channelId, s.title, 1.5 * wt);
    else add(neg, s.channelId, s.title, wt); // dislike and not-interested
  }
  const maxA = Math.max(0, ...pos.aff.values());
  const maxK = Math.max(0, ...pos.kw.values());
  return videos
    .filter((v) => v.videoId && !seen.has(v.videoId) && !isHidden(hidden, v.videoId, v.channelId))
    .map((v) => {
      const toks = tokenize(v.title);
      const a = maxA ? (pos.aff.get(v.channelId) ?? 0) / maxA : 0;
      const k = maxK ? meanTok(toks, (t) => (pos.kw.get(t) ?? 0) / maxK) : 0;
      const penalty = 2 * sat(neg.aff.get(v.channelId) ?? 0) + 1.5 * meanTok(toks, (t) => sat(neg.kw.get(t) ?? 0));
      const score = 2 * a + 1.5 * k + 0.4 * decay(v.publishedAt, now, 7) - penalty + (bonus?.(v) ?? 0);
      return { ...v, score, why: a >= k && a > 0 ? "a channel you watch" : k > 0 ? "similar to what you watched" : "new" };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}
