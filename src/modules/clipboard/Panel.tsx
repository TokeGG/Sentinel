import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";
import { EmptyState, ErrorLine, Tile, ago } from "../../ui/kit";
import { utcDate } from "../../ui/kit/format";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { QuickAdd } from "../../ui/QuickAdd";
import { Section, Sections, useSections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import "./clipboard.css";
import { usePins } from "./pins";
import { dedupeConsecutive, pinFirst, previewText, splitRows } from "./panelLogic";

// Clipboard text is sensitive: previews are shown in the page only (never in a
// title attribute) and a row expands on click. Nothing is logged or sent here.
export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const ids = useSections();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<string | null>(null);
  const { launch, clips } = splitRows(rows);
  const [pins, togglePin] = usePins(rows, run);
  const history = pinFirst(dedupeConsecutive(clips), pins);
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const controls = (
    <div className="clip-controls">
      <ScheduleToggle module={module} />
      <button
        type="button"
        className="ui-btn sm"
        disabled={busy}
        onClick={async () => {
          const out = (await run("check_clipboard")) as { captured?: boolean } | undefined;
          if (out) setChecked(out.captured ? "Captured new text" : "Nothing new");
        }}
      >
        Check now
      </button>
      {checked && <span className="ui-meta" role="status">{checked}</span>}
      {history.length > 0 && <ConfirmButton label="Clear all" className="ui-btn sm" disabled={busy} onConfirm={() => void run("clear_clips")} />}
    </div>
  );
  return (
    <div className="clip-root">
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{history.length}</span>
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="launcher">
          <div className="clip-launch">
            {launch.map((l) => (
              <span key={l.id} className="clip-tilewrap">
                <button type="button" className="clip-tile" disabled={busy} onClick={() => void run("launch_item", { path: l.path })}>
                  <span className="clip-glyph" aria-hidden="true">{l.glyph}</span>
                  <span className="clip-name">{l.label}</span>
                </button>
                <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void run("remove_launch", { id: l.id })} />
              </span>
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
              <ul className="clip-list">
                {history.map((c) => (
                  <li key={c.id} className={`clip-item${pins.has(c.id) ? " pinned" : ""}`}>
                    <button
                      type="button"
                      className={open.has(c.id) ? "clip-text open" : "clip-text"}
                      aria-expanded={open.has(c.id)}
                      onClick={() => toggle(c.id)}
                    >
                      {open.has(c.id) ? c.text : previewText(c.text, 64)}
                    </button>
                    <span className="clip-age">{c.copiedAt ? ago(utcDate(c.copiedAt)) : ""}</span>
                    <button
                      type="button"
                      className="clip-pin"
                      aria-pressed={pins.has(c.id)}
                      aria-label={pins.has(c.id) ? "Unpin" : "Pin to top"}
                      title={pins.has(c.id) ? "Unpin" : "Pin to top"}
                      onClick={() => togglePin(c.id)}
                    >
                      {pins.has(c.id) ? "★" : "☆"}
                    </button>
                    <ConfirmButton label="Delete" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void run("delete_clip", { id: c.id })} />
                    {open.has(c.id) && <span className="clip-note">Shows at most the first 140 characters stored.</span>}
                  </li>
                ))}
              </ul>
            )}
          </Tile>
        </Section>
        <Section id="status">
          {controls}
        </Section>
      </Sections>
    </div>
  );
}
