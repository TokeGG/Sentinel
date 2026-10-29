// Notification moons, number bubble, pulse ring, "N unread" hover text and the
// sun's badge glow. Called from drawScene inside the map's single capped frame:
// no timers, no per-frame allocation (reused scratch, cached strings, constant
// styles). With motion off the moons are drawn static at their current angle.
import type { Scene } from "./mapLayout";
import { getBadges, getPulseStart } from "./badgeStore";
import { totalBadges } from "./badges";
import { badgeText, moonPositionsInto, unreadText, BUBBLE_ABOVE, MOON_MAX } from "./moons";
import { getMotion } from "./motionStore";

const TAU = Math.PI * 2;
const MOON_R = 3.5, BUBBLE_R = 9, PULSE_MS = 800, ORBIT_K = 1.45;
const FONT_BUBBLE = "700 10px Inter, Avenir, Helvetica, Arial, sans-serif";
const FONT_TIP = "600 11px Inter, Avenir, Helvetica, Arial, sans-serif";
const SCRATCH = Array.from({ length: MOON_MAX }, () => ({ x: 0, y: 0 }));
let animAt = 0, halo: HTMLCanvasElement | null = null;

/** StarMap calls this for every animated frame (dt > 0); pulses draw only then. */
export const noteFrame = (dtMs: number) => { if (dtMs > 0) animAt = performance.now(); };

// Sun glow: one cached 128px halo, scaled/faded by total unread (clamped at 40).
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
export function drawSunGlow(ctx: CanvasRenderingContext2D, s: Scene) {
  if (!getMotion().notifMoons) return;
  const f = Math.min(totalBadges(getBadges()), 40) / 40;
  if (f === 0) return;
  const d = 2 * s.sunR * (1.9 + 1.6 * f);
  ctx.globalAlpha = 0.2 + 0.6 * f;
  ctx.drawImage((halo ??= makeHalo()), s.sunX - d / 2, s.sunY - d / 2, d, d);
  ctx.globalAlpha = 1;
}

export function drawMoons(ctx: CanvasRenderingContext2D, s: Scene) {
  if (!getMotion().notifMoons) return;
  const b = getBadges(), now = performance.now(), live = now - animAt < 150;
  ctx.textAlign = "center";
  for (let i = 0; i < s.slots.length; i++) {
    const id = s.slots[i].id, c = b[id];
    if (!(c > 0)) continue;
    const x = s.sx[i], y = s.sy[i], n = moonPositionsInto(SCRATCH, c, s.r * ORBIT_K, s.orbitT, id);
    ctx.fillStyle = "#cfd8ff";
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      ctx.moveTo(x + SCRATCH[k].x + MOON_R, y + SCRATCH[k].y);
      ctx.arc(x + SCRATCH[k].x, y + SCRATCH[k].y, MOON_R, 0, TAU);
    }
    ctx.fill();
    const age = now - getPulseStart(id);
    if (live && age >= 0 && age < PULSE_MS && getPulseStart(id) > 0) {
      const u = age / PULSE_MS;
      ctx.globalAlpha = 0.8 * (1 - u);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffd479";
      ctx.beginPath();
      ctx.arc(x, y, s.r * (1.1 + 0.6 * u), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (c > BUBBLE_ABOVE) {
      const bx = x + s.r * 0.75, by = y - s.r * 0.75;
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
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffd479";
    ctx.fillText(unreadText(b[s.slots[h].id]), s.sx[h], s.sy[h] + s.r + 21);
  }
}
