// Pure canvas drawing for one planet; no React state.
import { hashId, type PlanetPos } from "./planets";

export function drawPlanet(ctx: CanvasRenderingContext2D, p: PlanetPos, name: string, hover: boolean) {
  const hue = hashId(p.id) % 360;
  const g = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.1, p.x, p.y, p.r);
  g.addColorStop(0, `hsl(${hue} 70% 72%)`);
  g.addColorStop(1, `hsl(${hue} 55% 22%)`);
  if (hover) {
    ctx.shadowColor = `hsl(${hue} 90% 70%)`;
    ctx.shadowBlur = p.r * 0.8;
  }
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  if (hover) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.stroke();
  }
  ctx.font = `${hover ? 600 : 400} 13px Inter, Avenir, Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = hover ? "#ffffff" : "#aab3cf";
  ctx.fillText(name, p.x, p.y + p.r + 6);
}

// Deterministic starfield (seeded LCG) so redraws don't flicker.
export function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number) {
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  ctx.fillStyle = "rgba(220,230,255,0.7)";
  for (let i = 0; i < Math.floor((w * h) / 4000); i++) {
    ctx.fillRect(rnd() * w, rnd() * h, rnd() < 0.1 ? 2 : 1, 1);
  }
}
