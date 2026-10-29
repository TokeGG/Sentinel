import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ModuleManifest } from "../../core/module";
import { FeedPanel } from "../news/FeedPanel";
import { rowAge, sourceLabel } from "../news/panelLogic";
import { Chip } from "../../ui/kit";
import { safeLink } from "../../ui/safeLink";
import { TasteBar } from "../../ui/TasteBar";
import { TasteButtons } from "../../ui/TasteButtons";
import { useOption } from "../../ui/useOption";
import { useTasteView } from "../../ui/useTasteView";
import { WhyBadge } from "../../ui/WhyBadge";
import { DealSources } from "./DealSources";
import { CATEGORIES } from "./defaults";
import { percentOff, priceOf } from "./panelLogic";
import { dealTaste } from "./taste";
import "./deals.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { taste, forYou, setForYou } = useTasteView(module.id, useOption("taste", true));
  const [cat, setCat] = useState<string | null>(null);
  return (
    <FeedPanel
      module={module}
      listId="deals"
      empty="No deals yet"
      toolbar={({ rows, busy, run }) => (
        <>
          <TasteBar taste={taste} name="Deals" forYou={forYou} onForYou={setForYou} />
          <div className="dl-cats">
            <Chip on={cat === null} onClick={() => setCat(null)}>All</Chip>
            {CATEGORIES.map((c) => <Chip key={c.id} on={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.label}</Chip>)}
          </div>
          <DealSources module={module} run={run} busy={busy} version={rows} />
        </>
      )}
      list={(rows) => (
        <div className="dl-grid">
          {taste.order(cat ? rows.filter((r) => r.category === cat) : rows, dealTaste, forYou).map((rk) => {
            const r = rk.item;
            const title = String(r.title);
            const price = priceOf(title);
            const off = percentOff(title);
            const link = safeLink(r.link);
            const src = sourceLabel(r);
            const item = dealTaste(r);
            return (
              <article key={String(r.id)} className="dl-card">
                <div className="dl-thumb" aria-hidden="true">{(src || "?").charAt(0).toUpperCase()}</div>
                <div className="dl-main">
                  <p className="dl-title" title={title}>{title}</p>
                  <div className="dl-meta">
                    {src ? <span className="ui-src">{src}</span> : null}
                    <span className="ui-meta">{rowAge(r)}</span>
                    <span className="dl-acts">
                      {forYou && <WhyBadge ranked={rk} />}
                      <TasteButtons taste={taste} item={item} />
                      {link && (
                        <button type="button" className="dl-open" onClick={() => { void taste.record(item, "open"); void openUrl(link); }}>Open</button>
                      )}
                    </span>
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
