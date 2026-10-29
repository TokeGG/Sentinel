// Module glyphs: SVG path data on a 24x24 grid, stroked in white on planets.
// Keys are module short names (manifest `icon`) plus shell/future glyphs.
export const ICONS: Record<string, string> = {
  notes: "M6 3h9l3 3v15H6z M9 10h6 M9 14h6 M9 18h3",
  news: "M4 5h13v14H6a2 2 0 0 1-2-2z M17 9h3v8a2 2 0 0 1-2 2 M7 9h7 M7 13h7 M7 16h4",
  pccare: "M3 4h18v12H3z M8 20h8 M12 16v4 M8 10l3 3 5-5",
  weather: "M16 19H7a4 4 0 1 1 .9-7.9A5 5 0 0 1 17.6 13a3 3 0 0 1-1.6 6z M15 3v2 M20 5l-1.4 1.4 M22 10h-2",
  homenet: "M3 11l9-8 9 8 M5 9.5V21h14V9.5 M10 21v-6h4v6",
  github: "M6 3v12 M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9a9 9 0 0 1-9 9",
  youtube: "M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z M10 9v6l5-3z",
  finance: "M3 3v18h18 M7 15l4-4 3 3 6-6 M16 8h4v4",
  deals: "M3 12V3h9l9 9-9 9z M8 8h.01",
  email: "M3 5h18v14H3z M3 6l9 7 9-7",
  social: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21a7 7 0 0 1 14 0 M16 3.5a4 4 0 0 1 0 7 M19 14.5a6 6 0 0 1 3 6.5",
  calendar: "M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4 M8 14h2 M14 14h2 M8 17h2",
  backup: "M3 12a9 9 0 1 0 3-6.7 M3 3v5h5 M12 7v5l3 3",
  pentest: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M12 8v8 M8 12h8",
  clipboard: "M8 4H6v17h12V4h-2 M9 2h6v4H9z M9 11h6 M9 15h6 M9 18h3",
  filesearch: "M13 3H5v18h6 M13 3l5 5v2 M16 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M18.5 19l2.5 2.5",
  core: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4",
  discord: "M7 7a13 13 0 0 1 10 0l2.5 9.5L16 19l-1.5-2.5h-5L8 19l-3.5-2.5z M9.5 12h.01 M14.5 12h.01",
  chat: "M4 5h16v11H9l-5 4z M8 10h8 M8 13h5",
  x: "M4 4l16 16 M20 4L4 20",
  facebook: "M14 21v-8h3l.5-4H14V7c0-1 .5-2 2-2h1.5V2H15a4 4 0 0 0-4 4v3H8v4h3v8",
  instagram: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M17.5 6.5h.01",
  bot: "M5 8h14v11H5z M12 8V4 M10 4h4 M9 12v2 M15 12v2 M2 12v4 M22 12v4",
};

const NUM = "[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?";
const TOKENS = new RegExp(`^(?:[MmLlHhVvCcSsQqTtAaZz]|${NUM}|[\\s,]+)+$`);
const START = new RegExp(`^[Mm][\\s,]*${NUM}`);

/** Tolerant SVG path check: starts with a moveto + number, then only path
 *  commands, numbers and separators. Not a full grammar (arg counts unchecked). */
export function isPathData(s: string): boolean {
  return typeof s === "string" && START.test(s) && TOKENS.test(s);
}

const has = (k: string) => Object.prototype.hasOwnProperty.call(ICONS, k);
const paths = new Map<string, Path2D>(); // built once per key, reused every frame

/** Strokes glyph `key` centered on (x, y), `size` px square; unknown key draws nothing. */
export function drawIcon(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, size: number, color: string) {
  if (!has(key)) return;
  let p = paths.get(key);
  if (!p) paths.set(key, (p = new Path2D(ICONS[key])));
  const k = size / 24;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(k, k);
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.stroke(p);
  ctx.restore();
}

export const iconKnown = has;
