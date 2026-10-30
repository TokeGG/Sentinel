// Pure YouTube playback prefs: Shorts detection, saved clips (timestamps), per-channel intro/outro skip,
// start position, outro check, IFrame API messages for volume/seek/pause.
export const CLIPS_KEY = "yt_clips";
export const SKIP_KEY = "yt_skip";

/** Feeds carry no duration, so a Short is recognised by #shorts in the title or a /shorts/ link. */
export const isShort = (title: string, link = "") => /#shorts?\b/i.test(title) || /\/shorts\//i.test(link);

export interface Clip { videoId: string; t: number; label: string; at: number }
export const isClip = (x: unknown): x is Clip => {
  const c = x as Clip;
  return !!c && typeof c.videoId === "string" && Number.isFinite(c.t) && typeof c.label === "string" && Number.isFinite(c.at);
};
/** Adds a bookmark (same video + second replaced), capped at 500 overall. */
export function addClip(all: Clip[], c: Clip): Clip[] {
  const t = Math.max(0, Math.floor(c.t));
  return [...all.filter((x) => !(x.videoId === c.videoId && x.t === t)), { ...c, t, label: c.label.trim().slice(0, 80) }].slice(-500);
}
export const clipsFor = (all: Clip[], videoId: string) => all.filter((c) => c.videoId === videoId).sort((a, b) => a.t - b.t);
export const removeClip = (all: Clip[], videoId: string, t: number) => all.filter((c) => !(c.videoId === videoId && c.t === t));

/** 75 -> "1:15", 3725 -> "1:02:05". */
export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const p = (n: number) => String(n).padStart(2, "0");
  return s >= 3600 ? `${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}` : `${Math.floor(s / 60)}:${p(s % 60)}`;
}

export interface Skip { intro: number; outro: number }
export function readSkip(raw: unknown): Record<string, Skip> {
  const out: Record<string, Skip> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw))
    for (const [k, v] of Object.entries(raw as Record<string, Skip>))
      if (v && Number.isFinite(v.intro) && Number.isFinite(v.outro)) out[k] = { intro: clampSec(v.intro), outro: clampSec(v.outro) };
  return out;
}
export const clampSec = (n: number) => Math.max(0, Math.min(600, Math.round(n) || 0));

/** Resume point wins when it is past the intro. */
export const startAt = (resume: number, intro: number) => Math.max(resume, intro);
/** True once playback is inside the outro to skip (needs a known duration). */
export const inOutro = (time: number, duration: number, outro: number) => outro > 0 && duration > outro && time >= duration - outro;

const cmd = (func: string, args: unknown[] = []) => JSON.stringify({ event: "command", func, args });
export const volumeMsg = (v: number) => cmd("setVolume", [Math.max(0, Math.min(100, Math.round(v)))]);
export const seekMsg = (t: number) => cmd("seekTo", [Math.max(0, t), true]);
export const pauseMsg = () => cmd("pauseVideo");
