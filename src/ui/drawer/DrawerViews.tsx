// Saved views: switch, create, delete (never the last one), export as JSON,
// import JSON. Imports go through importView -> mergeView (sanitized) and are
// applied to the CURRENT view (its name is kept), so nothing is created
// behind the user's back and nothing unsanitized is applied.
import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { ErrorLine } from "../kit";
import { exportView, importView } from "../prefs";
import type { Customize } from "../useCustomize";

export function DrawerViews({ module: m, cz }: { module: ModuleManifest; cz: Customize }) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"none" | "export" | "import">("none");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (next: "export" | "import") => {
    setMode((cur) => (cur === next ? "none" : next));
    setErr(null);
    setMsg(null);
  };

  const copy = () =>
    navigator.clipboard
      .writeText(exportView(cz.view))
      .then(() => setMsg("Copied."))
      .catch(() => setMsg("Copy failed — select the text and press Ctrl+C."));

  const apply = () => {
    try {
      void cz.setView({ ...importView(text, m.customize), name: cz.view.name });
      setErr(null);
      setText("");
      setMsg(`Applied to "${cz.view.name}".`);
    } catch {
      setErr("invalid view");
    }
  };

  return (
    <section className="cz-sec" aria-labelledby="cz-views">
      <h3 id="cz-views">Views</h3>
      <label className="cz-field">
        <span>Active</span>
        <select value={cz.view.name} onChange={(e) => void cz.switchTo(e.target.value)}>
          {cz.views.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <form
        className="cz-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void cz.create(name);
          setName("");
        }}
      >
        <input aria-label="New view name" placeholder="New view name" maxLength={60}
          value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" disabled={!name.trim()}>New view</button>
      </form>
      <div className="cz-row">
        <button type="button" disabled={cz.views.length <= 1} onClick={() => void cz.remove(cz.view.name)}>
          Delete view
        </button>
        <button type="button" aria-pressed={mode === "export"} onClick={() => toggle("export")}>Export</button>
        <button type="button" aria-pressed={mode === "import"} onClick={() => toggle("import")}>Import</button>
      </div>
      {mode === "export" && (
        <>
          <textarea className="cz-json" readOnly aria-label="Exported view JSON" value={exportView(cz.view)}
            onFocus={(e) => e.currentTarget.select()} />
          <button type="button" onClick={copy}>Copy</button>
        </>
      )}
      {mode === "import" && (
        <>
          <textarea className="cz-json" aria-label="View JSON to import" placeholder="Paste view JSON"
            value={text} onChange={(e) => setText(e.target.value)} />
          <button type="button" disabled={!text.trim()} onClick={apply}>Apply</button>
        </>
      )}
      {err && <ErrorLine message={err} onDismiss={() => setErr(null)} />}
      {msg && <p className="cz-note" role="status">{msg}</p>}
    </section>
  );
}
