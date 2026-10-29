// Pure playback queue for the pop-out player (hub.ytplayer), shared between webviews
// as app_settings `yt_queue` JSON + the `yt-queue` event. Also IFrame "ended" detection
// and 16:9 sizing for the resizable players.
export interface QItem { videoId: string; channelId: string | null; title: string }
export interface Queue { items: QItem[]; index: number; at: number }
export const QUEUE_KEY = "yt_queue";
export const QUEUE_EVENT = "yt-queue";
export const SIZE_KEY = "yt_player_size";
export const EMPTY: Queue = { items: [], index: 0, at: 0 };
const MAX = 200;
const okId = (v: unknown): v is string => typeof v === "string" && /^[\w-]{11}$/.test(v);

/** Untrusted JSON (or object) -> a valid queue; bad entries dropped, index clamped. */
export function sanitizeQueue(raw: unknown): Queue {
  let o = raw;
  if (typeof raw === "string") { try { o = JSON.parse(raw); } catch { return EMPTY; } }
  const q = o as Partial<Queue> | null;
  if (!q || !Array.isArray(q.items)) return EMPTY;
  const items = q.items.filter((i) => i && okId(i.videoId)).slice(0, MAX)
    .map((i) => ({ videoId: i.videoId, channelId: typeof i.channelId === "string" ? i.channelId : null, title: String(i.title ?? "").slice(0, 300) }));
  const index = Math.min(Math.max(0, Math.floor(Number(q.index) || 0)), Math.max(0, items.length - 1));
  const at = Math.max(0, Number(q.at) || 0);
  return { items, index, at: items.length ? at : 0 };
}

/** Queue starting at `cur`: the first source list containing it continues from there; else `fallback` follows it. */
export function buildQueue(cur: QItem, lists: QItem[][], fallback: QItem[], at = 0): Queue {
  const src = lists.find((l) => l.some((i) => i.videoId === cur.videoId));
  const rest = src ? src.slice(src.findIndex((i) => i.videoId === cur.videoId) + 1) : fallback;
  const seen = new Set([cur.videoId]);
  const items = [cur, ...rest.filter((i) => !seen.has(i.videoId) && seen.add(i.videoId))];
  return sanitizeQueue({ items, index: 0, at });
}
export const current = (q: Queue): QItem | null => q.items[q.index] ?? null;
export const hasNext = (q: Queue) => q.index < q.items.length - 1;
export const hasPrev = (q: Queue) => q.index > 0;
export const step = (q: Queue, d: 1 | -1): Queue => {
  const i = q.index + d;
  return i < 0 || i >= q.items.length ? q : { ...q, index: i, at: 0 };
};
export const withAt = (q: Queue, at: number): Queue => ({ ...q, at: Math.max(0, at) });

/** IFrame API message -> true when the video ended (player state 0). */
export function isEnded(data: unknown): boolean {
  let o: unknown = data;
  if (typeof data === "string") { try { o = JSON.parse(data); } catch { return false; } }
  const m = o as { event?: string; info?: unknown } | null;
  if (!m) return false;
  if (m.event === "onStateChange") return m.info === 0;
  if (m.event === "infoDelivery" && m.info && typeof m.info === "object") return (m.info as { playerState?: unknown }).playerState === 0;
  return false;
}

/** Player width clamped to [min, max] (16:9 height follows). */
export function clampWidth(w: number, max: number, min = 320): number {
  const hi = Math.max(min, max);
  return Math.round(Math.min(hi, Math.max(min, Number.isFinite(w) ? w : hi)));
}
export const heightFor = (w: number) => Math.round((w * 9) / 16);
/** Panel height that makes the video area exactly 16:9 for the current inner size (extra = bar etc.). */
export function lockedPanelH(panelH: number, innerW: number, innerH: number, extra: number): number {
  return Math.round(panelH + (heightFor(innerW) + extra - innerH));
}
