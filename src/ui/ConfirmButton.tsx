// Two-step destructive button: first click asks "Sure?", second click confirms.
// Nothing is deleted by one click (preview-before-apply rule). After "Yes" the action
// waits `undo_secs` seconds (Settings > General, default 5, 0 = off) with an Undo button;
// closing the panel during the wait carries the action out.
import { useEffect, useRef, useState } from "react";
import { getSetting } from "./appSetting";

let undoSecs: Promise<number> | null = null;
export const parseUndoSecs = (v: string | null): number => { const n = Number(v ?? 5); return Number.isFinite(n) && n >= 0 && n <= 30 ? Math.floor(n) : 5; };
const loadUndo = () => (undoSecs ??= getSetting("undo_secs").then(parseUndoSecs, () => 5));
export const resetUndoCache = () => void (undoSecs = null);

export function ConfirmButton({
  label,
  onConfirm,
  disabled,
  title,
  className = "ui-btn",
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [left, setLeft] = useState(0);
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => {
      if (left === 1) { const f = pending.current; pending.current = null; f?.(); }
      setLeft(left - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [left]);
  useEffect(() => () => { pending.current?.(); }, []);
  const yes = async () => {
    setAsking(false);
    const secs = await loadUndo();
    if (!secs) return onConfirm();
    pending.current = onConfirm;
    setLeft(secs);
  };
  if (left > 0)
    return (
      <span className="ui-confirm" role="status">
        <span>{label} in {left}s</span>
        <button type="button" className="ui-btn" onClick={() => { pending.current = null; setLeft(0); }}>Undo</button>
      </span>
    );
  if (!asking)
    return (
      <button type="button" className={`${className} ui-del`} disabled={disabled} title={title} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  return (
    <span className="ui-confirm" role="alertdialog" aria-label={`Confirm: ${label}`}>
      <span>Sure?</span>
      <button type="button" className="ui-btn ui-danger" onClick={() => void yes()}>Yes</button>
      <button type="button" className="ui-btn" onClick={() => setAsking(false)}>No</button>
    </span>
  );
}
