// Pure: which panel tabs to show. A tab is a group of customize section ids;
// it is visible when any of its sections is (everything when there is no view).
export type TabDef = { id: string; label: string; sections: string[] };

export function visibleTabs(tabs: TabDef[], visibleIds: string[] | null): TabDef[] {
  if (visibleIds === null) return tabs;
  const out = tabs.filter((t) => t.sections.some((s) => visibleIds.includes(s)));
  return out.length ? out : tabs.slice(0, 1);
}

/** Active tab id, falling back to the first visible one. */
export const pickTab = (tabs: TabDef[], want: string): string => (tabs.some((t) => t.id === want) ? want : tabs[0]?.id ?? "");
