import { openUrl } from "@tauri-apps/plugin-opener";
import type { ModuleManifest } from "../../core/module";
import { Row } from "../../ui/kit";
import { FeedPanel } from "./FeedPanel";
import { rowAge, sourceLabel } from "./panelLogic";
import { safeLink } from "../../ui/safeLink";

// Headlines open via the opener plugin (a real button, never an <a href>).
export default function Panel({ module }: { module: ModuleManifest }) {
  return (
    <FeedPanel
      module={module}
      listId="headlines"
      empty="No headlines yet"
      list={(rows) => (
        <div className="ui-list">
          {rows.map((r) => (
            <Row key={String(r.id)} end={<span className="ui-meta">{rowAge(r)}</span>}>
              {safeLink(r.link) ? (
                <button type="button" className="ui-link" title={String(r.title)} onClick={() => void openUrl(safeLink(r.link)!)}>
                  {String(r.title)}
                </button>
              ) : (
                <span className="ui-link">{String(r.title)}</span>
              )}
              {sourceLabel(r) ? <span className="ui-src">{sourceLabel(r)}</span> : null}
            </Row>
          ))}
        </div>
      )}
    />
  );
}
