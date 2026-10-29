// Pure: turn whatever the user pasted into a channel id (or a page to fetch it
// from), and pull the id/title back out of a fetched YouTube page.

export type ChannelInput = { id?: string; pageUrl?: string; handle?: string };
export type ChannelInfo = { channelId: string; title: string | null };

const UC = /^UC[\w-]{22}$/;
const VIDEO = /^[\w-]{11}$/;
const HOSTS = /^(?:www\.|m\.|music\.)?youtube\.com$/i;

export const feedUrl = (id: string) => `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;
const watch = (v: string) => ({ pageUrl: `https://www.youtube.com/watch?v=${v}` });

export function parseChannelInput(raw: string): ChannelInput | null {
  const s = raw.trim();
  if (UC.test(s)) return { id: s };
  if (/^@[\w.-]+$/.test(s)) return { pageUrl: `https://www.youtube.com/${s}`, handle: s };
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const parts = u.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (u.hostname.toLowerCase() === "youtu.be") return VIDEO.test(parts[0] ?? "") ? watch(parts[0]) : null;
  if (!HOSTS.test(u.hostname)) return null;
  const [a, b] = parts;
  if (a === "channel" && UC.test(b ?? "")) return { id: b };
  if (a?.startsWith("@")) return { pageUrl: `https://www.youtube.com/${a}`, handle: a };
  if ((a === "c" || a === "user") && b) return { pageUrl: `https://www.youtube.com/${a}/${encodeURIComponent(b)}` };
  if (a === "watch") return VIDEO.test(u.searchParams.get("v") ?? "") ? watch(u.searchParams.get("v")!) : null;
  if ((a === "shorts" || a === "live" || a === "embed") && VIDEO.test(b ?? "")) return watch(b);
  return null;
}

const ID_PATTERNS = [
  /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']*\/channel\/(UC[\w-]{22})/i,
  /itemprop=["']channelId["'][^>]+content=["'](UC[\w-]{22})/i,
  /content=["'](UC[\w-]{22})["'][^>]+itemprop=["']channelId["']/i,
  /"externalId":"(UC[\w-]{22})"/,
  /"channelId":"(UC[\w-]{22})"/,
];

const unescape = (t: string) =>
  t.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export function extractChannel(html: string): ChannelInfo | null {
  for (const re of ID_PATTERNS) {
    const id = re.exec(html)?.[1];
    if (!id) continue;
    const t =
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1] ??
      /<title>([^<]*?)(?:\s+-\s+YouTube)?<\/title>/i.exec(html)?.[1];
    return { channelId: id, title: t?.trim() ? unescape(t.trim()) : null };
  }
  return null;
}
