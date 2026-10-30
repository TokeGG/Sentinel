// Small editor for a {name: value} setting: list with Remove + an add row.
import { useState } from "react";
import { Row } from "../../ui/kit";
import { cleanName } from "../desk/namedLayouts";

export function NamedMap<T>({ title, value, placeholder, show, parse, onChange }: {
  title: string; value: Record<string, T>; placeholder: string;
  show(v: T): string; parse(s: string): T | null; onChange(next: Record<string, T>): void;
}) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const n = cleanName(name), p = parse(text);
  return (
    <>
      <h3 className="ui-meta">{title}</h3>
      {Object.entries(value).map(([k, v]) => (
        <Row key={k} end={<button type="button" className="ui-btn ui-sm" onClick={() => { const c = { ...value }; delete c[k]; onChange(c); }}>Remove</button>}>
          <strong>{k}</strong> <span className="ui-meta">{show(v)}</span>
        </Row>
      ))}
      <Row end={<button type="button" className="ui-btn" disabled={!n || p === null} onClick={() => { if (n && p !== null) { onChange({ ...value, [n]: p }); setName(""); setText(""); } }}>Add</button>}>
        <input className="st-input" placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="st-input" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      </Row>
    </>
  );
}
