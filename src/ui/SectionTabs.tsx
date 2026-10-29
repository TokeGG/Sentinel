// Tab bar for a custom panel whose tabs are groups of customize sections.
import { useContext, useState, type ReactElement } from "react";
import { Tabs } from "./kit";
import { PanelContext, useSections } from "./Section";
import { pickTab, visibleTabs, type TabDef } from "./sectionTabsLogic";

export function useSectionTabs(defs: TabDef[], first = defs[0].id): [string, ReactElement, (id: string) => void] {
  const { view } = useContext(PanelContext);
  const ids = useSections();
  const [want, setWant] = useState(first);
  const tabs = visibleTabs(defs, view ? ids : null);
  const tab = pickTab(tabs, want);
  return [tab, <Tabs key="tabs" tabs={tabs} active={tab} onChange={setWant} />, setWant];
}
