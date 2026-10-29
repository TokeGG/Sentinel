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
import { useModelStatus } from "./useModelStatus";
import "./bot.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run, refresh } = useModule(module);
  const data = useBotData();
  const model = useModelStatus();
  const bot = useBotRun(() => { void refresh(); void data.reload(); });
  return (
    <>
      <h2 className="ui-head"><span className="ui-dot" />{module.name}</h2>
      {(error || data.error) && <ErrorLine message={error ?? data.error ?? ""} />}
      <Sections>
        <Section id="run"><Tile title="Run"><RunPane bot={bot} model={model.status} recheck={() => void model.check()} run={run} busy={busy} /></Tile></Section>
        <Section id="log"><Tile title="Step log and past runs"><LogPane log={bot.log} rows={rows} /></Tile></Section>
        <Section id="knowledge"><Tile title="Knowledge"><KnowledgePane notes={data.notes} run={run} busy={busy} reload={() => void data.reload()} /></Tile></Section>
        <Section id="brain"><Tile title="Brain"><BrainPane state={data.state} run={run} busy={busy} reload={() => void data.reload()} /></Tile></Section>
      </Sections>
    </>
  );
}
