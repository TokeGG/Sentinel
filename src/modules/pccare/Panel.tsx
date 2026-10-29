import { useRef } from "react";
import type { ModuleManifest } from "../../core/module";
import { EmptyState, ErrorLine, Gauge, Tile } from "../../ui/kit";
import { Section, Sections } from "../../ui/useCustomize";
import { useOption } from "../../ui/useOption";
import { useModule } from "../../ui/useModule";
import { pctOf, previewSummary, splitRows, usageText } from "./panelLogic";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const warnAt = useOption("warnAt", 85);
  const now = splitRows(rows);
  // Preview mode replaces the metrics rows; keep showing the last metrics.
  const last = useRef(now);
  if (now.hasMetrics) last.current = now;
  const m = last.current;
  const sum = previewSummary(now.files);
  return (
    <>
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="gauges">
          {m.cpu === null && !m.ram ? (
            <EmptyState title="No metrics yet" hint="Use Refresh to read CPU and RAM." />
          ) : (
            <div className="ui-gauges">
              {m.cpu !== null && <Gauge label="CPU" value={m.cpu} warnAt={warnAt} />}
              {m.ram && (
                <Gauge
                  label={`RAM · ${usageText(m.ram.used, m.ram.total, "mb")}`}
                  value={pctOf(m.ram.used, m.ram.total)}
                  warnAt={warnAt}
                />
              )}
            </div>
          )}
        </Section>
        <Section id="disks">
          <div className="ui-disks">
            {m.disks.map((d) => (
              <Gauge key={d.mount} label={`${d.mount} · ${usageText(d.used, d.total, "gb")}`} value={pctOf(d.used, d.total)} warnAt={warnAt} />
            ))}
            {m.disks.length === 0 && <EmptyState title="No drives reported" />}
          </div>
        </Section>
        <Section id="cleanup">
          <Tile title="Temp cleanup">
            <div className="ui-actions">
              <button type="button" className="ui-btn" disabled={busy} onClick={() => void run("preview_cleanup")}>
                Preview temp cleanup
              </button>
              <button
                type="button"
                className="ui-btn primary"
                disabled={busy || now.files.length === 0}
                onClick={() => void run("apply_cleanup")}
              >
                Apply cleanup
              </button>
              <span className="ui-meta">{now.previewed ? sum.text : "Preview first — nothing is deleted until you apply."}</span>
            </div>
            {now.files.length > 0 && (
              <div className="ui-files" aria-label="Files that will be deleted">
                {now.files.map((f) => (
                  <div key={f.path} title={f.path}>{f.path}</div>
                ))}
              </div>
            )}
          </Tile>
        </Section>
        <Section id="actions">
          <div className="ui-actions">
            <button type="button" className="ui-btn primary" disabled={busy} onClick={() => void run("get_metrics")}>
              {busy ? "Working…" : "Refresh"}
            </button>
          </div>
        </Section>
      </Sections>
    </>
  );
}
