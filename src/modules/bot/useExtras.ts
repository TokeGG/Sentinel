// Data for the Workflows, Jobs, Site notebook and Weekly sections; reload() after any change. Rolls the weekly brain
// snapshot over when it is a week old (on panel open, no timer).
import { useCallback, useEffect, useState } from "react";
import { BROWSER_CLASS } from "./brainSpecs";
import type { Job } from "./jobs";
import { bestVariant } from "./kernel/variants";
import type { SiteNote } from "./siteNotes";
import { loadLearnState } from "./store";
import * as sx from "./storeExtras";
import { snapshotDue, weeklySummary } from "./weekly";
import type { Workflow } from "./workflow";

export function useExtras() {
  const [workflows, setWf] = useState<Workflow[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [runs, setRuns] = useState<sx.JobRun[]>([]);
  const [sites, setSites] = useState<SiteNote[]>([]);
  const [weekly, setWeekly] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const [w, j, r, s] = await Promise.all([sx.listWorkflows(), sx.listJobs(), sx.jobRuns(), sx.siteNotes()]);
      setWf(w); setJobs(j); setRuns(r); setSites(s);
      const now = Date.now(), active = bestVariant((await loadLearnState()).pop).brain;
      let snap = await sx.getSnapshot(BROWSER_CLASS);
      setWeekly(weeklySummary(await sx.weekEpisodes(), now, active, snap, s.length));
      if (snapshotDue(snap, now)) { snap = { at: now, brain: active }; await sx.putSnapshot(BROWSER_CLASS, active, now); }
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => void reload(), [reload]);
  return { workflows, jobs, runs, sites, weekly, error, reload };
}
