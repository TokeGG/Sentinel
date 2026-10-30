// CTF dailies: a study notebook + tutor. The owner pastes a challenge (and output they gathered); the model explains
// concepts and gives graded hints; a writeup is kept per challenge. No request goes to any CTF platform.
import { useEffect, useState } from "react";
import { askCoach } from "./coachLlm";
import { cachedPuzzles, saveAttempt, saveNotes, savePuzzle } from "./coachStore";
import { COACH_NOTE_HOST } from "./coachSql";
import { conceptMessages, ctfHintMessages, HINT_LEVELS, parseConcepts, writeupTemplate, type Concepts } from "./ctfPrompts";
import { parseHint } from "./recap";
import { parseCtf, type Puzzle } from "./puzzles";
import type { CoachState } from "./useCoach";

export function CtfPane({ c }: { c: CoachState }) {
  const [desc, setDesc] = useState(""), [got, setGot] = useState("");
  const [list, setList] = useState<Puzzle[]>([]), [cur, setCur] = useState<Puzzle | null>(null);
  const [notes, setNotes] = useState(""), [con, setCon] = useState<Concepts | null>(null), [hints, setHints] = useState<string[]>([]);
  const reload = () => void cachedPuzzles().then((l) => setList(l.filter((p) => p.source === "ctf")), () => {});
  useEffect(reload, []);
  const open = (p: Puzzle) => { setCur(p); setNotes(p.notes || writeupTemplate(p.title)); setCon(null); setHints([]); };
  const dis = !!c.busy;
  return (
    <div className="coach-col">
      <span className="bot-dim">Study notebook: the app never contacts CTF sites or runs anything against them.</span>
      <select className="ui-file-text" value={cur?.key ?? ""} onChange={(e) => { const p = list.find((x) => x.key === e.target.value); if (p) open(p); }} aria-label="Saved challenges">
        <option value="">Saved challenges ({list.length})...</option>
        {list.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}
      </select>
      <textarea className="ui-file-text coach-area" rows={3} placeholder="Paste the challenge description" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <textarea className="ui-file-text coach-area" rows={2} placeholder="Optional: output you gathered yourself" value={got} onChange={(e) => setGot(e.target.value)} />
      <div className="coach-row"><button type="button" className="ui-btn" disabled={dis} onClick={() => void c.task("Saving...", async () => {
        const p = parseCtf(desc, got); if (!p) throw new Error("Paste at least a sentence of the challenge.");
        await savePuzzle({ ...p, notes: "" }); setDesc(""); setGot(""); open(p); reload();
      })}>Start notebook</button></div>
      {cur && (
        <div className="coach-col">
          <b>{cur.title}</b>
          <pre className="coach-pre">{cur.statement}</pre>
          <div className="coach-row">
            <button type="button" className="ui-btn" disabled={dis} onClick={() => void c.task("Explaining...", async () => {
              const k = parseConcepts(await askCoach(conceptMessages(cur))); setCon(k);
              await saveAttempt({ puzzle_key: cur.key, title: cur.title, mode: "coach", lang: "ctf", code: "", result: "studied", explanation: [...k.concepts, ...k.next].join("\n"), mistakes: [], topics: k.topics }, COACH_NOTE_HOST);
            })}>Explain the concepts</button>
            <button type="button" className="ui-btn" disabled={dis} onClick={() => void c.task("Thinking of a hint...", async () => setHints([...hints, parseHint(await askCoach(ctfHintMessages(cur, hints.length, notes)))]))}>
              Hint {Math.min(hints.length + 1, HINT_LEVELS.length)} ({HINT_LEVELS[Math.min(hints.length, HINT_LEVELS.length - 1)].split(" ").slice(0, 3).join(" ")}...)</button>
          </div>
          {con && <div><b>Concepts</b><ul>{con.concepts.map((x, i) => <li key={i}>{x}</li>)}</ul>{con.next.length > 0 && <><b>Next learning steps</b><ul>{con.next.map((x, i) => <li key={i}>{x}</li>)}</ul></>}</div>}
          {hints.length > 0 && <ul className="coach-hints">{hints.map((h, i) => <li key={i}>Hint {i + 1}: {h}</li>)}</ul>}
          <textarea className="ui-file-text coach-code" rows={8} aria-label="Writeup" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="coach-row"><button type="button" className="ui-btn" disabled={dis} onClick={() => void c.task("Saving...", async () => { await saveNotes(cur.key, notes); reload(); })}>Save writeup</button></div>
        </div>
      )}
    </div>
  );
}
