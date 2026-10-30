// Choose a puzzle: bundled practice, Advent of Code (cookie in keychain, cached, throttled), or paste any puzzle.
import { useEffect, useState } from "react";
import { loadAoc, loadAocInput, refetchAocPage } from "./aoc";
import { PRACTICE } from "./bundled";
import { cachedPuzzles, clearAocCookie, savePuzzle, setAocCookie } from "./coachStore";
import { parsePasted, splitInput, type Puzzle } from "./puzzles";
import { cleanCookie } from "./throttle";
import type { CoachState } from "./useCoach";

export function PuzzlePicker({ c }: { c: CoachState }) {
  const [year, setYear] = useState(String(new Date().getFullYear() - (new Date().getMonth() < 11 ? 1 : 0)));
  const [day, setDay] = useState("1");
  const [cookie, setCookie] = useState("");
  const [paste, setPaste] = useState("");
  const [saved, setSaved] = useState<Puzzle[]>([]);
  useEffect(() => { void cachedPuzzles().then((l) => setSaved(l.filter((p) => p.source !== "ctf")), () => {}); }, [c.puzzle]);
  const p = c.puzzle, dis = !!c.busy;
  return (
    <div className="coach-col">
      <div className="coach-row">
        <select className="ui-file-text" aria-label="Practice puzzle" value="" onChange={(e) => { const x = [...PRACTICE, ...saved].find((q) => q.key === e.target.value); if (x) c.setPuzzle(x); }}>
          <option value="">Practice / saved puzzles...</option>
          {PRACTICE.map((q) => <option key={q.key} value={q.key}>Practice: {q.title}</option>)}
          {saved.filter((q) => !q.key.startsWith("practice:")).map((q) => <option key={q.key} value={q.key}>{q.source}: {q.title.slice(0, 60)}</option>)}
        </select>
      </div>
      <div className="coach-row">
        <span>Advent of Code</span>
        <input className="ui-file-text coach-num" type="number" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year" />
        <input className="ui-file-text coach-num" type="number" min={1} max={25} value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day" />
        <button type="button" className="ui-btn" disabled={dis} onClick={() => void c.task("Loading the puzzle...", async () => c.setPuzzle(await loadAoc(+year, +day)))}>Load</button>
        {p?.source === "aoc" && !p.input && <button type="button" className="ui-btn" disabled={dis} onClick={() => void c.task("Fetching your input...", async () => c.setPuzzle(await loadAocInput(p)))}>Get my input</button>}
        {p?.source === "aoc" && <button type="button" className="ui-btn" disabled={dis} title="After solving part one, part two appears" onClick={() => void c.task("Refreshing...", async () => c.setPuzzle(await refetchAocPage(p)))}>Refresh (part two)</button>}
      </div>
      <div className="coach-row">
        <input className="ui-file-text" type="password" placeholder="AoC session cookie (kept in the OS keychain)" value={cookie} onChange={(e) => setCookie(e.target.value)} />
        <button type="button" className="ui-btn" disabled={dis} onClick={() => void c.task("Saving...", async () => { const v = cleanCookie(cookie); if (!v) throw new Error("That does not look like a session cookie (hex value)."); await setAocCookie(v); setCookie(""); })}>Save cookie</button>
        <button type="button" className="ui-btn" disabled={dis} onClick={() => void c.task("Removing...", clearAocCookie)}>Forget</button>
      </div>
      <textarea className="ui-file-text coach-area" rows={3} placeholder={"Paste a puzzle from any coding site (optional: a line INPUT: then the input)"} value={paste} onChange={(e) => setPaste(e.target.value)} />
      <div className="coach-row"><button type="button" className="ui-btn" disabled={dis} onClick={() => { const x = parsePasted(paste); if (!x) return c.setError("Paste at least a sentence of the problem."); const y = splitInput(x); void savePuzzle(y).catch(() => {}); c.setPuzzle(y); setPaste(""); }}>Use pasted puzzle</button></div>
    </div>
  );
}
