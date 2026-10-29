// Mail rules editor (applied to new inbox mail on each refresh).
import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { addRule, removeRule } from "./extrasStore";
import { ruleLabel, type Rule, type RuleAction, type RuleField } from "./rules";
import type { Folder } from "./types";

export function RulesEditor({ rules, folders, onChange, onClose }: { rules: Rule[]; folders: Folder[]; onChange: () => void; onClose: () => void }) {
  const [field, setField] = useState<RuleField>("from");
  const [needle, setNeedle] = useState("");
  const [action, setAction] = useState<RuleAction>("read");
  const [arg, setArg] = useState("");
  const add = async () => {
    if (!needle.trim() || (action === "move" && !arg)) return;
    await addRule({ field, needle, action, arg: action === "move" ? arg : "" });
    setNeedle(""); onChange();
  };
  return (
    <div className="mail-rules">
      <div className="mail-row"><b>Rules</b><span className="mail-note">run on new inbox mail when you refresh</span><button type="button" className="ui-link" onClick={onClose}>✕</button></div>
      <ul>{rules.map((r) => <li key={r.id}>{ruleLabel(r)} <ConfirmButton label="Remove" onConfirm={() => void removeRule(r.id).then(onChange)} /></li>)}</ul>
      <div className="mail-row">
        <select value={field} onChange={(e) => setField(e.target.value as RuleField)}><option value="from">From</option><option value="subject">Subject</option></select>
        <input placeholder="contains…" value={needle} onChange={(e) => setNeedle(e.target.value)} />
        <select value={action} onChange={(e) => setAction(e.target.value as RuleAction)}><option value="read">Mark read</option><option value="flag">Star</option><option value="move">Move to</option></select>
        {action === "move" && <select value={arg} onChange={(e) => setArg(e.target.value)}><option value="">folder…</option>{folders.map((f) => <option key={f.name}>{f.name}</option>)}</select>}
        <button type="button" className="ui-btn" onClick={() => void add()}>Add rule</button>
      </div>
    </div>
  );
}
