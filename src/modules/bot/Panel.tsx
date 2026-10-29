import type { ModuleManifest } from "../../core/module";
import { ErrorLine, Tile } from "../../ui/kit";
import { Section, Sections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import { BrainPane } from "./BrainPane";
import { KnowledgePane } from "./KnowledgePane";
import { LogPane } from "./LogPane";
import { RunPane } from "./RunPane";
import { useBotData } from "./useBotData";
import { useBotRun } from "./useBotRun";
import { useFx } from "./useFx";
import { useModelStatus } from "./useModelStatus";
import "./bot.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run, refresh } = useModule(module);
  const data = useBotData();
  const model = useModelStatus();
  const bot = useBotRun(() => { void refresh(); void data.reload(); });
  const fx = useFx();
  return (
    <div className="bot-root" data-fx={fx} data-run={bot.running ? "1" : "0"}>
      <h2 className="ui-head bot-head"><span className="ui-dot" />{module.name}<span className="bot-state">{bot.running ? "running" : "idle"}</span></h2>
      <div className="bot-status" role="status">
        <i className="bot-led" aria-hidden />
        <span>{model.status.ok ? "local model online" : "local model offline"}</span>
        <span className="bot-dim">{bot.running ? `${bot.log.length} log lines` : "waiting for a goal"}</span>
        <b className="bot-prog" aria-hidden />
      </div>
      {(error || data.error) && <ErrorLine message={error ?? data.error ?? ""} />}
      <Sections className="bot-grid">
        <Section id="run"><Tile title="Run"><RunPane bot={bot} model={model.status} recheck={() => void model.check()} run={run} busy={busy} /></Tile></Section>
        <Section id="log"><Tile title="Step log and past runs"><LogPane log={bot.log} rows={rows} /></Tile></Section>
        <Section id="knowledge"><Tile title="Knowledge"><KnowledgePane notes={data.notes} run={run} busy={busy} reload={() => void data.reload()} /></Tile></Section>
        <Section id="brain"><Tile title="Brain"><BrainPane state={data.state} run={run} busy={busy} reload={() => void data.reload()} /></Tile></Section>
      </Sections>
    </div>
  );
}
