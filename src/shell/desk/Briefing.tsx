// Daily briefing panel (hub.briefing): weather, today's calendar, unread counts,
// liked deals, finance moves. Pulls each module's load() and badge(); titles and
// counts only. Modules are picked by id; a missing module just drops its part.
import { useEffect, useState } from "react";
import { registry, type ModuleManifest } from "../../core/module";
import { EmptyState, ErrorLine } from "../../ui/kit";
import { errorText } from "../../ui/moduleRun";
import { greeting, likedRows, movers, section, speechScript, todayRows, type Section } from "./briefingLogic";
import { getSetting } from "../../ui/appSetting";
import { loadUiDefaults } from "./useUiDefaults";
import "./desk.css";

type Rows = Record<string, unknown>[];
const mod = (id: string) => registry.find((m) => m.id === id);
const rows = async (m?: ModuleManifest): Promise<Rows> => (m?.load ? m.load().catch(() => []) : []);

async function build(now: Date): Promise<{ parts: Section[]; unread: [string, number][] }> {
  const weather = mod("hub.weather"), cal = mod("hub.calendar"), deals = mod("hub.deals"), fin = mod("hub.finance");
  const [w, c, d, f] = await Promise.all([rows(weather), rows(cal), rows(deals), rows(fin)]);
  const parts: Section[] = [];
  const n = (await loadUiDefaults()).briefingRows;
  if (weather) parts.push(section(weather.id, weather.name, w, Math.min(3, n)));
  if (cal) parts.push(section(cal.id, "Today", todayRows(c, now), n));
  if (deals) parts.push(section(deals.id, "Liked deals", likedRows(d), n));
  if (fin) { const lines = movers(f); parts.push({ id: fin.id, name: "Finance moves", lines, count: lines.length }); }
  const unread = await Promise.all(registry.filter((m) => m.badge).map(async (m) => [m.name, await m.badge!().catch(() => 0)] as [string, number]));
  return { parts, unread: unread.filter(([, n]) => n > 0) };
}

async function speak(text: string) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const rate = Number(await getSetting("brief_voice_rate").catch(() => null));
  if (rate >= 0.5 && rate <= 2) u.rate = rate;
  const name = await getSetting("brief_voice").catch(() => null);
  const v = speechSynthesis.getVoices().find((x) => x.name === name);
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

export function Briefing() {
  const [data, setData] = useState<Awaited<ReturnType<typeof build>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  useEffect(() => { build(new Date()).then(setData).catch((e) => setError(errorText(e))); }, []);
  return (
    <div className="brf">
      {error && <ErrorLine message={error} onDismiss={() => setError(null)} />}
      <h2>{greeting(now)}</h2>
      {data && "speechSynthesis" in window && <button className="mh-btn" onClick={() => speak(speechScript(greeting(now), data.unread, data.parts))}>Read aloud</button>}
      <p className="ui-meta">{now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
      {!data ? <EmptyState title="Gathering your day..." /> : (
        <>
          <h3>Unread</h3>
          {data.unread.length === 0 ? <p className="ui-meta">All caught up.</p> : (
            <ul>{data.unread.map(([n, c]) => <li key={n}>{n}<span className="brf-count">{c}</span></li>)}</ul>
          )}
          {data.parts.map((p) => (
            <section key={p.id + p.name}>
              <h3>{p.name}{p.count > p.lines.length && <span className="brf-count">{p.count}</span>}</h3>
              {p.lines.length === 0 ? <p className="ui-meta">Nothing here.</p> : <ul>{p.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
