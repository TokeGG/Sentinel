import { openUrl } from "@tauri-apps/plugin-opener";
import type { ModuleManifest } from "../../core/module";
import { FeedPanel } from "./FeedPanel";
import { rowAge, sourceLabel } from "./panelLogic";
import { safeLink } from "../../ui/safeLink";
import { TasteBar } from "../../ui/TasteBar";
import { TasteButtons } from "../../ui/TasteButtons";
import { useOption } from "../../ui/useOption";
import { useTasteView } from "../../ui/useTasteView";
import { WhyBadge } from "../../ui/WhyBadge";
import { newsTaste } from "./taste";

// Headlines open via the opener plugin (a real button, never an <a href>).
export default function Panel({ module }: { module: ModuleManifest }) {
  const { taste, forYou, setForYou } = useTasteView(module.id, useOption("taste", true));
  return (
    <FeedPanel
      module={module}
      listId="headlines"
      empty="No headlines yet"
      toolbar={() => <TasteBar taste={taste} name="News" forYou={forYou} onForYou={setForYou} />}
      list={(rows) => (
        <div className="nw-grid">
          {taste.order(rows, newsTaste, forYou).map((rk) => {
            const r = rk.item;
            const link = safeLink(r.link);
            const item = newsTaste(r);
            return (
              <article key={String(r.id)} className="nw-card">
                <div className="nw-meta">
                  {sourceLabel(r) ? <span className="nw-src">{sourceLabel(r)}</span> : null}
                  <span className="ui-meta">{rowAge(r)}</span>
                  {forYou && <WhyBadge ranked={rk} />}
                  <TasteButtons taste={taste} item={item} />
                </div>
                {link ? (
                  <button type="button" className="nw-title" title={String(r.title)} onClick={() => { void taste.record(item, "open"); void openUrl(link); }}>
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
