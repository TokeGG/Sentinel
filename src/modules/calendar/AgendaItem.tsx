import { ConfirmButton } from "../../ui/ConfirmButton";
import type { ModuleRow } from "../../ui/useModule";
import { itemTitle, overdueText, sourceTag, timeText } from "./panelLogic";

type Run = (skill: string, args?: Record<string, unknown>) => Promise<unknown>;

/** One agenda row. Rows from the calendar's own table (`itemId`) get complete / edit / delete. */
export function AgendaItem({ r, overdue, now, busy, run, onEdit }: { r: ModuleRow; overdue?: boolean; now: Date; busy: boolean; run: Run; onEdit(r: ModuleRow): void }) {
  const own = typeof r.itemId === "number";
  return (
    <li className={`cal-item${overdue ? " overdue" : ""}`}>
      {own && r.kind === "task" ? (
        <input type="checkbox" className="cal-check" aria-label="Done" checked={r.done === true} disabled={busy} onChange={() => void run("toggle_done", { id: r.itemId })} />
      ) : (
        <span className="cal-time">{overdue ? "!" : timeText(r) || "·"}</span>
      )}
      <span className="cal-text" title={itemTitle(r)}>
        {itemTitle(r)}
        {overdue && <small>{overdueText(r, now)}</small>}
      </span>
      {own && (
        <span className="cal-acts">
          <button type="button" className="ui-btn ui-sm" disabled={busy} onClick={() => onEdit(r)}>Edit</button>
          <ConfirmButton label="Delete" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void run("delete_item", { id: r.itemId })} />
        </span>
      )}
      <span className="cal-src">{sourceTag(r)}</span>
    </li>
  );
}
