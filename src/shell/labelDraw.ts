// Planet names, placed by the pure collision layout (labels.ts): nearer
// planets win, a label that fits nowhere is hidden (the hovered one never is).
import { layoutLabels } from "./labels.ts";
import type { Scene } from "./mapLayout.ts";
import { SUN } from "./mapHit.ts";

const FONT = "400 12px Inter, Avenir, Helvetica, Arial, sans-serif";
const FONT_HOVER = "600 12px Inter, Avenir, Helvetica, Arial, sans-serif";
const LABEL_H = 15, SUN_LABEL = "Master Hub";
const widths = new Map<string, number>(); // text -> measured width, filled once per name
let prio = new Int32Array(0);

function widthOf(ctx: CanvasRenderingContext2D, t: string): number {
  let w = widths.get(t);
  if (w === undefined) {
    ctx.font = FONT_HOVER; // widest variant, so a hover never overflows its slot
    widths.set(t, (w = Math.ceil(ctx.measureText(t).width) + 4));
  }
  return w;
}

export function drawLabels(ctx: CanvasRenderingContext2D, s: Scene, W: number, H: number) {
  const n = s.slots.length, L = s.labels;
  if (prio.length !== n) prio = new Int32Array(n);
  let m = 0;
  for (let k = n; k >= 0; k--) { const i = s.order[k]; if (i < n) prio[m++] = i; } // near -> far
  for (let i = 0; i < n; i++) { L.x[i] = s.sx[i]; L.y[i] = s.sy[i]; L.r[i] = s.rad[i]; L.w[i] = widthOf(ctx, s.slots[i].name); }
  layoutLabels(L, prio, m, LABEL_H, W, H, s.hover >= 0 ? s.hover : -1, { x: s.sx[n], y: s.sy[n], r: s.rad[n] });
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(5,7,15,0.8)";
  for (let i = 0; i < n; i++) {
    if (L.pick[i] < 0) continue;
    const hov = i === s.hover, t = s.slots[i].name;
    ctx.font = hov ? FONT_HOVER : FONT;
    ctx.strokeText(t, L.ox[i] + 2, L.oy[i]);
    ctx.fillStyle = hov ? "#ffffff" : "#aab3cf";
    ctx.fillText(t, L.ox[i] + 2, L.oy[i]);
  }
  if (s.hover === SUN) {
    ctx.font = FONT_HOVER;
    ctx.textAlign = "center";
    ctx.strokeText(SUN_LABEL, s.sx[n], s.sy[n] + s.rad[n] + 8);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(SUN_LABEL, s.sx[n], s.sy[n] + s.rad[n] + 8);
  }
}
