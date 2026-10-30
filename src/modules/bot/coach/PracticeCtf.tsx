// Offline Practice CTF: puzzle + flag made from a seed in the app (ctfGen.ts); the model adds a story/hints and explains
// after. Difficulty adapts from past results. Nothing networked, nothing aimed at other systems.
import { useState } from "react";
import { askCoach } from "./coachLlm";
import { attempts, saveAttempt, savePuzzle } from "./coachStore";
import { COACH_NOTE_HOST } from "./coachSql";
import { CTF_CATEGORIES, ctfPuzzle, flagOk, makeCtf, type CtfCategory, type CtfGen } from "./ctfGen";
import { conceptMessages, parseConcepts, parseStory, scrubFlag, storyMessages } from "./ctfPrompts";
import { adaptDifficulty, type Difficulty } from "./gen";
import type { CoachState } from "./useCoach";

export function PracticeCtf({ c }: { c: CoachState }) {
  const [cat, setCat] = useState<CtfCategory>("encoding");
  const [g, setG] = useState<CtfGen | null>(null), [seed, setSeed] = useState(0);
  const [story, setStory] = useState<{ story: string; hints: string[] } | null>(null), [shown, setShown] = useState(0);
  const [guess, setGuess] = useState(""), [msg, setMsg] = useState(""), [explain, setExplain] = useState<string[]>([]);
  const dis = !!c.busy;
  const make = () => c.task("Building a puzzle...", async () => {
    const past = (await attempts().catch(() => [])).filter((a) => a.lang === "ctfgen" && a.title.includes(cat));
    const d: Difficulty = adaptDifficulty(past, (past[0]?.puzzle_key.split(":")[2] as Difficulty) || "easy");
    const s = Math.floor(Math.random() * 2 ** 31), x = await makeCtf(s, cat, d);
    setG(x); setSeed(s); setStory(null); setShown(0); setGuess(""); setMsg(""); setExplain([]);
    await savePuzzle(ctfPuzzle(x, s));
    try { const st = parseStory(await askCoach(storyMessages(x.title, x.body, x.concept))); setStory({ story: scrubFlag(st.story, x.flag), hints: st.hints.map((h) => scrubFlag(h, x.flag)) }); } catch { /* model optional */ }
  });
  const check = () => g && c.task("Checking...", async () => {
    const right = flagOk(guess, g.flag);
    setMsg(right ? "Correct!" : "Not yet. Try again or take a hint.");
    if (!right) return;
    const k = await askCoach(conceptMessages({ key: "", source: "ctfgen", title: g.title, statement: `${g.body}\nAnswer: ${g.flag}\nConcept: ${g.concept}`, input: null })).then(parseConcepts, () => null);
    setExplain(k ? [g.concept, ...k.concepts] : [g.concept]);
    await saveAttempt({ puzzle_key: ctfPuzzle(g, seed).key, title: `${g.title} (${g.category})`, mode: "yours", lang: "ctfgen", code: guess, result: `PASS flag, ${shown} hints`, explanation: g.concept, mistakes: [], topics: [g.category, ...(k?.topics ?? [])] }, COACH_NOTE_HOST);
  });
  return (
    <div className="coach-col">
      <div className="coach-row">
        <select className="ui-file-text" value={cat} onChange={(e) => setCat(e.target.value as CtfCategory)} aria-label="Category">{CTF_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select>
        <button type="button" className="ui-btn primary" disabled={dis} onClick={() => void make()}>New practice CTF</button>
      </div>
      {g && (
        <div className="coach-col">
          <b>{g.title} <span className="bot-dim">({g.difficulty})</span></b>
          {story?.story && <p>{story.story}</p>}
          <pre className="coach-pre">{g.body}</pre>
          {story && shown < story.hints.length && <button type="button" className="ui-btn" onClick={() => setShown(shown + 1)}>Hint {shown + 1}</button>}
          {story?.hints.slice(0, shown).map((h, i) => <div key={i} className="bot-dim">Hint {i + 1}: {h}</div>)}
          <div className="coach-row">
            <input className="ui-file-text" placeholder="flag{...}" value={guess} onChange={(e) => setGuess(e.target.value)} />
            <button type="button" className="ui-btn" disabled={dis} onClick={() => void check()}>Check flag</button>
            <span>{msg}</span>
          </div>
          {explain.length > 0 && <ul>{explain.map((x, i) => <li key={i}>{x}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
