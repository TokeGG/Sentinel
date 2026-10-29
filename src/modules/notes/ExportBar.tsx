// Preview-then-write Markdown export: shows the text first, writes only on confirm.
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";

export function ExportBar({ label, filename, text }: { label: string; filename: string; text: () => string }) {
  const [shown, setShown] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const write = async () => {
    try {
      const path = await save({ defaultPath: filename, filters: [{ name: "Markdown", extensions: ["md"] }] });
      if (!path) return;
      await invoke("write_text_file", { path, contents: shown });
      setMsg("Saved"); setShown(null);
    } catch (e) { setMsg(String(e)); }
  };
  return (
    <span className="nt-export">
      <button type="button" className="ui-btn ui-sm" onClick={() => { setMsg(""); setShown(shown === null ? text() : null); }}>{label}</button>
      {msg && <span className="ui-meta" role="status">{msg}</span>}
      {shown !== null && (
        <div className="ui-banner" role="dialog" aria-label="Export preview">
          <pre className="nt-pre">{shown.slice(0, 4000)}{shown.length > 4000 ? "\n…" : ""}</pre>
          <span className="ui-meta">{shown.length} characters</span>
          <button type="button" className="ui-btn primary" onClick={() => void write()}>Choose file and save</button>
          <button type="button" className="ui-btn" onClick={() => setShown(null)}>Cancel</button>
        </div>
      )}
    </span>
  );
}
