import { openUrl } from "@tauri-apps/plugin-opener";
import type { ModuleManifest } from "../../core/module";
import { FeedPanel } from "../news/FeedPanel";
import { rowAge, sourceLabel } from "../news/panelLogic";
import { safeLink } from "../../ui/safeLink";
import { percentOff, priceOf } from "./panelLogic";
import "./deals.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  return (
    <FeedPanel
      module={module}
      listId="deals"
      empty="No deals yet"
      list={(rows) => (
        <div className="dl-grid">
          {rows.map((r) => {
            const title = String(r.title);
            const price = priceOf(title);
            const off = percentOff(title);
            const link = safeLink(r.link);
            const src = sourceLabel(r);
            return (
              <article key={String(r.id)} className="dl-card">
                <div className="dl-thumb" aria-hidden="true">{(src || "?").charAt(0).toUpperCase()}</div>
                <div className="dl-main">
                  <p className="dl-title" title={title}>{title}</p>
                  <div className="dl-meta">
                    {src ? <span className="ui-src">{src}</span> : null}
                    <span className="ui-meta">{rowAge(r)}</span>
                    {link && (
                      <button type="button" className="dl-open" onClick={() => void openUrl(link)}>Open</button>
                    )}
                  </div>
                </div>
                {(price || off) && (
                  <div className="dl-price">
                    {price && <b>{price}</b>}
                    {off && <span className="dl-off">{off}</span>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    />
  );
}
