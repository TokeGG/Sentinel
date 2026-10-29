// Panel context + the sections contract for custom panels.
//
// PanelRoute provides PanelContext (the active view and a status reporter).
// A custom panel opts into user show/hide/reorder of its declared sections
// (manifest.customize.sections) in one of two ways:
//
//   1. Simplest — wrap each part in <Section id> inside <Sections>:
//        <Sections>
//          <Section id="gauges"><Gauges /></Section>
//          <Section id="list"><List /></Section>
//        </Sections>
//      A hidden section renders nothing; visible ones get CSS `order` from
//      the view, so <Sections> (a flex column) shows them in the saved order.
//      A <Section> must be a direct child of <Sections> (or any flex/grid box).
//
//   2. Full control — map the ordered visible ids yourself:
//        const ids = useSections();
//        return ids.map((id) => <Fragment key={id}>{parts[id]}</Fragment>);
//
// Outside a panel (no view in context) every section renders, in source order.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { View } from "./prefs";
import { EmptyState } from "./kit/EmptyState";
import { noneVisible, orderedVisible } from "./sections";

export type PanelStatus = { updated: Date | null; error: string | null };
export type PanelCtx = { view: View | null; onStatus?(s: PanelStatus): void };

export const PanelContext = createContext<PanelCtx>({ view: null });

/** Visible section ids in the active view's order ([] outside a panel). */
export function useSections(): string[] {
  const { view } = useContext(PanelContext);
  return useMemo(() => orderedVisible(view), [view]);
}

export function Sections({ className, children }: { className?: string; children?: ReactNode }) {
  const { view } = useContext(PanelContext);
  if (noneVisible(view)) {
    return <EmptyState title="Everything is hidden" hint="Open Customize (the ⚙ in the title bar) to choose what to show." />;
  }
  return <div className={`ui-sections ${className ?? ""}`.trim()}>{children}</div>;
}

export function Section({ id, children }: { id: string; children?: ReactNode }) {
  const { view } = useContext(PanelContext);
  const ids = useSections();
  if (!view) return <div className="ui-section" data-section={id}>{children}</div>;
  const order = ids.indexOf(id);
  if (order < 0) return null;
  return (
    <div className="ui-section" data-section={id} style={{ order }}>
      {children}
    </div>
  );
}
