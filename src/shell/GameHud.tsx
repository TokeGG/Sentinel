import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { registry } from "../core/module";
import { pauseAll, resumeEnabled } from "../core/scheduler";
import { getGameModeAuto, setGameModeAuto } from "./layoutStore";

// Main-window only: game-mode listeners, the auto toggle, the manual button,
// and a dismissible error line.
export function GameHud({ error, setError }: { error: string | null; setError: (e: string | null) => void }) {
  const [auto, setAuto] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [manual, setManual] = useState(false);
  const last = useRef<boolean | null>(null);
  const fail = (e: unknown) => setError(String(e));

  useEffect(() => {
    getGameModeAuto()
      .then(async (on) => {
        setAuto(on);
        await invoke("set_game_mode_auto", { enabled: on });
      })
      .catch(fail);
    // `game-mode` fires every 5 s; act only when `active` changes.
    const unGame = listen<{ active: boolean }>("game-mode", ({ payload }) => {
      if (payload.active === last.current) return;
      last.current = payload.active;
      setActive(payload.active);
      if (payload.active) pauseAll();
      else resumeEnabled(registry).catch(fail);
    });
    const unErr = listen<string>("game-mode-error", ({ payload }) => setError(String(payload)));
    return () => {
      unGame.then((f) => f());
      unErr.then((f) => f());
    };
  }, []);

  const toggleAuto = async () => {
    const next = !auto;
    try {
      await setGameModeAuto(next);
      await invoke("set_game_mode_auto", { enabled: next });
      setAuto(next);
    } catch (e) { fail(e); }
  };
  const toggleManual = async () => {
    try {
      await invoke("set_game_mode", { manual: !manual });
      setManual(!manual);
    } catch (e) { fail(e); }
  };

  return (
    <div className="hud">
      <div className="hud-row">
        <span>{active ? "Game mode: ON" : "Game mode: off"}</span>
        <button className={manual ? "on" : ""} onClick={toggleManual}>Game mode</button>
        <button className={auto ? "on" : ""} disabled={auto === null} onClick={toggleAuto}>
          Auto game mode {auto ? "on" : "off"}
        </button>
      </div>
      {error && (
        <div className="hud-row hud-error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss">x</button>
        </div>
      )}
    </div>
  );
}
