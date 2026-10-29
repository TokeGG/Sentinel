// One unfiled note in the Inbox tab: file-to chips, free-text folder, delete.
import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import type { ModuleState } from "../../ui/useModule";
import { rowAge } from "../news/panelLogic";

const TARGETS = ["Work", "Ideas", "Later"];

export function NoteTile({ note, busy, run }: { note: Record<string, unknown>; busy: boolean; run: ModuleState["run"] }) {
  const [text, setText] = useState("");
  const file = (to: string) => to.trim() && void run("file_note", { id: note.id, filed_to: to.trim() });
  return (
    <article className="nt-note">
      <p className="nt-body">{String(note.body)}</p>
      <div className="nt-foot">
        <span className="ui-meta">{rowAge(note)}</span>
        <span className="nt-file">File to</span>
        {TARGETS.map((t) => (
          <button key={t} type="button" className="kit-chip" disabled={busy} onClick={() => file(t)}>{t}</button>
        ))}
        <input
          className="ui-file-text"
          value={text}
          placeholder="file to…"
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && file(text)}
        />
        <ConfirmButton label="Delete" disabled={busy} onConfirm={() => void run("delete_note", { id: note.id })} />
      </div>
    </article>
  );
}

