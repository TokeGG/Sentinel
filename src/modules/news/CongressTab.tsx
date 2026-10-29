// News > Congress tab: the Congress panel (GovTrack bills, votes, members, follows, my reps) rendered with
// its own (unregistered) manifest. No view in context = every Congress section shows, in source order.
import { lazy, Suspense } from "react";
import { congressModule } from "../congress/index";
import { PanelContext } from "../../ui/Section";

const CongressPanel = lazy(() => import("../congress/Panel"));

export function CongressTab() {
  return (
    <PanelContext.Provider value={{ view: null }}>
      <Suspense fallback={<p className="ui-meta">Loading Congress…</p>}>
        <CongressPanel module={congressModule} />
      </Suspense>
    </PanelContext.Provider>
  );
}
