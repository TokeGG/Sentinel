// "Make your own": the local model generates a coding puzzle with hidden tests (solved in Your turn) or a concept quiz,
// pitched from past results and weak topics. Everything is saved so it can be retried from the puzzle list.
import { useState } from "react";
import { askCoach } from "./coachLlm";
import { attempts, saveAttempt, savePuzzle } from "./coachStore";
import { COACH_NOTE_HOST } from "./coachSql";
import { adaptDifficulty, CODING_TOPICS, DIFFICULTIES, genMessages, parseGenerated, parseQuiz, questionsOf, QUIZ_TOPICS, quizResult, quizScore, weakTopics, type Difficulty, type Question } from "./gen";
import type { Puzzle } from "./puzzles";
import type { CoachState } from "./useCoach";

export function MakePane({ c, done }: { c: CoachState; done(): void }) {
  const [kind, setKind] = useState<"code" | "quiz">("code");
  const [diff, setDiff] = useState<Difficulty | "auto">("auto");
  const [topic, setTopic] = useState(CODING_TOPICS[0]);
  const [quiz, setQuiz] = useState<{ p: Puzzle; qs: Question[] } | null>(null), [picks, setPicks] = useState<number[]>([]), [graded, setGraded] = useState(false);
  const topics = kind === "code" ? CODING_TOPICS : QUIZ_TOPICS;
  const make = () => c.task("The model is writing a puzzle...", async () => {
    const past = (await attempts().catch(() => [])).filter((a) => a.lang !== "ctfgen");
    const d = diff === "auto" ? adaptDifficulty(past, "easy") : diff;
    const raw = await askCoach(genMessages(kind, d, topic, weakTopics(past)));
    const p = kind === "code" ? parseGenerated(raw) : parseQuiz(raw);
    if ("error" in p) throw new Error(p.error);
    await savePuzzle(p);
    if (kind === "code") { c.setMode("yours"); c.setPuzzle(p); done(); } else { setQuiz({ p, qs: questionsOf(p) }); setPicks([]); setGraded(false); }
  });
  const grade = () => quiz && c.task("Saving...", async () => {
    setGraded(true);
    await saveAttempt({ puzzle_key: quiz.p.key, title: quiz.p.title, mode: "yours", lang: "quiz", code: JSON.stringify(picks), result: quizResult(quizScore(quiz.qs, picks), quiz.qs.length), explanation: "", mistakes: quiz.qs.filter((q, i) => picks[i] !== q.answer).map((q) => `Quiz: ${q.q.slice(0, 80)} -> ${q.choices[q.answer]}`), topics: [topic] }, COACH_NOTE_HOST);
  });
  return (
    <div className="coach-col">
      <div className="coach-row">
        <select className="ui-file-text" value={kind} onChange={(e) => { const k = e.target.value as "code" | "quiz"; setKind(k); setTopic((k === "code" ? CODING_TOPICS : QUIZ_TOPICS)[0]); }} aria-label="Kind">
          <option value="code">Coding puzzle</option><option value="quiz">Concept quiz</option>
        </select>
        <select className="ui-file-text" value={diff} onChange={(e) => setDiff(e.target.value as Difficulty | "auto")} aria-label="Difficulty">
          <option value="auto">Auto (from my results)</option>{DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select className="ui-file-text" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic">{topics.map((t) => <option key={t}>{t}</option>)}</select>
        <button type="button" className="ui-btn primary" disabled={!!c.busy} onClick={() => void make()}>Make one</button>
      </div>
      {quiz && (
        <div className="coach-col">
          <b>{quiz.p.title}</b>
          {quiz.qs.map((q, i) => (
            <fieldset key={i} className="coach-q"><legend>{i + 1}. {q.q}</legend>
              {q.choices.map((ch, j) => <label key={j}><input type="radio" name={`q${i}`} checked={picks[i] === j} disabled={graded} onChange={() => { const n = [...picks]; n[i] = j; setPicks(n); }} /> {ch}{graded && j === q.answer ? " (correct)" : ""}</label>)}
              {graded && q.why && <div className="bot-dim">{q.why}</div>}
            </fieldset>
          ))}
          {!graded ? <button type="button" className="ui-btn" onClick={() => void grade()}>Check answers</button> : <b>{quizResult(quizScore(quiz.qs, picks), quiz.qs.length)}</b>}
        </div>
      )}
    </div>
  );
}
