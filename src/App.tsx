import { useEffect, useState } from "react";
import { registry } from "./core/module";
import { initScheduler, setTimersOwner, syncModule, SCHEDULE_CHANGED } from "./core/scheduler";
import { listen } from "@tauri-apps/api/event";
import { StarMap } from "./shell/StarMap";
import { GameHud } from "./shell/GameHud";
import { PanelRoute, panelIdFromHash } from "./shell/PanelRoute";
import { restore } from "./shell/panelApi";
import { ChromeRoute, chromeIdFromHash } from "./shell/ChromeRoute";
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

// Child panel webviews load this same bundle at #/panel/<id>; they render only
// that module and never start the scheduler, restore layout, or listen.
function MainShell() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // Only resumes timers the user already switched on — see core/scheduler.ts.
    initScheduler(registry);
    // Panel webviews only persist schedule toggles; main owns the timers.
    const un = listen<{ moduleId: string }>(SCHEDULE_CHANGED, ({ payload }) => {
      const m = registry.find((x) => x.id === payload.moduleId);
      if (m) syncModule(m).catch((e) => setError(`Schedule sync: ${String(e)}`));
    });
    restore().catch((e) => setError(`Restore layout: ${String(e)}`));
    return () => {
      un.then((f) => f());
    };
  }, []);
  return (
    <div className="starmap">
      <StarMap modules={registry} onError={setError} />
      <GameHud error={error} setError={setError} />
    </div>
  );
}

function App() {
  const panelId = panelIdFromHash(window.location.hash);
  const chromeId = chromeIdFromHash(window.location.hash);
  // Child webviews (#/panel/, #/chrome/) never own scheduler timers.
  setTimersOwner(panelId === null && chromeId === null);
  if (chromeId !== null) return <ChromeRoute id={chromeId} />;
  return panelId !== null ? <PanelRoute id={panelId} /> : <MainShell />;
}

export default App;
