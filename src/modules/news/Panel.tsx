import { openUrl } from "@tauri-apps/plugin-opener";
import type { ModuleManifest } from "../../core/module";
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
        <div className="nw-grid">
          {rows.map((r) => {
            const link = safeLink(r.link);
            return (
              <article key={String(r.id)} className="nw-card">
                <div className="nw-meta">
                  {sourceLabel(r) ? <span className="nw-src">{sourceLabel(r)}</span> : null}
                  <span className="ui-meta">{rowAge(r)}</span>
                </div>
                {link ? (
                  <button type="button" className="nw-title" title={String(r.title)} onClick={() => void openUrl(link)}>
                    {String(r.title)}
                  </button>
                ) : (
                  <span className="nw-title">{String(r.title)}</span>
                )}
              </article>
            );
          })}
        </div>
      )}
    />
  );
}
