// Squarified treemap layout (Bruls et al.), pure. Input sizes > 0; output rects fill the box.
export interface Rect { x: number; y: number; w: number; h: number }
export interface Item { name: string; size: number }
export type Placed<T> = T & Rect;

function worst(row: number[], side: number): number {
  const s = row.reduce((a, b) => a + b, 0);
  const mx = Math.max(...row), mn = Math.min(...row);
  return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
}

export function squarify<T extends Item>(items: T[], box: Rect): Placed<T>[] {
  const list = items.filter((i) => Number.isFinite(i.size) && i.size > 0).sort((a, b) => b.size - a.size);
  const total = list.reduce((a, b) => a + b.size, 0);
  if (!list.length || box.w <= 0 || box.h <= 0) return [];
  const scale = (box.w * box.h) / total;
  const areas = list.map((i) => i.size * scale);
  const out: Placed<T>[] = [];
  let { x, y, w, h } = box;
  let i = 0;
  while (i < list.length) {
    const side = Math.min(w, h);
    const row = [areas[i]];
    let j = i + 1;
    while (j < list.length && worst([...row, areas[j]], side) <= worst(row, side)) row.push(areas[j++]);
    const sum = row.reduce((a, b) => a + b, 0);
    const thick = sum / side;
    let off = 0;
    row.forEach((a, k) => {
      const len = a / thick;
      out.push(w >= h ? { ...list[i + k], x, y: y + off, w: thick, h: len } : { ...list[i + k], x: x + off, y, w: len, h: thick });
      off += len;
    });
    if (w >= h) { x += thick; w -= thick; } else { y += thick; h -= thick; }
    i = j;
  }
  return out;
}
