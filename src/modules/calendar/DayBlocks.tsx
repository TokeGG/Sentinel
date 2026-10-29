// Time-blocking for one day: add HH:MM-HH:MM blocks (no overlaps), list, delete.
import { useState } from "react";
import { ErrorLine, Row } from "../../ui/kit";
import { useStore } from "../../ui/useStore";
import { addBlock, deleteBlock, listBlocks } from "./extraStore";
import { blockError, blockedMinutes, fmtMin, toMin } from "./views";

export function DayBlocks({ day }: { day: string }) {
  const s = useStore(listBlocks, []);
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("10:00");
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const mine = s.data.filter((b) => b.day === day);
  const add = () => {
    const b = { day, start_min: toMin(from) ?? -1, end_min: toMin(to) ?? -1, title: title.trim() };
    const e = blockError(b, s.data);
    setErr(e);
    if (!e) void s.act(async () => { await addBlock(b); setTitle(""); });
  };
  return (
    <div className="cal-blocks">
      <h3 className="cal-day">Time blocks · {Math.round(blockedMinutes(s.data, day) / 6) / 10} h</h3>
      <form className="cal-fields" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
        <input placeholder="Block title, e.g. Deep work" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit" className="ui-btn" disabled={s.busy}>Add block</button>
      </form>
      {(err || s.error) && <ErrorLine message={err ?? s.error!} onDismiss={() => setErr(null)} />}
      {mine.map((b) => (
        <Row key={b.id} end={<button type="button" className="ui-btn ui-sm" onClick={() => void s.act(() => deleteBlock(b.id))}>Remove</button>}>
          <span className="cal-time">{fmtMin(b.start_min)}</span> <span className="cal-time">{fmtMin(b.end_min)}</span> {b.title}
        </Row>
      ))}
    </div>
  );
}
