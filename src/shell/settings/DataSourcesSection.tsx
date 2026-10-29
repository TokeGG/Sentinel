// Settings > Data sources: built-in public APIs per category, off by default. Test runs one request now.
import { useEffect, useState } from "react";
import { CATEGORIES } from "../../core/categories";
import { DATA_SOURCES, sourcesFor } from "../../core/datasources/registry";
import { isEnabled, querySource, setEnabled } from "../../core/datasources/fetch";
import type { DataSource } from "../../core/datasources/types";
import { Row } from "../../ui/kit";
import { Head, Switch } from "./Switch";

export function DataSourcesSection({ onError }: { onError(e: unknown): void }) {
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [test, setTest] = useState<Record<string, string>>({});
  useEffect(() => {
    Promise.all(DATA_SOURCES.map(async (s) => [s.id, await isEnabled(s.id)] as const)).then((r) => setOn(Object.fromEntries(r)), onError);
  }, []);
  const toggle = (s: DataSource, v: boolean) => setEnabled(s.id, v).then(() => setOn((o) => ({ ...o, [s.id]: v })), onError);
  const run = async (s: DataSource) => {
    setTest((t) => ({ ...t, [s.id]: "testing…" }));
    try {
      const rows = await querySource(s, s.sample);
      setTest((t) => ({ ...t, [s.id]: rows.length ? `ok: ${rows.length} rows, e.g. "${rows[0].title.slice(0, 60)}"` : "ok but no rows" }));
    } catch (e) { setTest((t) => ({ ...t, [s.id]: `failed: ${String(e instanceof Error ? e.message : e).slice(0, 120)}` })); }
  };
  return (
    <section className="st-section" aria-label="Data sources">
      <Head>Data sources</Head>
      <p className="ui-meta">Public reference APIs the Ask bars can query (tick "sources" when asking). Nothing is fetched until you enable a source or press Test. Not yet verified against the live services.</p>
      {CATEGORIES.map((c) => (
        <details key={c}>
          <summary>{c} ({sourcesFor(c).length})</summary>
          {sourcesFor(c).map((s) => (
            <div key={s.id} className="st-acct">
              <Row>
                <Switch checked={!!on[s.id]} onChange={(v) => void toggle(s, v)}>{s.name}</Switch>
                <button type="button" className="ui-btn ui-sm" onClick={() => void run(s)}>Test</button>
              </Row>
              <small className="ui-meta">{s.about}{s.keyOptional ? " API key optional." : ""}</small>
              {test[s.id] && <small className="ui-meta">{test[s.id]}</small>}
            </div>
          ))}
        </details>
      ))}
    </section>
  );
}
