import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";
import { EmptyState, ErrorLine, Row, Tile, ago } from "../../ui/kit";
import { utcDate } from "../../ui/kit/format";
import { QuickAdd } from "../../ui/QuickAdd";
import { Section, Sections, useSections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import { dedupeConsecutive, previewText, splitRows } from "./panelLogic";

// Clipboard text is sensitive: previews are shown in the page only (never in a
// title attribute) and a row expands on click. Nothing is logged or sent here.
export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const ids = useSections();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<string | null>(null);
  const { launch, clips } = splitRows(rows);
  const history = dedupeConsecutive(clips);
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const controls = (
    <div className="ui-controls">
      <ScheduleToggle module={module} />
      <button
        type="button"
        className="ui-btn"
        disabled={busy}
        onClick={async () => {
          const out = (await run("check_clipboard")) as { captured?: boolean } | undefined;
          if (out) setChecked(out.captured ? "Captured new text" : "Nothing new");
        }}
      >
        Check now
      </button>
      {checked && <span className="ui-meta" role="status">{checked}</span>}
    </div>
  );
  return (
    <>
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{history.length}</span>
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="launcher">
          <div className="ui-launch">
            {launch.map((l) => (
              <button key={l.id} type="button" className="ui-launch-item" disabled={busy} onClick={() => void run("launch_item", { path: l.path })}>
                <span className="ui-launch-glyph" aria-hidden="true">{l.glyph}</span>
                <span className="ui-launch-name">{l.label}</span>
              </button>
            ))}
            {launch.length === 0 && <EmptyState title="No shortcuts yet" hint={'Add one as "Label|C:\\path\\to\\app.exe".'} />}
          </div>
          <QuickAdd module={module} busy={busy} run={run} />
        </Section>
        <Section id="history">
          <Tile title="Clipboard history">
            {!ids.includes("status") && controls}
            {history.length === 0 ? (
              <EmptyState
                title="Nothing captured yet"
                hint={`Capture is off until you switch on "Auto-refresh every ${module.schedule?.intervalMinutes ?? 1} min" or use Check now.`}
              />
            ) : (
              <div className="ui-list">
                {history.map((c) => (
                  <Row key={c.id} end={<span className="ui-meta">{c.copiedAt ? ago(utcDate(c.copiedAt)) : ""}</span>}>
                    <button
                      type="button"
                      className={open.has(c.id) ? "ui-link ui-reveal open" : "ui-link ui-reveal"}
                      aria-expanded={open.has(c.id)}
                      onClick={() => toggle(c.id)}
                    >
                      {open.has(c.id) ? c.text : previewText(c.text, 48)}
                    </button>
                    {open.has(c.id) && <span className="ui-meta ui-note">Shows at most the first 140 characters stored.</span>}
                  </Row>
                ))}
              </div>
            )}
          </Tile>
        </Section>
        <Section id="status">
          {controls}
        </Section>
      </Sections>
    </>
  );
}
