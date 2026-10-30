// Watch-view extras: clip bookmarks (list / jump / delete), per-channel intro/outro skip, sleep timer,
// default speed / volume / auto-next from the customize options. Stored in app_settings JSON.
import { useEffect, useRef, useState } from "react";
import { arrayOf, useJsonSetting } from "../../ui/useJsonSetting";
import { useOption } from "../../ui/useOption";
import type { PlayerCtl } from "./Player";
import { addClip, clampSec, CLIPS_KEY, clipsFor, fmtTime, isClip, readSkip, removeClip, SKIP_KEY, startAt } from "./ytPrefs";

export function useWatchExtras(videoId: string, channelId: string | null, onSleep: () => void) {
  const defaultSpeed = Number(useOption("defaultSpeed", "1")) || 1;
  const autoNext = useOption("autoNext", true);
  const volume = useOption("volume", 100);
  const sleepDefault = useOption("sleepMinutes", 30);
  const [clips, setClips] = useJsonSetting(CLIPS_KEY, arrayOf(isClip));
  const [skips, setSkips] = useJsonSetting(SKIP_KEY, readSkip);
  const [seek, setSeek] = useState<{ t: number; n: number } | undefined>();
  const [pause, setPause] = useState(0);
  const [sleepAt, setSleepAt] = useState<number | null>(null);
  const [, tick] = useState(0);
  const now = useRef(0);
  const sleepCb = useRef(onSleep);
  sleepCb.current = onSleep;
  useEffect(() => {
    if (!sleepAt) return;
    const t = setInterval(() => { tick((n) => n + 1); if (Date.now() >= sleepAt) { setPause((n) => n + 1); setSleepAt(null); sleepCb.current(); } }, 1000);
    return () => clearInterval(t);
  }, [sleepAt]);
  const skip = (channelId && skips[channelId]) || { intro: 0, outro: 0 };
  const setSkip = (k: "intro" | "outro", v: number) => channelId && setSkips({ ...skips, [channelId]: { ...skip, [k]: clampSec(v) } });
  const ctl: PlayerCtl = { seek, pause, volume, outro: skip.outro, onTime: (t) => { now.current = t; } };
  const mine = clipsFor(clips, videoId);
  const bar = (
    <details className="yt-extras">
      <summary className="ui-meta">Clips ({mine.length}) · skip · sleep{sleepAt ? ` · sleeping in ${fmtTime((sleepAt - Date.now()) / 1000)}` : ""}</summary>
      <div className="ui-controls">
        <button type="button" className="ui-btn ui-sm" onClick={() => setClips(addClip(clips, { videoId, t: now.current, label: `Clip at ${fmtTime(now.current)}`, at: Date.now() }))}>Bookmark {fmtTime(now.current)}</button>
        {channelId && <>
          <label className="ui-meta">Skip intro (s) <input type="number" min={0} max={600} value={skip.intro} onChange={(e) => setSkip("intro", Number(e.target.value))} /></label>
          <label className="ui-meta">Skip outro (s) <input type="number" min={0} max={600} value={skip.outro} onChange={(e) => setSkip("outro", Number(e.target.value))} /></label>
        </>}
        <button type="button" className="ui-btn ui-sm" onClick={() => setSleepAt(sleepAt ? null : Date.now() + sleepDefault * 60000)}>{sleepAt ? "Cancel sleep timer" : `Sleep in ${sleepDefault} min`}</button>
      </div>
      <ul className="yt-clips">
        {mine.map((c) => (
          <li key={c.t}>
            <button type="button" className="ui-link" onClick={() => setSeek({ t: c.t, n: Date.now() })}>{fmtTime(c.t)}</button>{" "}
            <input className="ui-file-text" defaultValue={c.label} aria-label="Clip label" onBlur={(e) => setClips(addClip(clips, { ...c, label: e.target.value }))} />
            <button type="button" className="ui-btn ui-sm" onClick={() => setClips(removeClip(clips, videoId, c.t))}>Delete</button>
          </li>
        ))}
      </ul>
    </details>
  );
  return { rateFor: (chan?: number) => chan || defaultSpeed, autoNext, start: (resume: number) => startAt(resume, skip.intro), ctl, bar };
}
