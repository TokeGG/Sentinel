import { EmptyState, Row } from "../../ui/kit";
import type { ModuleRow } from "../../ui/useModule";
import type { LogEntry } from "./logging";
import { episodeLabel, type EpisodeRow } from "./panelLogic";

export function LogPane({ log, rows }: { log: LogEntry[]; rows: ModuleRow[] }) {
  const eps = rows as unknown as EpisodeRow[];
  return (
    <>
      {log.length === 0 ? <EmptyState title="No run yet" hint="Each step shows what the bot saw, what the model chose, and what happened." /> : (
        <div className="bot-log" role="log" aria-label="Step log">
          {log.map((e, i) => <div key={i} className={`bot-line ${e.kind}`}><span className="bot-kind">{e.kind}</span><span>{e.text}</span></div>)}
        </div>
      )}
      <h4 className="ui-meta">Past runs</h4>
      {eps.length === 0 ? <p className="ui-meta">None yet.</p> : eps.map((e) => (
        <Row key={e.id} end={<span className="ui-meta">{e.thumbs === "up" ? "good" : e.thumbs === "down" ? "bad" : ""}</span>}>{episodeLabel(e)}</Row>
      ))}
    </>
  );
}
