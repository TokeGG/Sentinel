// Pure merged "New" feed: YouTube uploads + Twitch live follows + podcast episodes, newest first.
export interface NewItem { key: string; kind: "youtube" | "live" | "podcast"; title: string; by: string; at: number; url: string }

const ms = (v: unknown) => { const t = Date.parse(String(v ?? "")); return Number.isFinite(t) ? t : 0; };
const https = (v: unknown) => (typeof v === "string" && /^https:\/\//i.test(v) ? v : "");

export function mergeNew(
  yt: { video_id: unknown; title: unknown; published_at: unknown; channel_title?: unknown }[],
  live: { login: string; name: string; title: string; startedAt: string }[],
  pods: { id: unknown; title: unknown; published_at: unknown; audio_url: unknown; label?: unknown }[],
  limit = 60,
): NewItem[] {
  const out: NewItem[] = [
    ...yt.filter((v) => /^[\w-]{11}$/.test(String(v.video_id))).map((v) => ({
      key: `yt:${v.video_id}`, kind: "youtube" as const, title: String(v.title ?? ""), by: String(v.channel_title ?? ""), at: ms(v.published_at), url: `https://www.youtube.com/watch?v=${v.video_id}`,
    })),
    ...live.filter((s) => /^\w{1,25}$/.test(s.login)).map((s) => ({
      key: `tw:${s.login}`, kind: "live" as const, title: s.title, by: s.name, at: ms(s.startedAt), url: `https://www.twitch.tv/${s.login}`,
    })),
    ...pods.filter((p) => https(p.audio_url)).map((p) => ({
      key: `pod:${p.id}`, kind: "podcast" as const, title: String(p.title ?? ""), by: String(p.label ?? ""), at: ms(p.published_at), url: https(p.audio_url),
    })),
  ];
  return out.sort((a, b) => b.at - a.at).slice(0, limit);
}
