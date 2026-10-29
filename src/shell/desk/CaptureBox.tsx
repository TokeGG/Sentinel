// Quick capture (hub.capture, opened by the opt-in capture hotkey): sends the
// text to whichever module exposes a `capture_note` skill (Notes today).
import { useEffect, useRef, useState } from "react";
import { registry } from "../../core/module";
import { errorText } from "../../ui/moduleRun";
import { closePanel } from "../panelApi";
import { CAPTURE_ID } from "./ids";
import "./desk.css";

const target = () => registry.flatMap((m) => m.skills.filter((s) => s.name === "capture_note").map((s) => ({ m, s })))[0];

export function CaptureBox() {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const t = target();
  const save = async () => {
    if (!t || !text.trim()) return;
    try {
      await t.s.run({ body: text });
      await closePanel(CAPTURE_ID);
    } catch (e) { setMsg(errorText(e)); }
  };
  return (
    <div className="cap">
      <textarea ref={ref} className="cap-in" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a note... (Ctrl+Enter saves)"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save(); if (e.key === "Escape") closePanel(CAPTURE_ID).catch(() => {}); }} />
      {msg && <p className="ui-meta">{msg}</p>}
      <button className="mh-btn" disabled={!t || !text.trim()} onClick={save}>{t ? `Save to ${t.m.name}` : "No module accepts notes"}</button>
    </div>
  );
}
