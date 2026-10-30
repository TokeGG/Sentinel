import { useContext } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { CardCtx } from "./ItemCard";
import { useUiDefaults } from "../../shell/desk/useUiDefaults";
import type { ModuleRow } from "../../ui/useModule";
import { itemTitle, overdueText, sourceTag, timeText } from "./panelLogic";

type Run = (skill: string, args?: Record<string, unknown>) => Promise<unknown>;

/** One agenda row. Rows from the calendar's own table (`itemId`) get complete / edit / delete. */
export function AgendaItem({ r, overdue, now, busy, run, onEdit }: { r: ModuleRow; overdue?: boolean; now: Date; busy: boolean; run: Run; onEdit(r: ModuleRow): void }) {
  const own = typeof r.itemId === "number";
  const open = useContext(CardCtx);
  const { clock } = useUiDefaults();
  return (
    <li className={`cal-item${overdue ? " overdue" : ""}${r.holiday === true ? " hol" : ""}`}>
      {own && r.kind === "task" ? (
        <input type="checkbox" className="cal-check" aria-label="Done" checked={r.done === true} disabled={busy} onChange={() => void run("toggle_done", { id: r.itemId })} />
      ) : (
        <span className="cal-time">{overdue ? "!" : timeText(r, clock) || "·"}</span>
      )}
      <button type="button" className="cal-text cal-open" title={itemTitle(r)} onClick={() => open({ r })}>
        {itemTitle(r)}
        {overdue && <small>{overdueText(r, now)}</small>}
      </button>
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
