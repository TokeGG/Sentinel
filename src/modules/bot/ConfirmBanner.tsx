import { describeAction } from "./logging";
import { confirmText } from "./panelLogic";
import type { ConfirmReq } from "./useBotRun";

/** Irreversible-action confirm, or (step-approval mode) the per-action approval with the model's reason. */
export function ConfirmBanner({ req }: { req: ConfirmReq }) {
  const c = confirmText(req.action, req.obs);
  return (
    <div className="ui-banner" role="alertdialog" aria-label={req.step ? "Approve step" : "Confirm irreversible action"}>
      <strong>{req.step ? "Next step - approve?" : `The bot wants to ${c.action}`}</strong>
      <div className="ui-meta">Page: {c.page}</div>
      <div className="ui-meta">Action: {describeAction(req.action)}{c.element && ` (${c.element})`}</div>
      {req.why && <div className="ui-meta">Why: {req.why}</div>}
      <div className="ui-actions">
        <button type="button" className="ui-btn" autoFocus onClick={() => req.answer(false)}>Deny and stop</button>
        <button type="button" className="ui-btn primary" onClick={() => req.answer(true)}>{req.step ? "Approve" : "Allow this once"}</button>
      </div>
    </div>
  );
}
