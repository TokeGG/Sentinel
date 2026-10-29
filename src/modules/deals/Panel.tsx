import { openUrl } from "@tauri-apps/plugin-opener";
import type { ModuleManifest } from "../../core/module";
import { Tile } from "../../ui/kit";
import { FeedPanel } from "../news/FeedPanel";
import { rowAge, sourceLabel } from "../news/panelLogic";
import { safeLink } from "../../ui/safeLink";
import { priceOf } from "./panelLogic";

export default function Panel({ module }: { module: ModuleManifest }) {
  return (
    <FeedPanel
      module={module}
      listId="deals"
      empty="No deals yet"
      list={(rows) => (
        <div className="ui-tiles">
          {rows.map((r) => {
            const title = String(r.title);
            const price = priceOf(title);
            const link = safeLink(r.link);
            return (
              <Tile key={String(r.id)}>
                {price && <div className="ui-price">{price}</div>}
                <p className="ui-tile-body">{title}</p>
                <div className="ui-tile-foot">
                  {sourceLabel(r) ? <span className="ui-src">{sourceLabel(r)}</span> : null}
                  <span className="ui-meta">{rowAge(r)}</span>
                  {link && (
                    <button type="button" className="ui-btn" style={{ marginLeft: "auto" }} onClick={() => void openUrl(link)}>
                      Open
                    </button>
                  )}
                </div>
              </Tile>
            );
          })}
        </div>
      )}
    />
  );
}
