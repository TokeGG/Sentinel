// Terminal home style (Settings > Desktop > Home screen): fills the whole main window under the title bar.
// Panels open on top at any size; Ctrl+Space / `home` hides them all and brings them back.
// Boxes, their order, prompt text, aliases and clocks come from Settings > Terminal (`term_prefs`).
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { registry } from "../../core/module";
import { rowTitle } from "../../core/search/rowHits";
import { getBadges, subscribeBadges } from "../badgeStore";
import { openSettings } from "../panelApi";
import { todayRows } from "./briefingLogic";
import { openById } from "./layoutOps";
import { sendCmd } from "./shellCmd";
import { countBoxes, expandAlias, HELP_LINES, parseCommand } from "./terminalLogic";
import { clockLines, type TermBox } from "./termPrefs";
import { TermPrompt } from "./TermPrompt";
import { useTermPrefs } from "./useTermPrefs";
import { useUiDefaults } from "./useUiDefaults";
import { listLater } from "../../core/later";
import type { LaterItem } from "../../core/laterLogic";
import { openLink } from "../../ui/openLink";
import { runSmartTerminal } from "./collectionsStore";
import { searchClipboard } from "../../modules/clipboard/search";
import { getOverlayStats } from "../../modules/pccare/sysOps";
import { overlayLines } from "../../modules/pccare/alerts";
import { WidgetGrid } from "./WidgetGrid";
import { ModWidget } from "./ModWidget";
import { useWidgets } from "./useWidgets";
import { TERM_BOXES } from "./termPrefs";
import "./terminal.css";

const BOX_TITLE: Record<TermBox, string> = { today: "Today", feed: "Feed", counts: "Unread counts", clocks: "Clocks", timers: "Timers", later: "Read later", apps: "Apps" };
type Rows = Record<string, unknown>[];
type Timer = { label: string; end: number };
const rows = async (id: string): Promise<Rows> => registry.find((m) => m.id === id)?.load?.().catch(() => []) ?? [];
const titles = (r: Rows, n: number) => r.map(rowTitle).filter(Boolean).slice(0, n);
const skill = (name: string) => registry.flatMap((m) => m.skills.filter((s) => s.name === name))[0];
const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export function TerminalHome({ onError }: { onError: (m: string) => void }) {
  const prefs = useTermPrefs();
  const ui = useUiDefaults();
  const badges = useSyncExternalStore(subscribeBadges, getBadges);
  const [today, setToday] = useState<string[]>([]);
  const [feed, setFeed] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>(["type help for commands · Tab completes · Up/Down for history"]);
  const [later, setLater] = useState<LaterItem[]>([]);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [now, setNow] = useState(Date.now());
  const mods = registry.map((m) => ({ id: m.id, name: m.name }));
  const [widgets, setWidgets] = useWidgets(prefs.order.filter((b) => !prefs.hidden.includes(b)));
  const say = (s: string[]) => setLog((l) => [...l, ...s].slice(-ui.terminalLog));
  useEffect(() => {
    rows("hub.calendar").then((r) => setToday(titles(todayRows(r, new Date()), ui.terminalRows))).catch(() => {});
    rows("hub.news").then((r) => setFeed(titles(r, ui.terminalRows))).catch(() => {});
    listLater(ui.terminalLater).then(setLater).catch(() => {});
  }, [ui.terminalRows, ui.terminalLater]);
  useEffect(() => { // tick only while a timer runs, or once a minute for the clocks
    const t = setInterval(() => setNow(Date.now()), timers.length ? 1000 : 60_000);
    return () => clearInterval(t);
  }, [timers.length]);
  useEffect(() => {
    const done = timers.filter((t) => t.end <= now);
    if (!done.length) return;
    say(done.map((t) => `timer done: ${t.label}`));
    setTimers((ts) => ts.filter((t) => t.end > now));
  }, [now]);
  const run = (raw: string) => {
    const text = expandAlias(raw, prefs.aliases);
    const c = parseCommand(text, mods);
    const fail = (e: unknown) => { onError(String(e)); say([`error: ${String(e)}`]); };
    const echo = (s: string[]) => say([`$ ${raw}`, ...s]);
    switch (c.kind) {
      case "open": echo([`opening ${c.id}`]); return void openById(c.id).catch(fail);
      case "home": echo(["toggling panels"]); return void sendCmd({ type: "home" }).catch(fail);
      case "palette": echo(["opening search"]); return void sendCmd({ type: "palette" }).catch(fail);
      case "settings": echo(["opening settings"]); return void openSettings().catch(fail);
      case "clip": if (!c.q) { echo(["opening clipboard"]); return void openById("hub.clipboard").catch(fail); }
        return void searchClipboard(c.q, 8).then((r) => echo(r.length ? r.map((x) => `- ${x.content.slice(0, 100)}`) : ["no matches"])).catch(fail);
      case "stats": return void getOverlayStats().then((s) => echo(overlayLines(s))).catch(fail);
      case "note": { const s = skill("capture_note"); echo([s ? "note saved" : "no notes module"]); return void s?.run({ body: c.text }).catch(fail); }
      case "todo": { const s = skill("add_item"); echo([s ? "task added for today" : "no calendar module"]); return void s?.run({ kind: "task", title: c.text }).catch(fail); }
      case "timer": echo([`timer ${c.label} started`]); return setTimers((t) => [...t, { label: c.label, end: Date.now() + c.minutes * 60_000 }]);
      case "help": return echo(HELP_LINES);
      case "clear": return setLog([]);
      default: if (c.text) void runSmartTerminal(c.text).then((ok) => echo([ok ? `running ${c.text}` : `unknown: ${c.text} (try help)`])).catch(fail);
    }
  };
  const box: Record<TermBox, ReactNode> = {
    today: <div key="today" className="term-box term-tall"><h3>TODAY</h3>{today.length ? today.map((t, i) => <div key={i}>{t}</div>) : <div className="term-dim">nothing scheduled</div>}</div>,
    feed: <div key="feed" className="term-box term-tall"><h3>FEED</h3>{feed.length ? feed.map((t, i) => <button key={i} className="term-link" onClick={() => run("news")}>{t}</button>) : <div className="term-dim">no stories yet</div>}</div>,
    counts: <div key="counts" className="term-counts">{countBoxes(badges, mods).map((b) => <button key={b.id} className="term-box term-count" onClick={() => run(`open ${b.name}`)}><h3>{b.name.toUpperCase()}</h3><span className="term-n">{b.n}</span></button>)}</div>,
    clocks: <div key="clocks" className="term-box">{clockLines(new Date(now), prefs.clocks, ui.clock).map((l) => <div key={l}>{l}</div>)}</div>,
    timers: <div key="timers" className="term-box">{timers.length ? timers.map((t, i) => <div key={i}>{t.label} <span className="term-n-sm">{mmss(t.end - now)}</span></div>) : <div className="term-dim">type: timer 25</div>}</div>,
    later: <div key="later" className="term-box term-tall"><h3>READ LATER</h3>{later.length ? later.map((l, i) => <button key={i} className="term-link" onClick={() => openLink(l.url).catch((e) => onError(String(e)))}>[{l.kind}] {l.title}</button>) : <div className="term-dim">nothing saved</div>}</div>,
    apps: <div key="apps" className="term-apps">{mods.map((m) => <button key={m.id} className="term-link" onClick={() => run(`open ${m.name}`)}>{m.name.toLowerCase()}</button>)}</div>,
  };
  const total = Object.values(badges).reduce((a, b) => a + b, 0);
  return (
    <div className="term-home">
      <div className="term-dim term-head">{new Date(now).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }).toLowerCase()} · {total} unread</div>
      <div className="term-top"><TermPrompt prompt={prefs.prompt} log={log} mods={mods} aliases={prefs.aliases} onRun={run} /></div>
      <WidgetGrid list={widgets} update={setWidgets} all={[...TERM_BOXES.map((b) => ({ id: b as string, title: BOX_TITLE[b] })), ...mods.map((m) => ({ id: `mod:${m.id}`, title: m.name }))]}
        render={(id) => (id.startsWith("mod:") ? <ModWidget id={id.slice(4)} count={badges[id.slice(4)] ?? 0} rows={ui.terminalRows} onError={onError} /> : box[id as TermBox] ?? <div className="term-dim">nothing here yet</div>)} />
    </div>
  );
}
