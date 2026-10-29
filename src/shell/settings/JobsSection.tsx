import { useEffect, useState } from "react";
import { registry } from "../../core/module";
import { getScheduleEnabled, setScheduleEnabled } from "../../core/scheduler";
import { EmptyState, Row } from "../../ui/kit";
import { scheduleRows } from "../settingsLogic";
import { Head, Switch } from "./Switch";

export function JobsSection({ onError }: { onError(e: unknown): void }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const ids = registry.filter((m) => m.schedule);
    Promise.all(ids.map(async (m) => [m.id, await getScheduleEnabled(m.id)] as const))
      .then((e) => setEnabled(Object.fromEntries(e)))
      .catch(onError)
      .finally(() => setReady(true));
  }, []);
  const toggle = async (id: string, next: boolean) => {
    const m = registry.find((x) => x.id === id);
    if (!m) return;
    try {
      await setScheduleEnabled(m, next);
      setEnabled((e) => ({ ...e, [id]: next }));
    } catch (e) { onError(e); }
  };
  const rows = scheduleRows(registry, enabled);
  return (
    <section className="st-section" aria-label="Background jobs">
      <Head>Background jobs</Head>
      <p className="ui-meta">Nothing runs in the background until you switch it on.</p>
      {rows.length === 0 && <EmptyState title="No module has a background job" />}
      {rows.map((r) => (
        <Row key={r.id} end={<span className="ui-meta">every {r.everyMinutes} min</span>}>
          <Switch checked={r.enabled} disabled={!ready} onChange={(n) => toggle(r.id, n)}>{r.name}</Switch>
        </Row>
      ))}
    </section>
  );
}
