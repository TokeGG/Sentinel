// Pure section ordering for <Section>/useSections (no React) — unit-tested.
import type { View } from "./prefs.ts";

/** True when the view declares sections but every one is hidden. */
export function noneVisible(view: View | null | undefined): boolean {
  const s = view?.sections ?? [];
  return s.length > 0 && !s.some((x) => x.visible);
}

/** Visible section ids in the view's saved order; [] without a view. */
export function orderedVisible(view: View | null | undefined): string[] {
  return (view?.sections ?? []).filter((s) => s.visible).map((s) => s.id);
}
