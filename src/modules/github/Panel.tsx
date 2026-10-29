import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ModuleManifest } from "../../core/module";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";
import { EmptyState, ErrorLine, Tabs } from "../../ui/kit";
import { Section, Sections, useSections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import { ClonedSection } from "./ClonedSection";
import { TokenField } from "./TokenField";
import { activeTab, repoView, rowsForTab, skillForTab, tabForSkill, type Tab } from "./panelLogic";

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
    <>
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
            <ul className="ui-repos">
              {shown.map((r) => {
                const v = repoView(r);
                return (
                  <li key={String(r.id)} className="ui-repo">
                    <div className="ui-repo-top">
                      {v.link ? (
                        <button type="button" className="ui-link ui-repo-name" title={v.name} onClick={() => void openUrl(v.link!)}>
                          {v.name}
                        </button>
                      ) : (
                        <span className="ui-repo-name">{v.name}</span>
                      )}
                      <span className="ui-stars">★ {v.stars}</span>
                    </div>
                    {v.description && <p className="ui-repo-desc">{v.description}</p>}
                    <div className="ui-tile-foot">
                      {v.language && (
                        <span className="ui-lang">
                          <i style={{ background: v.color ?? undefined }} />
                          {v.language}
                        </span>
                      )}
                      {v.cloned && <span className="ui-cloned">Cloned ✓</span>}
                      <button
                        type="button"
                        className="ui-btn"
                        style={{ marginLeft: "auto" }}
                        disabled={busy}
                        onClick={() => void run(ra.skill, { [ra.argName]: r[ra.fromField] })}
                      >
                        {v.cloned ? "Clone again…" : ra.label}
                      </button>
                    </div>
                  </li>
                );
              })}
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
    </>
  );
}
