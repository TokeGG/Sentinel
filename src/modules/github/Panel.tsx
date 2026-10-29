import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";
import { EmptyState, ErrorLine, Tabs } from "../../ui/kit";
import { Section, Sections, useSections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import { ClonedSection } from "./ClonedSection";
import { TokenField } from "./TokenField";
import "./github.css";
import { RepoCard } from "./RepoCard";
import { activeTab, rowsForTab, skillForTab, tabForSkill, type Tab } from "./panelLogic";

const TABS = [
  { id: "trending", label: "Trending" },
  { id: "starred", label: "Starred" },
];

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const ids = useSections();
  const [chosen, setChosen] = useState<Tab | null>(null);
  const tab = activeTab(chosen, rows);
  const shown = rowsForTab(rows, tab);
  const ra = module.rowAction!;
  // Same as the generic buttons: a tab or button runs its fetch skill.
  const pick = (t: Tab) => {
    setChosen(t);
    if (!rows.some((r) => r.source === t)) void run(skillForTab(t));
  };
  const hint = ids.includes("actions")
    ? "Use a Fetch button to load repositories."
    : ids.includes("tabs")
      ? "Pick a tab to load repositories."
      : "Re-enable “Fetch repos” or the tabs in Customize to load repositories.";
  return (
    <div className="gh-root">
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{shown.length}</span>
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="credentials">
          <TokenField module={module} recheck={busy} />
        </Section>
        <Section id="tabs">
          <Tabs tabs={TABS} active={tab} onChange={(id) => pick(id as Tab)} disabled={busy} />
        </Section>
        <Section id="repos">
          {shown.length ? (
            <ul className="gh-grid">
              {shown.map((r) => (
                <RepoCard key={String(r.id)} r={r} label={ra.label} busy={busy} onClone={() => void run(ra.skill, { [ra.argName]: r[ra.fromField] })} />
              ))}
            </ul>
          ) : (
            <EmptyState title={tab === "starred" ? "No starred repos loaded" : "No repositories yet"} hint={hint} />
          )}
        </Section>
        <Section id="cloned">
          <ClonedSection refresh={busy} />
        </Section>
        <Section id="actions">
          <div className="ui-controls">
            {(module.actions ?? []).map((a) => (
              <button
                key={a.skill}
                type="button"
                className="ui-btn primary"
                disabled={busy}
                onClick={() => {
                  setChosen(tabForSkill(a.skill));
                  void run(a.skill);
                }}
              >
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
