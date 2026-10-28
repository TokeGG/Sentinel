import { useEffect, useState } from "react";
import { Sidebar } from "./core/Sidebar";
import { ModulePanel } from "./core/ModulePanel";
import { registry } from "./core/module";
import { initScheduler } from "./core/scheduler";
import "./modules/notes"; // self-registers into `registry` on import
import "./modules/news";
import "./modules/pccare";
import "./modules/weather";
import "./modules/homenet";
import "./modules/github";
import "./modules/youtube";
import "./modules/finance";
import "./modules/deals";
import "./modules/email";
import "./modules/social";
import "./modules/calendar";
import "./modules/backup";
import "./modules/pentest";
import "./modules/clipboard";
import "./modules/filesearch";
import "./App.css";

function App() {
  const [activeId, setActiveId] = useState(registry[0]?.id ?? "");
  const active = registry.find((m) => m.id === activeId);

  useEffect(() => {
    // Only resumes timers the user already switched on in a past session —
    // see core/scheduler.ts. Runs once, not per module-switch.
    initScheduler(registry);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar modules={registry} activeId={activeId} onSelect={setActiveId} />
      <main className="workspace">
        {active ? (
          <ModulePanel module={active} />
        ) : (
          <p>No modules registered.</p>
        )}
      </main>
    </div>
  );
}

export default App;
