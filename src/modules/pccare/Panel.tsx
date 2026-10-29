import { useRef, type CSSProperties } from "react";
import type { ModuleManifest } from "../../core/module";
import { EmptyState, ErrorLine, Tile, gaugeTone } from "../../ui/kit";
import { Section, Sections } from "../../ui/useCustomize";
import { useOption } from "../../ui/useOption";
import { useModule } from "../../ui/useModule";
import { pctOf, previewSummary, splitRows, usageText } from "./panelLogic";
import { ToolsSection } from "./tools/ToolsSection";
import "./pccare.css";

// Ring (CPU/RAM) or bar (disk) with the tone from the shared gauge thresholds.
function Meter({ label, value, sub, warnAt, ring }: { label: string; value: number; sub?: string; warnAt: number; ring?: boolean }) {
  const tone = gaugeTone(value, 100, warnAt);
  return (
    <div className={`pc-meter ${tone} ${ring ? "ring" : "bar"}`} style={{ "--p": Math.min(100, Math.max(0, value)) } as CSSProperties}>
      <div className="pc-meter-viz" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        {ring ? <b>{Math.round(value)}%</b> : <i />}
      </div>
      <div className="pc-meter-txt">
        <span className="pc-label">{label}</span>
        {sub && <span className="pc-sub">{sub}</span>}
        {!ring && <span className="pc-pct">{Math.round(value)}%</span>}
      </div>
    </div>
  );
}

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
    <div className="pc">
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
            <div className="pc-rings">
              {m.cpu !== null && <Meter ring label="CPU" value={m.cpu} warnAt={warnAt} />}
              {m.ram && (
                <Meter ring label="RAM" sub={usageText(m.ram.used, m.ram.total, "mb")} value={pctOf(m.ram.used, m.ram.total)} warnAt={warnAt} />
              )}
            </div>
          )}
        </Section>
        <Section id="disks">
          <div className="pc-disks">
            {m.disks.map((d) => (
              <Meter key={d.mount} label={d.mount} sub={usageText(d.used, d.total, "gb")} value={pctOf(d.used, d.total)} warnAt={warnAt} />
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
        <Section id="tools">
          <ToolsSection />
        </Section>
        <Section id="actions">
          <div className="ui-actions">
            <button type="button" className="ui-btn primary" disabled={busy} onClick={() => void run("get_metrics")}>
              {busy ? "Working…" : "Refresh"}
            </button>
          </div>
        </Section>
      </Sections>
    </div>
  );
}
