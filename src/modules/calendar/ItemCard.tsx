// Detail card for any calendar entry (agenda, month/week/day chips, tasks, time blocks):
// shows when/repeat/notes/links; own items can be edited, completed and deleted (confirm).
import { createContext, useEffect, useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { openLink } from "../../ui/openLink";
import type { ModuleRow } from "../../ui/useModule";
import { ItemForm } from "./ItemForm";
import { dealLinkOf } from "./dealLink";
import { extractLinks } from "./links";
import { itemTitle, rowDate, sourceTag } from "./panelLogic";
import { repeatOf } from "./recur";

type Run = (skill: string, args?: Record<string, unknown>) => Promise<unknown>;
export interface CardSubject { r: ModuleRow; when?: string; onDelete?: () => unknown }
/** Any calendar component calls this to open the card. */
export const CardCtx = createContext<(s: CardSubject) => void>(() => {});

export function ItemCard({ s, busy, run, onClose }: { s: CardSubject; busy: boolean; run: Run; onClose(): void }) {
  const [edit, setEdit] = useState(false);
  const { r } = s;
  const own = typeof r.itemId === "number";
  const d = rowDate(r);
  const rep = repeatOf(r.rrule as string | undefined);
  const deal = dealLinkOf(r);
  const links = extractLinks(itemTitle(r), r.notes, r.url, r.link).filter((u) => u !== deal);
  const act = (skill: string) => void run(skill, { id: r.itemId }).then((v) => v !== undefined && onClose());
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="cal-card-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cal-card" role="dialog" aria-label={itemTitle(r)}>
        <h3>{itemTitle(r)}</h3>
        <p className="ui-meta">
          {s.when ?? (d ? (r.allDay === true ? d.toLocaleDateString() : d.toLocaleString()) : "No date")}
          {rep !== "none" ? ` · repeats ${rep}` : ""} · {r.kind === "task" ? "Task" : r.holiday === true ? "Holiday" : "Event"} · {sourceTag(r)}{r.done === true ? " · done" : ""}
        </p>
        {typeof r.notes === "string" && r.notes.trim() && <p className="cal-card-notes">{r.notes}</p>}
        {deal && <button type="button" className="ui-btn primary" title={deal} onClick={() => void openLink(deal)}>Open deal</button>}
        {links.length > 0 && <ul className="cal-card-links">{links.map((u) => (
          <li key={u}><button type="button" className="ui-link" title={u} onClick={() => void openLink(u)}>{u}</button></li>))}</ul>}
        {edit && own ? (
          <ItemForm editing={r} busy={busy} run={run} onDone={onClose} />
        ) : (
          <div className="ui-controls">
            {own && r.kind === "task" && <button type="button" className="ui-btn" disabled={busy} onClick={() => act("toggle_done")}>{r.done === true ? "Not done" : "Done"}</button>}
            {own && <button type="button" className="ui-btn" disabled={busy} onClick={() => setEdit(true)}>Edit</button>}
            {(own || s.onDelete) && <ConfirmButton label="Delete" disabled={busy} onConfirm={() => (s.onDelete ? void Promise.resolve(s.onDelete()).then(onClose) : act("delete_item"))} />}
            <button type="button" className="ui-btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
