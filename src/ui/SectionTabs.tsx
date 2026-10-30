// Tab bar for a custom panel whose tabs are groups of customize sections.
// Opens on the view's "Start on tab" option (ui/numOption startTabOption) when the manifest declares it.
import { useContext, useState, type ReactElement } from "react";
import { Tabs } from "./kit";
import { PanelContext, useSections } from "./Section";
import { pickTab, visibleTabs, type TabDef } from "./sectionTabsLogic";
import { START_TAB } from "./numOption";

export function useSectionTabs(defs: TabDef[], first = defs[0].id): [string, ReactElement, (id: string) => void] {
  const { view } = useContext(PanelContext);
  const ids = useSections();
  const [want, setWant] = useState<string | null>(null);
  const tabs = visibleTabs(defs, view ? ids : null);
  const saved = view?.options[START_TAB];
  const tab = pickTab(tabs, want ?? (typeof saved === "string" ? saved : first));
  return [tab, <Tabs key="tabs" tabs={tabs} active={tab} onChange={setWant} />, setWant];
}
