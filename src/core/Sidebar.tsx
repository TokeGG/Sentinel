import type { ModuleManifest } from "./module";

export function Sidebar({
  modules,
  activeId,
  onSelect,
}: {
  modules: ModuleManifest[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">Sentinel</div>
      <ul>
        {modules.map((m) => (
          <li key={m.id}>
            <button
              className={m.id === activeId ? "active" : ""}
              onClick={() => onSelect(m.id)}
            >
              {m.name}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
