// Two-step destructive button: first click asks "Sure?", second click confirms.
// Nothing is deleted by one click (preview-before-apply rule).
import { useState } from "react";

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
  if (!asking)
    return (
      <button type="button" className={`${className} ui-del`} disabled={disabled} title={title} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  return (
    <span className="ui-confirm" role="alertdialog" aria-label={`Confirm: ${label}`}>
      <span>Sure?</span>
      <button type="button" className="ui-btn ui-danger" onClick={() => { setAsking(false); onConfirm(); }}>Yes</button>
      <button type="button" className="ui-btn" onClick={() => setAsking(false)}>No</button>
    </span>
  );
}
