// Pure panel navigation state: back/forward over recently focused panels and
// a stack of recently closed panels (with their last rect) for "reopen".
import type { Rect } from "../layout.ts";

export type NavState = { back: string[]; cur: string | null; fwd: string[] };
export const emptyNav = (): NavState => ({ back: [], cur: null, fwd: [] });
const CAP = 30;

/** A panel got focus by the user: becomes current, forward history is dropped. */
export function visit(s: NavState, id: string): NavState {
  if (s.cur === id) return s;
  const back = s.cur ? [...s.back.filter((x) => x !== s.cur), s.cur].slice(-CAP) : s.back;
  return { back: back.filter((x) => x !== id), cur: id, fwd: [] };
}
/** Step back/forward, skipping ids that are no longer open. Returns null when nowhere to go. */
export function step(s: NavState, dir: "back" | "fwd", isOpen: (id: string) => boolean): NavState | null {
  const from = dir === "back" ? [...s.back] : [...s.fwd];
  const other = dir === "back" ? [...s.fwd] : [...s.back];
  while (from.length) {
    const id = dir === "back" ? from.pop()! : from.shift()!;
    if (!isOpen(id)) continue;
    if (s.cur) dir === "back" ? other.unshift(s.cur) : other.push(s.cur);
    return dir === "back" ? { back: from, cur: id, fwd: other } : { back: other, cur: id, fwd: from };
  }
  return null;
}
/** Forget a panel everywhere (it closed). */
export function drop(s: NavState, id: string): NavState {
  return { back: s.back.filter((x) => x !== id), cur: s.cur === id ? null : s.cur, fwd: s.fwd.filter((x) => x !== id) };
}

export type Closed = { id: string; rect?: Rect };
export function pushClosed(stack: Closed[], c: Closed): Closed[] {
  return [...stack.filter((x) => x.id !== c.id), c].slice(-CAP);
}
export function popClosed(stack: Closed[], isOpen: (id: string) => boolean): { next: Closed[]; item: Closed | null } {
  const s = [...stack];
  while (s.length) {
    const item = s.pop()!;
    if (!isOpen(item.id)) return { next: s, item };
  }
  return { next: s, item: null };
}
