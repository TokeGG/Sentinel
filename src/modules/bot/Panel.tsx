import type { ModuleManifest } from "../../core/module";
import { ErrorLine, Tile } from "../../ui/kit";
import { Section, Sections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import { BrainPane } from "./BrainPane";
import { KnowledgePane } from "./KnowledgePane";
import { LogPane } from "./LogPane";
import { RunPane } from "./RunPane";
import { JobsPane } from "./JobsPane";
import { SitesPane } from "./SitesPane";
import { useBotData } from "./useBotData";
import { useExtras } from "./useExtras";
import { WorkflowPane } from "./WorkflowPane";
import { useBotRun } from "./useBotRun";
import { useFx } from "./useFx";
import { useModelStatus } from "./useModelStatus";
import { shortStatus } from "./ollamaStatus";
import { CoachPane } from "./coach/CoachPane";
import { ModelsPane } from "./ModelsPane";
import "./bot.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run, refresh } = useModule(module);
  const data = useBotData();
  const model = useModelStatus();
  const ex = useExtras();
  const bot = useBotRun(() => { void refresh(); void data.reload(); void ex.reload(); });
  const fx = useFx();
  return (
    <div className="bot-root" data-fx={fx} data-run={bot.running ? "1" : "0"}>
      <h2 className="ui-head bot-head"><span className="ui-dot" />{module.name}<span className="bot-state">{bot.running ? "running" : "idle"}</span></h2>
      <div className="bot-status" role="status">
        <i className="bot-led" aria-hidden />
        <span>{shortStatus(model.status)}</span>
        <span className="bot-dim">{bot.running ? `${bot.log.length} log lines` : "waiting for a goal"}</span>
        <b className="bot-prog" aria-hidden />
      </div>
      {(error || data.error || ex.error) && <ErrorLine message={error ?? data.error ?? ex.error ?? ""} />}
      <Sections className="bot-grid">
        <Section id="run"><Tile title="Run"><RunPane bot={bot} model={model.status} recheck={() => void model.check()} run={run} busy={busy} /></Tile></Section>
        <Section id="log"><Tile title="Step log and past runs"><LogPane log={bot.log} rows={rows} /></Tile></Section>
        <Section id="knowledge"><Tile title="Knowledge"><KnowledgePane notes={data.notes} run={run} busy={busy} reload={() => void data.reload()} /></Tile></Section>
        <Section id="workflows"><Tile title="Saved workflows"><WorkflowPane list={ex.workflows} bot={bot} run={run} busy={busy} reload={() => void ex.reload()} /></Tile></Section>
        <Section id="jobs"><Tile title="Scheduled jobs"><JobsPane jobs={ex.jobs} runs={ex.runs} workflows={ex.workflows} run={run} busy={busy} reload={() => void ex.reload()} /></Tile></Section>
        <Section id="sites"><Tile title="Site notebook"><SitesPane sites={ex.sites} run={run} busy={busy} reload={() => void ex.reload()} /></Tile></Section>
        <Section id="weekly"><Tile title="What I learned this week"><ul className="bot-steps">{ex.weekly.map((l, i) => <li key={i}>{l}</li>)}</ul></Tile></Section>
        <Section id="coach"><Tile title="Challenge Coach"><CoachPane /></Tile></Section>
        <Section id="models"><Tile title="Local models"><ModelsPane /></Tile></Section>
        <Section id="brain"><Tile title="Brain"><BrainPane state={data.state} run={run} busy={busy} reload={() => void data.reload()} /></Tile></Section>
      </Sections>
    </div>
  );
}
