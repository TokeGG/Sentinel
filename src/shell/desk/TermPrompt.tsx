// Terminal home prompt: log lines, input with history (Up/Down), Tab completion and aliases.
import { useEffect, useRef, useState } from "react";
import { complete, histStep, type Mod } from "./terminalLogic";

export function TermPrompt({ prompt, log, mods, aliases, onRun }: { prompt: string; log: string[]; mods: Mod[]; aliases: Record<string, string>; onRun(line: string): void }) {
  const [line, setLine] = useState("");
  const hist = useRef<string[]>([]);
  const [idx, setIdx] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [log]);
  const key = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") { e.preventDefault(); setLine(complete(line, mods, aliases)); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const i = histStep(hist.current, idx, e.key === "ArrowUp" ? -1 : 1);
      setIdx(i); setLine(hist.current[i] ?? "");
    }
  };
  return (
    <div className="term-prompt">
      <div className="term-log" ref={logRef}>{log.map((l, i) => <div key={i} className={l.startsWith("$") ? "" : "term-dim"}>{l}</div>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); if (line.trim()) hist.current = [...hist.current, line].slice(-50); setIdx(hist.current.length); onRun(line); setLine(""); }}>
        <label><span className="term-dim">{prompt} </span>
          <input id="term-line" className="term-input" value={line} onChange={(e) => setLine(e.target.value)} onKeyDown={key} aria-label="Command" autoComplete="off" spellCheck={false} /></label>
      </form>
    </div>
  );
}
