// Pure tab state for the in-app browser. Tab ids are small integers (Rust label `tab<n>`).
export type Tab = { id: number; url: string; title: string; private: boolean; loading: boolean };
export type TabState = { tabs: Tab[]; active: number; next: number };
export type TabAction =
  | { type: "open"; url: string; private?: boolean; background?: boolean }
  | { type: "close"; id: number } | { type: "activate"; id: number }
  | { type: "nav"; id: number; url: string } | { type: "title"; id: number; title: string }
  | { type: "loading"; id: number; on: boolean } | { type: "move"; id: number; to: number };

export const emptyTabs = (): TabState => ({ tabs: [], active: -1, next: 1 });

export function tabsReducer(s: TabState, a: TabAction): TabState {
  switch (a.type) {
    case "open": {
      const t: Tab = { id: s.next, url: a.url, title: "", private: !!a.private, loading: true };
      const at = s.tabs.findIndex((x) => x.id === s.active);
      const tabs = [...s.tabs];
      tabs.splice(at < 0 ? tabs.length : at + 1, 0, t);
      return { tabs, next: s.next + 1, active: a.background && s.active >= 0 ? s.active : t.id };
    }
    case "close": {
      const i = s.tabs.findIndex((x) => x.id === a.id);
      if (i < 0) return s;
      const tabs = s.tabs.filter((x) => x.id !== a.id);
      const active = s.active !== a.id ? s.active : (tabs[Math.min(i, tabs.length - 1)]?.id ?? -1);
      return { ...s, tabs, active };
    }
    case "activate": return s.tabs.some((x) => x.id === a.id) ? { ...s, active: a.id } : s;
    case "nav": return patch(s, a.id, { url: a.url, loading: false });
    case "title": return patch(s, a.id, { title: a.title.slice(0, 300) });
    case "loading": return patch(s, a.id, { loading: a.on });
    case "move": {
      const i = s.tabs.findIndex((x) => x.id === a.id);
      if (i < 0) return s;
      const tabs = [...s.tabs];
      const [t] = tabs.splice(i, 1);
      tabs.splice(Math.max(0, Math.min(a.to, tabs.length)), 0, t);
      return { ...s, tabs };
    }
  }
}
const patch = (s: TabState, id: number, p: Partial<Tab>): TabState =>
  s.tabs.some((t) => t.id === id) ? { ...s, tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...p } : t)) } : s;

/** What survives a panel re-create: non-private tabs only (private tabs never touch storage). */
export function persistable(s: TabState): TabState {
  const tabs = s.tabs.filter((t) => !t.private).map((t) => ({ ...t, loading: false }));
  return { tabs, next: s.next, active: tabs.some((t) => t.id === s.active) ? s.active : (tabs[0]?.id ?? -1) };
}
export function restoreTabs(raw: unknown): TabState {
  const o = raw as Partial<TabState> | null;
  if (!o || !Array.isArray(o.tabs)) return emptyTabs();
  const tabs = o.tabs.filter((t): t is Tab => !!t && Number.isInteger(t.id) && t.id > 0 && typeof t.url === "string" && /^https?:\/\//i.test(t.url))
    .map((t) => ({ id: t.id, url: t.url, title: String(t.title ?? ""), private: false, loading: false })).slice(0, 50);
  const next = Math.max(Number(o.next) || 1, ...tabs.map((t) => t.id + 1));
  return { tabs, next, active: tabs.some((t) => t.id === o.active) ? (o.active as number) : (tabs[0]?.id ?? -1) };
}
