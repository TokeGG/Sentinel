import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { EmptyState, ErrorLine } from "../../ui/kit";
import { Section, Sections } from "../../ui/useCustomize";
import { useModule, type ModuleRow } from "../../ui/useModule";
import { AgendaItem } from "./AgendaItem";
import { IcsTools } from "./IcsTools";
import { ItemForm } from "./ItemForm";
import { MonthGrid } from "./MonthGrid";
import { TasksList } from "./TasksList";
import "./calendar.css";
import { bucketRows } from "./panelLogic";
import { agendaRows } from "./taskLogic";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, error, busy, run } = useModule(module);
  const [editing, setEditing] = useState<ModuleRow | null>(null);
  const now = new Date();
  const agenda = agendaRows(rows);
  const b = bucketRows(agenda, now);
  const item = (r: ModuleRow, overdue?: boolean) => (
    <AgendaItem key={String(r.id)} r={r} overdue={overdue} now={now} busy={busy} run={run} onEdit={setEditing} />
  );
  return (
    <div className="cal-root">
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{agenda.length}</span>
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="add">
          <ItemForm key={editing ? String(editing.itemId) : "new"} editing={editing} busy={busy} run={run} onDone={() => setEditing(null)} />
        </Section>
        <Section id="overdue">
          <h3 className="cal-day bad">Overdue / unfiled · {b.overdue.length}</h3>
          {b.overdue.length ? (
            <ul className="cal-list">{b.overdue.map((r) => item(r, true))}</ul>
          ) : (
            <span className="ui-meta">Nothing overdue or unfiled.</span>
          )}
        </Section>
        <Section id="today">
          <h3 className="cal-day">Today</h3>
          {b.today.length ? <ul className="cal-list">{b.today.map((r) => item(r))}</ul> : <EmptyState title="Nothing dated today" />}
        </Section>
        <Section id="week">
          <div className="cal-week">
            <MonthGrid rows={agenda} now={now} />
            <div className="cal-days">
              {b.week.length ? (
                b.week.map((g) => (
                  <div key={g.day}>
                    <h3 className="cal-day">{g.label}</h3>
                    <ul className="cal-list">{g.rows.map((r) => item(r))}</ul>
                  </div>
                ))
              ) : (
                <EmptyState title="Nothing else this week" hint="Shows the six days before and after today." />
              )}
              {b.older > 0 && <span className="ui-meta">{b.older} older or later {b.older === 1 ? "item" : "items"} not shown</span>}
            </div>
          </div>
        </Section>
        <Section id="tasks">
          <h3 className="cal-day">Tasks</h3>
          <TasksList rows={rows} now={now} busy={busy} run={run} onEdit={setEditing} />
        </Section>
        <Section id="ics">
          <h3 className="cal-day">Import / export</h3>
          <IcsTools busy={busy} run={run} />
        </Section>
      </Sections>
    </div>
  );
}
