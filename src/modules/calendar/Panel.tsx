import type { ModuleManifest } from "../../core/module";
import { EmptyState, ErrorLine } from "../../ui/kit";
import { Section, Sections } from "../../ui/useCustomize";
import { useModule, type ModuleRow } from "../../ui/useModule";
import { MonthGrid } from "./MonthGrid";
import "./calendar.css";
import { bucketRows, itemTitle, overdueText, sourceTag, timeText } from "./panelLogic";

function Item({ r, overdue, now }: { r: ModuleRow; overdue?: boolean; now: Date }) {
  return (
    <li className={`cal-item${overdue ? " overdue" : ""}`}>
      <span className="cal-time">{overdue ? "!" : timeText(r) || "·"}</span>
      <span className="cal-text" title={itemTitle(r)}>
        {itemTitle(r)}
        {overdue && <small>{overdueText(r, now)}</small>}
      </span>
      <span className="cal-src">{sourceTag(r)}</span>
    </li>
  );
}

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, error } = useModule(module);
  const now = new Date();
  const b = bucketRows(rows, now);
  return (
    <div className="cal-root">
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{rows.length}</span>
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="overdue">
          <h3 className="cal-day bad">Overdue / unfiled · {b.overdue.length}</h3>
          {b.overdue.length ? (
            <ul className="cal-list">
              {b.overdue.map((r) => <Item key={String(r.id)} r={r} overdue now={now} />)}
            </ul>
          ) : (
            <span className="ui-meta">Nothing overdue or unfiled.</span>
          )}
        </Section>
        <Section id="today">
          <h3 className="cal-day">Today</h3>
          {b.today.length ? (
            <ul className="cal-list">{b.today.map((r) => <Item key={String(r.id)} r={r} now={now} />)}</ul>
          ) : (
            <EmptyState title="Nothing dated today" />
          )}
        </Section>
        <Section id="week">
          <div className="cal-week">
            <MonthGrid rows={rows} now={now} />
            <div className="cal-days">
              {b.week.length ? (
                b.week.map((g) => (
                  <div key={g.day}>
                    <h3 className="cal-day">{g.label}</h3>
                    <ul className="cal-list">{g.rows.map((r) => <Item key={String(r.id)} r={r} now={now} />)}</ul>
                  </div>
                ))
              ) : (
                <EmptyState title="Nothing else this week" hint="Shows the six days before and after today." />
              )}
              {b.older > 0 && <span className="ui-meta">{b.older} older or later {b.older === 1 ? "item" : "items"} not shown</span>}
            </div>
          </div>
        </Section>
      </Sections>
    </div>
  );
}
