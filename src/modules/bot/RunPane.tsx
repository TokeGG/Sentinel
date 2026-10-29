import { useState } from "react";
import type { ModuleState } from "../../ui/useModule";
import { ErrorLine } from "../../ui/kit";
import { ConfirmBanner } from "./ConfirmBanner";
import { detectMistakes } from "./mistakes";
import { mistakeLines, OUTCOME_LABEL, type ModelStatus } from "./panelLogic";
import { RunOptions, type RunFlags } from "./RunOptions";
import { StepList } from "./StepList";
import type { useBotRun } from "./useBotRun";

type Bot = ReturnType<typeof useBotRun>;

export function RunPane({ bot, model, recheck, run, busy }: { bot: Bot; model: ModelStatus; recheck(): void; run: ModuleState["run"]; busy: boolean }) {
  const [goal, setGoal] = useState("");
  const [flags, setFlags] = useState<RunFlags>({ pre: false, dry: false, step: false }); // default: irreversible actions ask first
  const [rated, setRated] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const r = bot.result;
  const rate = async (thumbs: "up" | "down") => { if (r?.episodeId !== undefined && (await run("rate_run", { id: r.episodeId, thumbs })) !== undefined) setRated(thumbs); };
  const save = async () => { if (r?.episodeId !== undefined && (await run("save_run_workflow", { id: r.episodeId, name: r.episode.goal })) !== undefined) setSaved(true); };
  const go = () => { setRated(null); setSaved(false); void bot.start(goal.trim(), { preApproved: flags.pre, dryRun: flags.dry, stepApproval: flags.step }); };
  return (
    <div className="bot-goal">
      <p className={`ui-meta ${model.ok ? "bot-model-ok" : ""}`} role="status">
        {model.text} <button type="button" className="ui-btn" onClick={recheck}>Check again</button>
      </p>
      <RunOptions flags={flags} set={setFlags} disabled={bot.running} onGoal={setGoal} />
      <textarea className="ui-file-text" rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} disabled={bot.running} aria-label="Goal"
        placeholder="What should the bot do? e.g. find the opening hours of the city library" />
      <div className="ui-controls">
        {bot.running
          ? <button type="button" className="ui-btn primary" onClick={bot.stop}>Stop</button>
          : <button type="button" className="ui-btn primary" disabled={!goal.trim() || !model.ok} onClick={go}>{flags.dry ? "Plan" : "Run"}</button>}
        <label className="schedule-toggle"><input type="checkbox" checked={bot.visible} onChange={(e) => bot.setShow(e.target.checked)} /> Show browser window</label>
      </div>
      {bot.error && <ErrorLine message={bot.error} />}
      {bot.confirm && <ConfirmBanner req={bot.confirm} />}
      {r && (
        <div role="status">
          <strong>{OUTCOME_LABEL[r.episode.outcome]}</strong>{r.episode.result && `: ${r.episode.result}`}
          <div className="ui-meta">{r.episode.steps.length} steps. {mistakeLines(detectMistakes(r.episode)).join("; ") || "No mistakes noticed."}</div>
          <StepList ep={r.episode} />
          {r.episodeId !== undefined && r.episode.outcome !== "dry" && (
            <div className="ui-actions">
              <span className="ui-meta">Was this good?</span>
              <button type="button" className="ui-btn" disabled={busy || rated !== null} aria-label="Thumbs up" onClick={() => void rate("up")}>Good</button>
              <button type="button" className="ui-btn" disabled={busy || rated !== null} aria-label="Thumbs down" onClick={() => void rate("down")}>Bad</button>
              {r.episode.outcome === "done" && <button type="button" className="ui-btn" disabled={busy || saved} onClick={() => void save()}>{saved ? "Saved as workflow" : "Save as workflow"}</button>}
              {rated && <span className="ui-meta">Thanks - saved{rated === "down" ? "; the bot will learn from this" : ""}.</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
