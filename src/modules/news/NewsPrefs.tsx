// News settings that are lists, not single values: blocked sources, keyword alerts, spoiler words,
// per-source auto-refresh intervals (font size / width / headline-only are customize options).
import { useEffect, useState } from "react";
import { getSetting, setSetting } from "../../ui/appSetting";
import { SpoilerWords, WordListInput } from "../../ui/wordList";
import type { useWordList } from "../../ui/wordList";
import { INTERVAL_KEY, readNumMap } from "./newsPrefsLogic";
import { alertCount, markAlertsSeen } from "./prefsStore";
import { listNewsSources } from "./sourceStore";

type WL = ReturnType<typeof useWordList>;

function Intervals() {
  const [srcs, setSrcs] = useState<{ url: string; label: string | null }[]>([]);
  const [map, setMap] = useState<Record<string, number>>({});
  useEffect(() => {
    listNewsSources().then((r) => setSrcs(r.filter((s) => s.enabled))).catch(() => {});
    getSetting(INTERVAL_KEY).then((v) => setMap(readNumMap(v))).catch(() => {});
  }, []);
  const set = (url: string, n: number) => {
    const next = { ...map, [url]: Math.max(0, Math.min(1440, Math.round(n) || 0)) };
    setMap(next);
    void setSetting(INTERVAL_KEY, JSON.stringify(next)).catch(() => {});
  };
  return (
    <div>
      <p className="ui-meta">Per-source interval (minutes, 0 = every run). Applies only while Auto-refresh is on; Fetch now always checks all.</p>
      {srcs.map((s) => (
        <label key={s.url} className="nw-srcmeta">
          <span>{s.label || s.url}</span>
          <input type="number" min={0} max={1440} value={map[s.url] ?? 0} aria-label={`Refresh interval for ${s.label || s.url}`} onChange={(e) => set(s.url, Number(e.target.value))} />
        </label>
      ))}
    </div>
  );
}

export function NewsPrefs({ blocked, alerts, spoil }: { blocked: WL; alerts: WL; spoil: WL }) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => { alertCount().then(setN).catch(() => {}); }, [alerts.words]);
  return (
    <details className="nw-prefs">
      <summary className="ui-meta">Block list, alerts, spoilers, refresh intervals{n ? ` · ${n} alert${n === 1 ? "" : "s"}` : ""}</summary>
      <WordListInput label="Blocked sources (hosts):" words={blocked.words} save={blocked.save} placeholder="example.com, kotaku.com" />
      <WordListInput label="Keyword alerts (counted on the News moon):" words={alerts.words} save={alerts.save} placeholder="cs2, patch notes" />
      {n ? <button type="button" className="ui-btn ui-sm" onClick={() => void markAlertsSeen().then(() => setN(0))}>Mark {n} alert{n === 1 ? "" : "s"} seen</button> : null}
      <SpoilerWords words={spoil.words} save={spoil.save} />
      <details><summary className="ui-meta">Refresh intervals</summary><Intervals /></details>
    </details>
  );
}
