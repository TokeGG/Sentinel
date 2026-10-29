// Shared body for the RSS-style panels (News, Deals): source chips, an item
// list supplied by the caller, and a fetch/add/auto-refresh status bar.
import { useState, type ReactNode } from "react";
import type { ModuleManifest } from "../../core/module";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";
import { Chip, EmptyState, ErrorLine } from "../../ui/kit";
import { QuickAdd } from "../../ui/QuickAdd";
import { Section, Sections, useSections } from "../../ui/useCustomize";
import { useModule, type ModuleRow, type ModuleState } from "../../ui/useModule";
import { FeedManage } from "./FeedManage";
import { filterBySource, sourcesOf } from "./panelLogic";
import "./news.css";

export function FeedPanel({
  module,
  listId,
  empty,
  list,
  toolbar,
}: {
  module: ModuleManifest;
  listId: string; // the section id of the item list ("headlines" / "deals")
  empty: string;
  list: (rows: ModuleRow[], busy: boolean) => ReactNode;
  toolbar?: (s: { rows: ModuleRow[]; busy: boolean; run: ModuleState["run"] }) => ReactNode; // above the list, always shown
}) {
  const { rows, busy, error, run } = useModule(module);
  const [source, setSource] = useState<string | null>(null);
  const hasAdd = useSections().includes("add") || !module.customize;
  const sources = sourcesOf(rows);
  const shown = filterBySource(rows, sources.includes(source ?? "") ? source : null);
  return (
    <div className={`feed feed-${listId}`}>
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{rows.length}</span>
      </h2>
      <Sections className="feed-sections">
        <Section id="add">
          <QuickAdd module={module} busy={busy} run={run} />
        </Section>
        <Section id="filters">
          <div className="ui-chips">
            <Chip on={source === null} onClick={() => setSource(null)}>All</Chip>
            {sources.map((s) => (
              <Chip key={s} on={source === s} onClick={() => setSource(s)}>{s}</Chip>
            ))}
          </div>
        </Section>
        <Section id={listId}>
          {toolbar?.({ rows, busy, run })}
          {error && !rows.length && <ErrorLine message={error} />}
          {shown.length ? list(shown, busy) : <EmptyState title={empty} hint={hasAdd ? "Add a feed to get started." : "Add a feed to get started (re-enable “Add feed” in Customize)."} />}
        </Section>
        <Section id="status">
          <div className="ui-controls">
            {(module.actions ?? []).map((a) => (
              <button key={a.skill} type="button" className="ui-btn primary" disabled={busy} onClick={() => void run(a.skill)}>
                {busy ? "Working…" : a.label}
              </button>
            ))}
            <ScheduleToggle module={module} />
          </div>
          <FeedManage module={module} busy={busy} run={run} version={rows} />
        </Section>
      </Sections>
    </div>
  );
}
