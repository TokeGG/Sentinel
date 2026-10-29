// Pure glue used by panels: hide dismissed items, then order For-you or as given.
import { rank, type Ranked, type Profile, type Signal, type TasteItem } from "./model.ts";

/** Latest signal per item key. */
export type Marks = Record<string, Signal>;
export const isHiddenMark = (s: Signal | undefined) => s === "hide" || s === "dismiss";
export const withMark = (m: Marks, key: string, s: Signal): Marks => ({ ...m, [key]: s });

export function orderItems<T>(
  rows: T[], toItem: (r: T) => TasteItem, profile: Profile, marks: Marks,
  opts: { forYou: boolean; off: boolean; rng: () => number },
): Ranked<T>[] {
  const shown = rows.filter((r) => !isHiddenMark(marks[toItem(r).key]));
  if (!opts.forYou || opts.off) return shown.map((item) => ({ item, score: 0, why: [], explored: false }));
  const ranked = rank(shown.map((r) => ({ r, ...toItem(r) })), profile, opts.rng);
  return ranked.map((x) => ({ item: x.item.r, score: x.score, why: x.why, explored: x.explored }));
}
