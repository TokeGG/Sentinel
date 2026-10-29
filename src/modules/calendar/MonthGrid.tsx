// Compact month view: today ringed, a dot per day with items (red when overdue).
import type { ModuleRow } from "../../ui/useModule";
import { monthGrid } from "./monthGrid";

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

export function MonthGrid({ rows, now }: { rows: ModuleRow[]; now: Date }) {
  const g = monthGrid(rows, now);
  return (
    <div className="cal-month" role="grid" aria-label={g.title}>
      <h3 className="cal-title">{g.title}</h3>
      <div className="cal-grid">
        {WEEK.map((w, i) => <span key={i} className="cal-wd">{w}</span>)}
        {g.cells.map((c) => (
          <span
            key={c.key}
            role="gridcell"
            className={`cal-cell${c.inMonth ? "" : " out"}${c.today ? " today" : ""}${c.count ? " has" : ""}${c.overdue ? " late" : ""}`}
            title={c.count ? `${c.count} item${c.count === 1 ? "" : "s"}` : undefined}
          >
            {c.day}
            {c.count > 0 && <i />}
          </span>
        ))}
      </div>
    </div>
  );
}
