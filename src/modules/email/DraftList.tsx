import { ConfirmButton } from "../../ui/ConfirmButton";
import { useUiDefaults } from "../../shell/desk/useUiDefaults";
import { draftTitle, type StoredDraft } from "./mailExtras";
import { dateLabel, previewLine } from "./panelLogic";

/** Local drafts (autosaved while composing). */
export function DraftList({ drafts, onOpen, onDelete }: { drafts: StoredDraft[]; onOpen: (d: StoredDraft) => void; onDelete: (id: string) => void }) {
  const { clock } = useUiDefaults();
  return (
    <div className="mail-list">
      {!drafts.length && <div className="mail-empty">No drafts. Anything you type in Compose is saved here automatically.</div>}
      <ul>{drafts.map((d) => (
        <li key={d.id}>
          <button type="button" className="mail-item" onClick={() => onOpen(d)}>
            <span className="mail-text-col">
              <span className="mail-top"><b>{draftTitle(d)}</b><time>{dateLabel(d.updatedAt, undefined, clock)}</time></span>
              <span className="mail-prev">{previewLine(d.body)}</span>
            </span>
          </button>
          <ConfirmButton label="Delete" onConfirm={() => onDelete(d.id)} />
        </li>
      ))}</ul>
    </div>
  );
}
