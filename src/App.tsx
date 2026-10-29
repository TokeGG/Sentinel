import { useEffect, useState } from "react";
import { registry } from "./core/module";
import { getDb, getLoadProblem, recordLoadProblem } from "./core/db";
import { redactPaths } from "./core/schema";
import { initScheduler, setTimersOwner, syncModule, SCHEDULE_CHANGED } from "./core/scheduler";
import { listen } from "@tauri-apps/api/event";
import { StarMap } from "./shell/StarMap";
import { GameHud } from "./shell/GameHud";
import { TitleBar } from "./shell/TitleBar";
import { PanelRoute, panelIdFromHash } from "./shell/PanelRoute";
import { restore, LAYOUT_COMMIT, LAYOUT_DELETE, type SavedPanel } from "./shell/panelApi";
import { saveLayout, deleteLayout } from "./shell/layoutStore";
import { SETTINGS_CHANGED } from "./shell/generalSettings";
import { useBadges } from "./shell/useBadges";
import { ChromeRoute, chromeIdFromHash } from "./shell/ChromeRoute";
import { GripRoute, gripIdFromHash } from "./shell/GripRoute";
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
import "./modules/congress";
import "./modules/backup";
import "./modules/pentest";
import "./modules/clipboard";
import "./modules/filesearch";
import "./modules/discord";
import "./modules/chat";
import "./modules/skills";
import "./modules/bot";
import "./App.css";

// Child panel webviews load this same bundle at #/panel/<id>; they render only
// that module and never start the scheduler, restore layout, or listen.
function MainShell() {
  const [error, setError] = useState<string | null>(null);
  const [settingsTick, setSettingsTick] = useState(0);
  const onPanelClosed = useBadges(registry, setError);
  useEffect(() => {
    getDb()
      .then(() => {
        const p = getLoadProblem();
        if (p) setError(`Database upgrade problem (running in compatibility mode): ${redactPaths(p)}`);
        return recordLoadProblem();
      })
      .catch((e) => setError(`Database could not be opened: ${redactPaths(String(e))}`));
  }, []);
  useEffect(() => {
    // Only resumes timers the user already switched on — see core/scheduler.ts.
    initScheduler(registry);
    // Panel webviews only persist schedule toggles; main owns the timers.
    const un = listen<{ moduleId: string }>(SCHEDULE_CHANGED, ({ payload }) => {
      const m = registry.find((x) => x.id === payload.moduleId);
      if (m) syncModule(m).catch((e) => setError(`Schedule sync: ${String(e)}`));
    });
    // Chrome webviews report layout changes here; only main touches SQLite.
    const fail = (what: string) => (e: unknown) => setError(`${what}: ${String(e)}`);
    const unCommit = listen<SavedPanel>(LAYOUT_COMMIT, ({ payload: p }) => {
      saveLayout(p.id, p.rect, p.z, p.state).catch(fail("Save layout"));
    });
    const unDelete = listen<{ id: string }>(LAYOUT_DELETE, ({ payload }) => {
      deleteLayout(payload.id).catch(fail("Forget panel"));
      onPanelClosed(payload.id); // a panel closed: refresh badges
    });
    // The Settings panel is another webview: it saves, then tells us to re-read.
    const unSettings = listen(SETTINGS_CHANGED, () => setSettingsTick((t) => t + 1));
    restore().catch(fail("Restore layout"));
    return () => {
      un.then((f) => f());
      unCommit.then((f) => f());
      unDelete.then((f) => f());
      unSettings.then((f) => f());
    };
  }, []);
  return (
    <div className="shell">
      <TitleBar onError={setError}>
        <GameHud setError={setError} refresh={settingsTick} />
      </TitleBar>
      <div className="starmap">
        <StarMap modules={registry} onError={setError} />
        {error && (
          <div className="hud-error" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss">x</button>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const panelId = panelIdFromHash(window.location.hash);
  const chromeId = chromeIdFromHash(window.location.hash);
  // Child webviews (#/panel/, #/chrome/) never own scheduler timers.
  const gripId = gripIdFromHash(window.location.hash);
  setTimersOwner(panelId === null && chromeId === null && gripId === null);
  if (chromeId !== null) return <ChromeRoute id={chromeId} />;
  if (gripId !== null) return <GripRoute id={gripId} />;
  return panelId !== null ? <PanelRoute id={panelId} /> : <MainShell />;
}

export default App;
