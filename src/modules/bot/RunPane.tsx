import { useState } from "react";
import type { ModuleState } from "../../ui/useModule";
import { ErrorLine } from "../../ui/kit";
import { describeAction } from "./logging";
import { detectMistakes } from "./mistakes";
import { confirmText, mistakeLines, OUTCOME_LABEL, type ModelStatus } from "./panelLogic";
import type { useBotRun } from "./useBotRun";

type Bot = ReturnType<typeof useBotRun>;

export function RunPane({ bot, model, recheck, run, busy }: { bot: Bot; model: ModelStatus; recheck(): void; run: ModuleState["run"]; busy: boolean }) {
  const [goal, setGoal] = useState("");
  const [pre, setPre] = useState(false); // default off: irreversible actions ask first
  const [rated, setRated] = useState<string | null>(null);
  const r = bot.result;
  const c = bot.confirm && confirmText(bot.confirm.action, bot.confirm.obs);
  const rate = async (thumbs: "up" | "down") => { if (r?.episodeId !== undefined && (await run("rate_run", { id: r.episodeId, thumbs })) !== undefined) setRated(thumbs); };
  return (
    <div className="bot-goal">
      <p className={`ui-meta ${model.ok ? "bot-model-ok" : ""}`} role="status">
        {model.text} <button type="button" className="ui-btn" onClick={recheck}>Check again</button>
      </p>
      <textarea className="ui-file-text" rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} disabled={bot.running} aria-label="Goal"
        placeholder="What should the bot do? e.g. find the opening hours of the city library" />
      <div className="ui-controls">
        {bot.running
          ? <button type="button" className="ui-btn primary" onClick={bot.stop}>Stop</button>
          : <button type="button" className="ui-btn primary" disabled={!goal.trim() || !model.ok} onClick={() => { setRated(null); void bot.start(goal.trim(), pre); }}>Run</button>}
        <label className="schedule-toggle"><input type="checkbox" checked={bot.visible} onChange={(e) => bot.setShow(e.target.checked)} /> Show browser window</label>
        <label className="schedule-toggle" title="Off: the bot asks before submit, purchase, delete and login actions"><input type="checkbox" checked={pre} disabled={bot.running} onChange={(e) => setPre(e.target.checked)} /> Pre-approve irreversible actions for this run</label>
      </div>
      {bot.error && <ErrorLine message={bot.error} />}
      {bot.confirm && c && (
        <div className="ui-banner" role="alertdialog" aria-label="Confirm irreversible action">
          <strong>The bot wants to {c.action}</strong>
          <div className="ui-meta">Page: {c.page}</div>
          <div className="ui-meta">Action: {describeAction(bot.confirm.action)}{c.element && ` (${c.element})`}</div>
          <div className="ui-actions">
            <button type="button" className="ui-btn" autoFocus onClick={() => bot.confirm?.answer(false)}>Deny and stop</button>
            <button type="button" className="ui-btn primary" onClick={() => bot.confirm?.answer(true)}>Allow this once</button>
          </div>
        </div>
      )}
      {r && (
        <div role="status">
          <strong>{OUTCOME_LABEL[r.episode.outcome]}</strong>{r.episode.result && `: ${r.episode.result}`}
          <div className="ui-meta">{r.episode.steps.length} steps. {mistakeLines(detectMistakes(r.episode)).join("; ") || "No mistakes noticed."}</div>
          {r.episodeId !== undefined && (
            <div className="ui-actions">
              <span className="ui-meta">Was this good?</span>
              <button type="button" className="ui-btn" disabled={busy || rated !== null} aria-label="Thumbs up" onClick={() => void rate("up")}>Good</button>
              <button type="button" className="ui-btn" disabled={busy || rated !== null} aria-label="Thumbs down" onClick={() => void rate("down")}>Bad</button>
              {rated && <span className="ui-meta">Thanks - saved{rated === "down" ? "; the bot will learn from this" : ""}.</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
