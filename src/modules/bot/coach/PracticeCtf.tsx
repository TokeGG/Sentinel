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
import { addRetry, clock, dailyPick, parseRetry, points, writeupTemplate, type RetryItem } from "./ctfExtras";
import { getSetting, setSetting } from "../../../ui/appSetting";
import { useEffect } from "react";

export function PracticeCtf({ c }: { c: CoachState }) {
  const [cat, setCat] = useState<CtfCategory>("encoding");
  const [g, setG] = useState<CtfGen | null>(null), [seed, setSeed] = useState(0);
  const [story, setStory] = useState<{ story: string; hints: string[] } | null>(null), [shown, setShown] = useState(0);
  const [guess, setGuess] = useState(""), [msg, setMsg] = useState(""), [explain, setExplain] = useState<string[]>([]);
  const [started, setStarted] = useState(0), [now, setNow] = useState(0), [doneMs, setDoneMs] = useState(0);
  const [retry, setRetry] = useState<RetryItem[]>([]), [writeup, setWriteup] = useState(""), [rating, setRating] = useState(0);
  useEffect(() => { getSetting("ctf_retry").then((s) => setRetry(parseRetry(s))).catch(() => {}); }, []);
  useEffect(() => { if (!g || doneMs) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [g, doneMs]);
  const saveRetry = (l: RetryItem[]) => { setRetry(l); setSetting("ctf_retry", JSON.stringify(l)).catch(() => {}); };
  const dis = !!c.busy;
  const make = (fixed?: { seed: number; category: CtfCategory; difficulty?: Difficulty }) => c.task("Building a puzzle...", async () => {
    const k = fixed?.category ?? cat;
    const past = (await attempts().catch(() => [])).filter((a) => a.lang === "ctfgen" && a.title.includes(k));
    const d: Difficulty = fixed?.difficulty ?? adaptDifficulty(past, (past[0]?.puzzle_key.split(":")[2] as Difficulty) || "easy");
    const s = fixed?.seed ?? Math.floor(Math.random() * 2 ** 31), x = await makeCtf(s, k, d);
    setG(x); setSeed(s); setStory(null); setShown(0); setGuess(""); setMsg(""); setExplain([]);
    setStarted(Date.now()); setNow(Date.now()); setDoneMs(0); setRating(0); setWriteup(writeupTemplate(x.title, x.category));
    await savePuzzle(ctfPuzzle(x, s));
    try { const st = parseStory(await askCoach(storyMessages(x.title, x.body, x.concept))); setStory({ story: scrubFlag(st.story, x.flag), hints: st.hints.map((h) => scrubFlag(h, x.flag)) }); } catch { /* model optional */ }
  });
  const check = () => g && c.task("Checking...", async () => {
    const right = flagOk(guess, g.flag);
    const pts = points(shown, story?.hints.length || 3);
    setMsg(right ? `Correct! ${pts} points in ${clock(Date.now() - started)}` : "Not yet. Try again or take a hint.");
    if (!right) return;
    setDoneMs(Date.now() - started);
    saveRetry(retry.filter((r) => r.seed !== seed));
    const k = await askCoach(conceptMessages({ key: "", source: "ctfgen", title: g.title, statement: `${g.body}\nAnswer: ${g.flag}\nConcept: ${g.concept}`, input: null })).then(parseConcepts, () => null);
    setExplain(k ? [g.concept, ...k.concepts] : [g.concept]);
    await saveAttempt({ puzzle_key: ctfPuzzle(g, seed).key, title: `${g.title} (${g.category})`, mode: "yours", lang: "ctfgen", code: guess, result: `PASS flag, ${shown} hints, ${pts} pts, ${clock(Date.now() - started)}`, explanation: g.concept, mistakes: [], topics: [g.category, ...(k?.topics ?? [])] }, COACH_NOTE_HOST);
  });
  return (
    <div className="coach-col">
      <div className="coach-row">
        <select className="ui-file-text" value={cat} onChange={(e) => setCat(e.target.value as CtfCategory)} aria-label="Category">{CTF_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select>
        <button type="button" className="ui-btn primary" disabled={dis} onClick={() => void make()}>New practice CTF</button>
        <button type="button" className="ui-btn" disabled={dis} onClick={() => void make({ ...dailyPick(new Date()), difficulty: "medium" })}>Daily challenge</button>
      </div>
      {retry.length > 0 && <div className="coach-row"><span className="bot-dim">Retry later:</span>{retry.slice(0, 6).map((r) => <button key={`${r.category}${r.seed}`} type="button" className="ui-link" onClick={() => void make(r)}>{r.title}</button>)}</div>}
      <div className="coach-row">
      </div>
      {g && (
        <div className="coach-col">
          <b>{g.title} <span className="bot-dim">({g.difficulty}) · {clock((doneMs || now - started))}</span></b>
          {!doneMs && <button type="button" className="ui-btn" onClick={() => { saveRetry(addRetry(retry, { category: g.category, difficulty: g.difficulty, seed, title: g.title })); setMsg("Saved to Retry later"); }}>Retry later</button>}
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
          {doneMs > 0 && <div className="coach-row"><span>How hard was it?</span>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={`ui-btn${rating === n ? " primary" : ""}`} aria-label={`Difficulty ${n} of 5`} onClick={() => setRating(n)}>{n}</button>)}</div>}
          {doneMs > 0 && <textarea className="coach-pre" aria-label="Write-up" rows={8} value={writeup} onChange={(e) => setWriteup(e.target.value)} />}
          {doneMs > 0 && <button type="button" className="ui-btn" disabled={dis} onClick={() => void c.task("Saving write-up...", () => saveAttempt({ puzzle_key: ctfPuzzle(g, seed).key + ":writeup", title: `Write-up: ${g.title}`, mode: "yours", lang: "writeup", code: writeup, result: rating ? `rated ${rating}/5` : "", explanation: g.concept, mistakes: [], topics: [g.category] }, COACH_NOTE_HOST))}>Save write-up</button>}
        </div>
      )}
    </div>
  );
}
