import { useRef, useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";
import { EmptyState, ErrorLine, Spark, Table, Tabs } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { QuickAdd } from "../../ui/QuickAdd";
import { Section, Sections, useSections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import "./finance.css";
import { changeInfo, emptyHistory, fmtPrice, pctText, shownParts, sortTrades, priceKey, trackPrices, tradeView } from "./panelLogic";

type Part = "watchlist" | "congress";
const TABS: { id: Part; label: string }[] = [
  { id: "watchlist", label: "Watchlist" },
  { id: "congress", label: "Congress" },
];

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const ids = useSections();
  const [chosen, setChosen] = useState<Part>("watchlist");
  const watch = rows.filter((r) => r.kind === "watch");
  const trades = sortTrades(rows.filter((r) => r.kind === "trade").map((r) => ({ ...r, date: r.date ?? r.label })));
  // The DB keeps only the latest price + its check time: this panel builds a
  // per-session series (one point per refresh) for the change figure and sparkline.
  const now = new Date();
  const hist = useRef(emptyHistory());
  hist.current = trackPrices(hist.current, watch);
  const show = shownParts(ids, chosen);
  const tabs = TABS.filter((t) => ids.includes(t.id));
  const hasAdd = ids.includes("add");
  const hasActions = ids.includes("actions");
  return (
    <div className="fin-root">
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{watch.length} watched</span>
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="tabs">
          {tabs.length > 1 && <Tabs tabs={tabs} active={show.tab} onChange={(id) => setChosen(id as Part)} />}
        </Section>
        {show.watchlist && (
          <Section id="watchlist">
            {watch.length ? (
              <ul className="fin-tiles">
                {watch.map((r) => {
                  const series = hist.current.series[priceKey(r)] ?? [];
                  const { pct: chg, caption } = changeInfo(series, now);
                  const tone = chg === null || chg === 0 ? "flat" : chg > 0 ? "up" : "down";
                  return (
                    <li key={String(r.id)} className={`fin-tile ${tone}`}>
                      <div className="fin-top">
                        <span className="fin-sym">{String(r.symbol).toUpperCase()}</span>
                        <span className="fin-spark">{series.length > 1 && <Spark points={series.map((p) => p.price)} tone={tone} />}</span>
                      </div>
                      <div className="fin-price">{fmtPrice(r.price)}</div>
                      <div className="fin-chg">
                        {chg !== null && <span className={`fin-pill ${tone}`}>{tone === "up" ? "▲" : tone === "down" ? "▼" : "•"} {pctText(chg)}</span>}
                        {caption && <small>{caption}</small>}
                        {r.asset === "crypto" && <span className="fin-kind">crypto</span>}
                      </div>
                      <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void run("remove_symbol", { id: r.dbId })} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="No symbols yet"
                hint={hasAdd ? "Add a symbol, e.g. AAPL or bitcoin:crypto." : "Re-enable “Add symbol” in Customize to add one."}
              />
            )}
          </Section>
        )}
        {show.congress && (
          <Section id="congress">
            <Table
              empty={hasActions ? "No trades yet — use Sync Congress Trades." : "No trades yet — re-enable “Refresh & sync” in Customize to sync them."}
              columns={[
                { key: "who", label: "Who" },
                { key: "ticker", label: "Ticker" },
                { key: "type", label: "Type", cellClass: (r) => String(r.tone) },
                { key: "size", label: "Size" },
                { key: "date", label: "Date", cellClass: () => "dim" },
              ]}
              rows={trades.map(tradeView)}
            />
          </Section>
        )}
        <Section id="add">
          <QuickAdd module={module} busy={busy} run={run} />
        </Section>
        <Section id="actions">
          <div className="ui-controls">
            {(module.actions ?? []).map((a) => (
              <button key={a.skill} type="button" className="ui-btn primary" disabled={busy} onClick={() => void run(a.skill)}>
                {busy ? "Working…" : a.label}
              </button>
            ))}
            <ScheduleToggle module={module} />
          </div>
        </Section>
      </Sections>
    </div>
  );
}
