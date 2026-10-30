// Pure helpers for the Media panel.
export const mediaSections = [
  { id: "new", label: "New (uploads, live, podcasts)" },
  { id: "party", label: "Watch party countdown" },
  { id: "schedule", label: "Streamer schedule", default: false },
  { id: "nowplaying", label: "Now playing" },
  { id: "twitch", label: "Twitch live" },
  { id: "shows", label: "Show tracker" },
  { id: "images", label: "Image folder" },
  { id: "sports", label: "Sports scores" },
];

const IMG = /\.(png|jpe?g|gif|webp|bmp|avif)$/i;
export const isImage = (name: string): boolean => IMG.test(name);

/** Image names in the folder, newest first, one page of `size`. */
export function imagePage(files: { name: string; modified: number }[], page: number, size = 24): { names: string[]; pages: number } {
  const imgs = files.filter((f) => isImage(f.name)).sort((a, b) => b.modified - a.modified || a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(imgs.length / size));
  const p = Math.min(Math.max(0, page), pages - 1);
  return { names: imgs.slice(p * size, p * size + size).map((f) => f.name), pages };
}

export const joinPath = (dir: string, name: string): string => (/[\\/]$/.test(dir) ? dir + name : `${dir}${dir.includes("\\") ? "\\" : "/"}${name}`);

/** "today" / "in 3 days" / "aired" / "no date" for a YYYY-MM-DD next episode. */
export function airsIn(day: string | null, today: string): string {
  if (!day) return "no date";
  const d = Math.round((Date.parse(day) - Date.parse(today)) / 86400000);
  return d < 0 ? "aired" : d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
}

export const uptime = (startedAt: string, now = Date.now()): string => {
  const m = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 60000));
  return Number.isNaN(m) ? "" : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
