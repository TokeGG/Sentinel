import { ModulePanel } from "../core/ModulePanel";
import { registry } from "../core/module";

// Rendered inside a child webview loaded at index.html#/panel/<id>.
export function panelIdFromHash(hash: string): string | null {
  return hash.startsWith("#/panel/") ? decodeURIComponent(hash.slice("#/panel/".length)) : null;
}

export function PanelRoute({ id }: { id: string }) {
  const m = registry.find((x) => x.id === id);
  return (
    <main className="panel-route">
      {m ? <ModulePanel module={m} /> : <p>Module not found: {id}</p>}
    </main>
  );
}
