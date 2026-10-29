// Document vault: add .txt/.md/.html (text searchable) or .pdf (name/tags only); search; delete.
import { useRef, useState } from "react";
import { ErrorLine, Row, humanSize } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { useStore } from "../../ui/useStore";
import { highlight } from "./noteSearch";
import { classifyFile, extractText, MAX_VAULT_BYTES, searchVault } from "./vault";
import { addVault, deleteVault, listVault, tagVault } from "./storeExtra";

const read = (f: File, asText: boolean) => new Promise<string>((ok, bad) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => bad(r.error);
  if (asText) r.readAsText(f); else r.readAsDataURL(f);
});

export function VaultTab() {
  const s = useStore(listVault, []);
  const [q, setQ] = useState("");
  const pick = useRef<HTMLInputElement>(null);
  const add = (f: File | undefined) => f && void s.act(async () => {
    const kind = classifyFile(f.name);
    if (!kind) throw new Error("Only .txt, .md, .html and .pdf files");
    if (f.size > MAX_VAULT_BYTES) throw new Error(`${f.name} is over ${humanSize(MAX_VAULT_BYTES)}`);
    const raw = await read(f, kind === "text");
    await addVault(f.name, kind, kind === "text" ? extractText(f.name, raw) : "", f.size, kind === "text" ? "" : raw);
  });
  return (
    <div className="nt-vault">
      {s.error && <ErrorLine message={s.error} />}
      <div className="ui-controls">
        <input type="search" placeholder="Search documents…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input ref={pick} type="file" hidden accept=".txt,.md,.markdown,.html,.htm,.pdf" onChange={(e) => { add(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" className="ui-btn primary" disabled={s.busy} onClick={() => pick.current?.click()}>Add document</button>
      </div>
      <p className="ui-meta">Text files are searchable by content; PDFs by name and tags only. Stored inside the app database.</p>
      {searchVault(s.data, q).map((d) => (
        <Row key={d.id} end={<>
          <span className="ui-meta">{d.kind} · {humanSize(d.size)}</span>
          <button type="button" className="ui-btn ui-sm" onClick={() => { const t = prompt("Tags", d.tags); if (t !== null) void s.act(() => tagVault(d.id, t)); }}>Tags</button>
          <ConfirmButton label="Delete" className="ui-btn ui-sm" onConfirm={() => void s.act(() => deleteVault(d.id))} />
        </>}>
          <strong>{d.name}</strong>{d.tags && <span className="nt-tag">{d.tags}</span>}
          {q && d.kind === "text" && <span className="ui-meta"> {highlight(d.text.slice(Math.max(0, d.text.toLowerCase().indexOf(q.toLowerCase().split(" ")[0]) - 40)).slice(0, 120), q).map((x, i) => x.hit ? <mark key={i}>{x.text}</mark> : x.text)}</span>}
        </Row>
      ))}
    </div>
  );
}
