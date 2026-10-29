import { useState } from "react";
import { describeAction } from "./logging";
import { moveStep, removeStep, setStepText, type Workflow } from "./workflow";

/** Editable step list: rename, start address, reorder, remove, change typed text. */
export function WorkflowEditor({ wf, busy, onSave, onCancel }: { wf: Workflow; busy: boolean; onSave(w: Workflow): void; onCancel(): void }) {
  const [w, setW] = useState(wf);
  return (
    <div className="bot-goal">
      <input className="ui-file-text" value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} aria-label="Workflow name" />
      <input className="ui-file-text" value={w.startUrl} onChange={(e) => setW({ ...w, startUrl: e.target.value })} placeholder="Start address https://..." aria-label="Start address" />
      <ol className="bot-steps">
        {w.steps.map((s, i) => (
          <li key={i}><div className="bot-wf-step">
            {s.action.type === "type"
              ? <>type into {s.el?.text || s.el?.role}: <input value={s.action.text} onChange={(e) => setW(setStepText(w, i, e.target.value))} aria-label={`Text for step ${i + 1}`} /></>
              : <span>{describeAction(s.action)}{s.el ? ` - ${s.el.role} "${s.el.text}"` : ""}</span>}
            <button type="button" className="ui-btn" aria-label="Move up" onClick={() => setW(moveStep(w, i, -1))}>Up</button>
            <button type="button" className="ui-btn" aria-label="Move down" onClick={() => setW(moveStep(w, i, 1))}>Down</button>
            <button type="button" className="ui-btn" aria-label="Remove step" onClick={() => setW(removeStep(w, i))}>Remove</button>
          </div></li>
        ))}
      </ol>
      <div className="ui-actions">
        <button type="button" className="ui-btn primary" disabled={busy || !w.steps.length} onClick={() => onSave(w)}>Save</button>
        <button type="button" className="ui-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
