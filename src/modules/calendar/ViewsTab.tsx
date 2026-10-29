// Month / Week / Day / Agenda views. Own items are draggable onto a day (move_item keeps the time).
import { useState, type DragEvent } from "react";
import { Tabs } from "../../ui/kit";
import type { ModuleRow, ModuleState } from "../../ui/useModule";
import { DayBlocks } from "./DayBlocks";
import { monthGrid } from "./monthGridLogic";
import { dayKey, dayLabel, groupByDay, itemTitle, rowDate, timeText } from "./panelLogic";
import { rowsOn, shiftAnchor, VIEW_MODES, weekOf, type ViewMode } from "./views";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Chip({ r }: { r: ModuleRow }) {
  const id = r.itemId;
  return (
    <span className="cal-chip" draggable={id != null} title={id != null ? "Drag to another day" : String(r.source ?? "")}
      onDragStart={(e) => id != null && e.dataTransfer.setData("text/x-cal-item", String(id))}>
      {timeText(r) && <b>{timeText(r)} </b>}{itemTitle(r)}
    </span>
  );
}

export function ViewsTab({ rows, busy, run }: { rows: ModuleRow[]; busy: boolean; run: ModuleState["run"] }) {
  const [mode, setMode] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const now = new Date();
  const drop = (day: string) => ({
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => { e.preventDefault(); const id = e.dataTransfer.getData("text/x-cal-item"); if (id && !busy) void run("move_item", { id, day }); },
  });
  const unscheduled = rows.filter((r) => r.kind === "task" && !r.due && !r.done);
  const cell = (d: Date, cls = "") => {
    const k = dayKey(d)!;
    return (
      <div key={k} className={`cal-vcell ${cls}${k === dayKey(now) ? " today" : ""}`} {...drop(k)}>
        <button type="button" className="cal-vday" onClick={() => { setAnchor(d); setMode("day"); }}>{d.getDate()}</button>
        {rowsOn(rows, k).slice(0, 4).map((r) => <Chip key={String(r.id)} r={r} />)}
      </div>
    );
  };
  const title = mode === "month" ? monthGrid([], anchor).title : mode === "day" ? dayLabel(anchor, now) : `Week of ${dayLabel(weekOf(anchor)[0], now)}`;
  return (
    <div className="cal-views">
      <div className="ui-controls">
        <Tabs tabs={VIEW_MODES.map((m) => ({ id: m, label: m[0].toUpperCase() + m.slice(1) }))} active={mode} onChange={(m) => setMode(m as ViewMode)} />
        <button type="button" className="ui-btn ui-sm" onClick={() => setAnchor(shiftAnchor(anchor, mode, -1))}>Prev</button>
        <button type="button" className="ui-btn ui-sm" onClick={() => setAnchor(new Date())}>Today</button>
        <button type="button" className="ui-btn ui-sm" onClick={() => setAnchor(shiftAnchor(anchor, mode, 1))}>Next</button>
        <strong>{title}</strong>
      </div>
      {mode === "month" && (
        <div className="cal-vgrid">
          {WEEK.map((w) => <span key={w} className="cal-wd">{w}</span>)}
          {monthGrid([], anchor).cells.map((c) => { const [y, m, d] = c.key.split("-").map(Number); return cell(new Date(y, m - 1, d), c.inMonth ? "" : "out"); })}
        </div>
      )}
      {mode === "week" && <div className="cal-vgrid week">{weekOf(anchor).map((d, i) => <div key={i}><span className="cal-wd">{WEEK[i]}</span>{cell(d)}</div>)}</div>}
      {mode === "day" && (
        <div {...drop(dayKey(anchor)!)}>
          <ul className="cal-list">{rowsOn(rows, dayKey(anchor)!).map((r) => <li key={String(r.id)} className="cal-item"><Chip r={r} /></li>)}</ul>
          <DayBlocks day={dayKey(anchor)!} />
        </div>
      )}
      {mode === "agenda" && groupByDay(rows.filter((r) => { const d = rowDate(r); return !!d && dayKey(d)! >= dayKey(now)!; }), now).slice(0, 21).map((g) => (
        <div key={g.day}><h3 className="cal-day">{g.label}</h3><ul className="cal-list">{g.rows.map((r) => <li key={String(r.id)} className="cal-item"><Chip r={r} /></li>)}</ul></div>
      ))}
      {unscheduled.length > 0 && (
        <div className="cal-unsched"><span className="ui-meta">Unscheduled tasks: drag onto a day</span>{unscheduled.map((r) => <Chip key={String(r.id)} r={r} />)}</div>
      )}
    </div>
  );
}
