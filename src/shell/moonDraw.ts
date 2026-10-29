// Notification moons (tilted orbit around each planet, back half behind the
// body, front half over it), number bubble, pulse ring, "N unread" hover text
// and the sun's badge glow. Counts come from notifStore (read/snooze/DND/quiet
// hours already applied). No timers, no per-frame allocation. With motion off
// the moons are drawn static at their current angle.
import type { Scene } from "./mapLayout";
import { getPulseStart } from "./badgeStore";
import { getShown } from "./notifStore";
import { totalOf } from "./notifLogic";
import { badgeText, moonPositionsInto, unreadText, BUBBLE_ABOVE, MOON_MAX } from "./moons";
import { getMotion } from "./motionStore";

const TAU = Math.PI * 2;
const BUBBLE_R = 9, PULSE_MS = 800, ORBIT_K = 1.5, FLAT = 0.42;
const FONT_BUBBLE = "700 10px Inter, Avenir, Helvetica, Arial, sans-serif";
const FONT_TIP = "600 11px Inter, Avenir, Helvetica, Arial, sans-serif";
const SCRATCH = Array.from({ length: MOON_MAX }, () => ({ x: 0, y: 0 }));
let animAt = 0, halo: HTMLCanvasElement | null = null;

/** StarMap calls this for every animated frame (dt > 0); pulses draw only then. */
export const noteFrame = (dtMs: number) => { if (dtMs > 0) animAt = performance.now(); };

function makeHalo(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const h = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  h.addColorStop(0, "hsla(42 95% 65% / 0.9)");
  h.addColorStop(1, "hsla(42 95% 60% / 0)");
  g.fillStyle = h;
  g.fillRect(0, 0, 128, 128);
  return c;
}
/** Extra glow around the sun that grows with the shown unread total (clamped at 40). */
export function drawSunGlow(ctx: CanvasRenderingContext2D, s: Scene) {
  if (!getMotion().notifMoons) return;
  const f = Math.min(totalOf(getShown()), 40) / 40;
  if (f === 0) return;
  const n = s.slots.length, d = 2 * s.rad[n] * (1.9 + 1.6 * f);
  ctx.globalAlpha = 0.2 + 0.6 * f;
  ctx.drawImage((halo ??= makeHalo()), s.sx[n] - d / 2, s.sy[n] - d / 2, d, d);
  ctx.globalAlpha = 1;
}

/** One planet's moons: `back` = the half behind the body, else the half in front. */
export function drawMoons(ctx: CanvasRenderingContext2D, s: Scene, i: number, back: boolean) {
  if (!getMotion().notifMoons) return;
  const id = s.slots[i].id, c = getShown()[id];
  if (!(c > 0)) return;
  const r = s.rad[i], n = moonPositionsInto(SCRATCH, c, r * ORBIT_K, s.orbitT, id), mr = Math.max(2.5, r * 0.11);
  ctx.fillStyle = "#cfd8ff";
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    if ((SCRATCH[k].y >= 0) === back) continue;
    const x = s.sx[i] + SCRATCH[k].x, y = s.sy[i] + SCRATCH[k].y * FLAT;
    ctx.moveTo(x + mr, y);
    ctx.arc(x, y, mr, 0, TAU);
  }
  ctx.fill();
}

/** Pulse ring, number bubble and hover text, drawn above every body. */
export function drawBadges(ctx: CanvasRenderingContext2D, s: Scene) {
  if (!getMotion().notifMoons) return;
  const b = getShown(), now = performance.now(), live = now - animAt < 150;
  ctx.textAlign = "center";
  for (let i = 0; i < s.slots.length; i++) {
    const id = s.slots[i].id, c = b[id];
    if (!(c > 0)) continue;
    const x = s.sx[i], y = s.sy[i], r = s.rad[i], age = now - getPulseStart(id);
    if (live && age >= 0 && age < PULSE_MS && getPulseStart(id) > 0) {
      const u = age / PULSE_MS;
      ctx.globalAlpha = 0.8 * (1 - u);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffd479";
      ctx.beginPath();
      ctx.arc(x, y, r * (1.1 + 0.6 * u), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (c > BUBBLE_ABOVE) {
      const bx = x + r * 0.75, by = y - r * 0.75;
      ctx.fillStyle = "#e5484d";
      ctx.beginPath();
      ctx.arc(bx, by, BUBBLE_R, 0, TAU);
      ctx.fill();
      ctx.font = FONT_BUBBLE;
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(badgeText(c), bx, by + 0.5);
    }
  }
  const h = s.hover;
  if (h >= 0 && b[s.slots[h].id] > 0) {
    ctx.font = FONT_TIP;
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#ffd479";
    ctx.fillText(unreadText(b[s.slots[h].id]), s.sx[h], s.sy[h] - s.rad[h] - 6);
  }
}
