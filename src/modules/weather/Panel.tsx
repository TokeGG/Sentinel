import type { ModuleManifest } from "../../core/module";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";
import { EmptyState, ErrorLine } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { QuickAdd } from "../../ui/QuickAdd";
import { Section, Sections, useSections } from "../../ui/useCustomize";
import { useOption } from "../../ui/useOption";
import { useModule } from "../../ui/useModule";
import { placeView, severePlaces, type Units } from "./panelLogic";
import { ForecastStrip } from "./ForecastStrip";
import "./weather.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const units = useOption<string>("units", "°C") as Units;
  const hasAdd = useSections().includes("add");
  const severe = severePlaces(rows);
  return (
    <div className="wx">
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{rows.length}</span>
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="alerts">
          {severe.length > 0 && (
            <div className="ui-banner" role="alert">
              <strong>Severe weather</strong> · {severe.join(", ")}
            </div>
          )}
        </Section>
        <Section id="places">
          {rows.length ? (
            <div className="wx-grid">
              {rows.map((r) => {
                const v = placeView(r, units);
                return (
                  <article key={String(r.id)} className={`wx-card${v.severe ? " severe" : ""}`}>
                    <h3 className="wx-name">{v.name}</h3>
                    <span className="wx-glyph" aria-hidden="true">{v.glyph}</span>
                    <div className="wx-temp">{v.temp}</div>
                    <p className="wx-cond">{v.condition}{v.severe ? " ⚠" : ""}</p>
                    {v.range && <span className="wx-range">{v.range}</span>}
                    <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void run("remove_location", { id: r.id })} />
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No places yet" hint={hasAdd ? "Add a city with the Add place field." : "Re-enable “Add place” in Customize to add a city."} />
          )}
        </Section>
        <Section id="forecast">
          {rows.map((r) => <ForecastStrip key={String(r.id)} row={r} units={units} />)}
        </Section>
        <Section id="add">
          <QuickAdd module={module} busy={busy} run={run} />
        </Section>
        <Section id="actions">
          <div className="ui-controls">
            {(module.actions ?? []).map((a) => (
              <button key={a.skill} type="button" className="ui-btn primary" disabled={busy} onClick={() => void run(a.skill)}>
                {busy ? "Working…" : a.label}
              </button>
            ))}
            <ScheduleToggle module={module} />
          </div>
        </Section>
      </Sections>
    </div>
  );
}
