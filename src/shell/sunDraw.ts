// The glowing core: a cached corona (additive) and a cached granulated disc
// with limb darkening, rebuilt only when its device-pixel size changes. The
// corona breathes slightly with the star clock (animated frames only).
import { rng } from "./bodyKind";

type SunSprites = { key: string; glow: HTMLCanvasElement; disc: HTMLCanvasElement; dpr: number; rq: number };
const TAU = Math.PI * 2;
const mk = (px: number) => { const c = document.createElement("canvas"); c.width = c.height = px; return c; };

function build(rq: number, dpr: number, key: string): SunSprites {
  const rd = rq * dpr, gp = 2 * Math.ceil(rd * 3.4), gm = gp / 2, glow = mk(gp), gg = glow.getContext("2d")!;
  const h = gg.createRadialGradient(gm, gm, rd * 0.8, gm, gm, gm);
  h.addColorStop(0, "rgba(255,190,80,0.75)");
  h.addColorStop(0.25, "rgba(255,150,40,0.32)");
  h.addColorStop(0.6, "rgba(255,110,30,0.08)");
  h.addColorStop(1, "rgba(255,100,20,0)");
  gg.fillStyle = h;
  gg.fillRect(0, 0, gp, gp);
  const dp = 2 * Math.ceil(rd) + 2, dm = dp / 2, disc = mk(dp), g = disc.getContext("2d")!, rand = rng(7);
  const body = g.createRadialGradient(dm, dm, 0, dm, dm, rd);
  body.addColorStop(0, "#fffbe8");
  body.addColorStop(0.55, "#ffd66b");
  body.addColorStop(0.9, "#ff9a2e");
  body.addColorStop(1, "#d9591a");
  g.fillStyle = body;
  g.beginPath();
  g.arc(dm, dm, rd, 0, TAU);
  g.fill();
  g.save();
  g.clip();
  for (let i = 0; i < 26; i++) { // granules and a few spots
    const a = rand() * TAU, d = Math.sqrt(rand()) * rd * 0.9, r = rd * (0.05 + rand() * 0.12);
    g.fillStyle = rand() < 0.3 ? "rgba(150,50,0,0.18)" : "rgba(255,255,220,0.16)";
    g.beginPath();
    g.arc(dm + Math.cos(a) * d, dm + Math.sin(a) * d, r, 0, TAU);
    g.fill();
  }
  g.restore();
  return { key, glow, disc, dpr, rq };
}

let cache: SunSprites | null = null;
/** Draw the sun centred at (x, y) with CSS radius r. `t` = star clock seconds (0 = static). */
export function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dpr: number, t: number, hover: boolean) {
  const rq = Math.round(r * 2) / 2, key = `${rq}|${dpr}`;
  if (!cache || cache.key !== key) cache = build(rq, dpr, key);
  const k = r / cache.rq, pulse = 1 + 0.025 * Math.sin(t * 1.3), gw = (cache.glow.width / dpr) * k * pulse, dw = (cache.disc.width / dpr) * k;
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(cache.glow, x - gw / 2, y - gw / 2, gw, gw);
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(cache.disc, x - dw / 2, y - dw / 2, dw, dw);
  if (hover) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, TAU);
    ctx.stroke();
  }
}
