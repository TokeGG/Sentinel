import { useState } from "react";
import { meetingBody, stampLine } from "./prod";
import { createNote } from "./store";

/** Timestamped meeting notes: Start, type lines (each gets [hh:mm:ss] from the start), Save as a note. */
export function MeetingTab({ onSaved }: { onSaved(id: number): void }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState<number | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const save = async () => {
    try { const id = await createNote(meetingBody(title, new Date(start!).toISOString(), lines), "Meetings"); setStart(null); setLines([]); setTitle(""); onSaved(id); } catch (e) { setErr(String(e)); }
  };
  return (
    <div className="nt-meeting">
      {err && <div className="ui-error">{err}</div>}
      <input placeholder="Meeting title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Meeting title" />
      {start === null ? <button type="button" className="ui-btn primary" onClick={() => setStart(Date.now())}>Start meeting</button> : (
        <>
          <form onSubmit={(e) => { e.preventDefault(); setLines([...lines, stampLine(start, Date.now(), text)]); setText(""); }}>
            <input placeholder="Type a note, Enter to stamp it" value={text} onChange={(e) => setText(e.target.value)} aria-label="Meeting note" autoFocus />
          </form>
          <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          <button type="button" className="ui-btn primary" disabled={!lines.length} onClick={() => void save()}>Save as note</button>
        </>
      )}
    </div>
  );
}
