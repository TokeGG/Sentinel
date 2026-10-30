// The puzzle, the coach's walkthrough (or your-turn hints), the code, owner-pressed Run, and the recap.
import type { CoachState } from "./useCoach";

export function CoachWork({ c }: { c: CoachState }) {
  const p = c.puzzle;
  if (!p) return <p className="bot-dim">Pick or paste a puzzle above.</p>;
  const dis = !!c.busy, gen = p.source === "gen";
  return (
    <div className="coach-col">
      <b>{p.title}</b>
      <pre className="coach-pre">{p.statement}</pre>
      {p.input && !gen && <span className="bot-dim">Input loaded ({p.input.length} characters, fed to your program on stdin).</span>}
      {gen && <span className="bot-dim">Your code is checked against hidden tests when you press Run.</span>}
      <div className="coach-row">
        <select className="ui-file-text" value={c.lang} onChange={(e) => c.setLang(e.target.value as "python" | "javascript")} aria-label="Language">
          <option value="python">Python</option><option value="javascript">JavaScript</option>
        </select>
        {c.mode === "coach" ? <button type="button" className="ui-btn primary" disabled={dis} onClick={() => void c.walk()}>Coach, work it through</button>
          : <button type="button" className="ui-btn" disabled={dis} onClick={() => void c.hint()}>Give me a hint</button>}
      </div>
      {c.solve && (
        <div className="coach-col">
          <div><b>The problem:</b> {c.solve.restate}</div>
          {c.solve.plan.length > 0 && <div><b>Plan:</b><ol>{c.solve.plan.map((s, i) => <li key={i}>{s}</li>)}</ol></div>}
          {c.solve.steps.length > 0 && <div><b>Step by step:</b><ul>{c.solve.steps.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
        </div>
      )}
      {c.hints.length > 0 && <ul className="coach-hints">{c.hints.map((h, i) => <li key={i}>Hint {i + 1}: {h}</li>)}</ul>}
      <textarea className="ui-file-text coach-code" rows={12} spellCheck={false} aria-label="Code" placeholder={c.mode === "yours" ? "Write your solution here (read stdin, print the answer)." : "The coach's code appears here; you can edit it."} value={c.code} onChange={(e) => c.setCode(e.target.value)} />
      <div className="coach-row">
        <button type="button" className="ui-btn primary" disabled={dis || !c.code.trim()} onClick={() => void c.run()}>Run (your {c.lang === "python" ? "Python" : "Node"}, 10 s limit)</button>
        {c.out && <button type="button" className="ui-btn" disabled={dis} onClick={() => void c.finish()}>Recap and save</button>}
      </div>
      {c.out && (
        <div className="coach-col">
          <b>{c.out.verdict}</b>
          {p.source === "aoc" && <span className="bot-dim">Nothing is submitted: enter the answer yourself on adventofcode.com.</span>}
          {c.out.run.stdout && <pre className="coach-pre">{c.out.run.stdout}</pre>}
          {c.out.run.stderr && <pre className="coach-pre coach-err">{c.out.run.stderr}</pre>}
        </div>
      )}
      {c.recap && (
        <div className="coach-col">
          <pre className="coach-pre">{c.recap.text}</pre>
          {c.recap.r.quiz && <details><summary>Show quiz answer</summary>{c.recap.r.quiz.answer}</details>}
        </div>
      )}
    </div>
  );
}
