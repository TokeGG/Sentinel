import type { Episode } from "./actions";
import { describeAction } from "./logging";
import { planLines } from "./plan";

/** The finished run's plan and each step with the model's reason (explain-why). */
export function StepList({ ep }: { ep: Episode }) {
  return (
    <>
      {ep.plan && <pre className="bot-plan">{planLines(ep.plan)}</pre>}
      <ol className="bot-steps">
        {ep.steps.map((s, i) => (
          <li key={i} className={s.ok ? "" : "bad"}>
            {s.action ? describeAction(s.action) : "(invalid answer)"}{s.ok ? "" : ` - ${s.error ?? "failed"}`}
            {s.why && <div className="ui-meta">why: {s.why}</div>}
          </li>
        ))}
      </ol>
    </>
  );
}
