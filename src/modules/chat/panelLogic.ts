// Pure helpers for the chat panel (no Tauri/React): customize declaration,
// message buffer, mention/scroll rules, room list rules.
import type { OptionDef } from "../../core/customizeChecks.ts";
import type { Incoming, Message, Room } from "./types.ts";

export const chatSections = [
  { id: "tabs", label: "Room tabs & add room" },
  { id: "rooms", label: "Chat" },
  { id: "login", label: "Twitch login (to send)", default: false },
];
export const chatOptions: OptionDef[] = [
  { key: "view", label: "Layout", type: "select", default: "tabs", choices: ["tabs", "columns"] },
  { key: "columns", label: "Columns (columns layout)", type: "number", default: 2, min: 2, max: 3 },
  { key: "timestamps", label: "Show timestamps", type: "toggle", default: false },
  { key: "cap", label: "Messages kept per room", type: "number", default: 500, min: 50, max: 2000 },
];

type Row = Record<string, unknown>;
export const toRooms = (rows: Row[]): Room[] =>
  rows.map((r) => ({ id: String(r.id), site: String(r.site), target: String(r.target), label: String(r.label), position: Number(r.position) || 0, pinned: Number(r.pinned) === 1 }));

/** Append a batch, keeping only the newest `cap`. Ids continue from `seq`. */
export function pushCapped(list: Message[], batch: Incoming[], seq: number, cap: number): Message[] {
  const next = list.concat(batch.map((m, i) => ({ ...m, id: String(seq + i) })));
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Ban/timeout: strike a user's messages. No user: chat cleared (everything struck). */
export function applyClear(list: Message[], user?: string): Message[] {
  const u = user?.toLowerCase();
  return list.map((m) => (m.kind !== "notice" && (!u || m.user.toLowerCase() === u) ? { ...m, deleted: true } : m));
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** True when `text` @-mentions or says `nick` as a whole word (case-insensitive). */
export function isMention(text: string, nick?: string): boolean {
  return !!nick && new RegExp(`(^|[^\\w])@?${esc(nick)}(?![\\w])`, "i").test(text);
}

/** Auto-scroll sticks while the viewport is within `slack` px of the bottom. */
export const isAtBottom = (top: number, height: number, full: number, slack = 40) => full - top - height <= slack;

const pad = (n: number) => String(n).padStart(2, "0");
export const clock = (ms: number) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/** Rooms shown at once: tabs = the active one; columns = pinned ones (all if none pinned). */
export function visibleRooms(rooms: Room[], mode: string, activeId: string): Room[] {
  if (mode !== "columns") return rooms.filter((r) => r.id === activeId);
  const pinned = rooms.filter((r) => r.pinned);
  return pinned.length ? pinned : rooms;
}

/** Swap `id` with its neighbour; returns the new order of ids (unchanged at the ends). */
export function moved(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

const BADGE: Record<string, string> = { broadcaster: "HOST", moderator: "MOD", admin: "ADM", vip: "VIP", subscriber: "SUB", founder: "SUB", staff: "STAFF", bot: "BOT", protected: "PROT", og: "OG", verified: "✓" };
export const badgeLabel = (b: string) => BADGE[b] ?? "";

/** Stable id + profile for an embedded site opened as its own web panel. */
export function webPanelRef(url: string): { id: string; profile: string } {
  let h = 5381;
  for (const c of url) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  let host = "site";
  try { host = new URL(url).hostname; } catch { /* keep default */ }
  return { id: `hub.chat.web-${h.toString(16)}`, profile: `chat-${host.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`.slice(0, 32).replace(/-+$/, "") };
}
