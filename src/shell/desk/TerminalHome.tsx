// Terminal home style (Settings > Desktop > Home screen): fills the whole main window under the title bar.
// Panels open on top at any size; Ctrl+Space / `home` hides them all and brings them back.
import { useEffect, useState, useSyncExternalStore } from "react";
import { registry, type ModuleManifest } from "../../core/module";
import { rowTitle } from "../../core/search/rowHits";
import { getBadges, subscribeBadges } from "../badgeStore";
import { openSettings } from "../panelApi";
import { todayRows } from "./briefingLogic";
import { openById } from "./layoutOps";
import { sendCmd } from "./shellCmd";
import { countBoxes, HELP_LINES, parseCommand } from "./terminalLogic";
import "./terminal.css";

type Rows = Record<string, unknown>[];
const rows = async (id: string): Promise<Rows> => registry.find((m) => m.id === id)?.load?.().catch(() => []) ?? [];
const titles = (r: Rows, n: number) => r.map(rowTitle).filter(Boolean).slice(0, n);

export function TerminalHome({ onError }: { onError: (m: string) => void }) {
  const badges = useSyncExternalStore(subscribeBadges, getBadges);
  const [today, setToday] = useState<string[]>([]);
  const [feed, setFeed] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>(["type help for commands"]);
  const [line, setLine] = useState("");
  useEffect(() => {
    rows("hub.calendar").then((r) => setToday(titles(todayRows(r, new Date()), 6))).catch(() => {});
    rows("hub.news").then((r) => setFeed(titles(r, 6))).catch(() => {});
  }, []);
  const mods = registry.map((m: ModuleManifest) => ({ id: m.id, name: m.name }));
  const run = (text: string) => {
    const c = parseCommand(text, mods);
    const say = (s: string[]) => setLog((l) => [...l, `$ ${text}`, ...s].slice(-12));
    const fail = (e: unknown) => onError(String(e));
    if (c.kind === "open") { say([`opening ${c.id}`]); openById(c.id).catch(fail); }
    else if (c.kind === "home") { say(["toggling panels"]); sendCmd({ type: "home" }).catch(fail); }
    else if (c.kind === "palette") { say(["opening search"]); sendCmd({ type: "palette" }).catch(fail); }
    else if (c.kind === "settings") { say(["opening settings"]); openSettings().catch(fail); }
    else if (c.kind === "help") say(HELP_LINES);
    else if (c.kind === "clear") setLog([]);
    else if (c.text) say([`unknown: ${c.text} (try help)`]);
  };
  const boxes = countBoxes(badges, mods);
  const now = new Date();
  return (
    <div className="term-home">
      <div className="term-prompt">
        <div className="term-dim">{now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }).toLowerCase()} · {Object.values(badges).reduce((a, b) => a + b, 0)} unread</div>
        {log.map((l, i) => <div key={i} className={l.startsWith("$") ? "" : "term-dim"}>{l}</div>)}
        <form onSubmit={(e) => { e.preventDefault(); run(line); setLine(""); }}>
          <label><span className="term-dim">sentinel@home ~ $ </span>
            <input id="term-line" className="term-input" value={line} onChange={(e) => setLine(e.target.value)} aria-label="Command" autoComplete="off" spellCheck={false} /></label>
        </form>
      </div>
      <div className="term-box term-tall"><h3>TODAY</h3>{today.length ? today.map((t, i) => <div key={i}>{t}</div>) : <div className="term-dim">nothing scheduled</div>}
        <h3>FEED</h3>{feed.length ? feed.map((t, i) => <button key={i} className="term-link" onClick={() => run("news")}>{t}</button>) : <div className="term-dim">no stories yet</div>}</div>
      {boxes.map((b) => <button key={b.id} className="term-box term-count" onClick={() => run(`open ${b.name}`)}><h3>{b.name.toUpperCase()}</h3><span className="term-n">{b.n}</span></button>)}
      <div className="term-apps">{mods.map((m) => <button key={m.id} className="term-link" onClick={() => openById(m.id).catch((e) => onError(String(e)))}>{m.name.toLowerCase()}</button>)}</div>
    </div>
  );
}
