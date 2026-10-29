import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { registry } from "../core/module";
import { pauseAll, resumeEnabled } from "../core/scheduler";
import { getGameModeAuto, getStarMotion } from "./layoutStore";
import { saveGameModeAuto, saveStarMotion } from "./generalSettings";
import { openSettings } from "./panelApi";
import { setGameMode as shareGameMode, setStarMotion as shareStarMotion } from "./motionStore";
import { OrbitControls } from "./OrbitControls";

// Main-window only: game-mode listeners, the auto toggle, the manual button,
// rendered as the toolbar inside the title bar (the error line lives in App).
// `refresh` bumps when the Settings panel (another webview) changed a toggle.
export function GameHud({ setError, refresh = 0 }: { setError: (e: string | null) => void; refresh?: number }) {
  const [auto, setAuto] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [manual, setManual] = useState(false);
  const [motion, setMotion] = useState<boolean | null>(null);
  const last = useRef<boolean | null>(null);
  const fail = (e: unknown) => setError(String(e));

  useEffect(() => {
    getGameModeAuto()
      .then(async (on) => {
        setAuto(on);
        await invoke("set_game_mode_auto", { enabled: on });
      })
      .catch(fail);
    getStarMotion().then((on) => { setMotion(on); shareStarMotion(on); }).catch((e) => { setMotion(true); fail(e); });
    // `game-mode` fires every 5 s; act only when `active` changes.
    const unGame = listen<{ active: boolean }>("game-mode", ({ payload }) => {
      if (payload.active === last.current) return;
      last.current = payload.active;
      setActive(payload.active);
      shareGameMode(payload.active);
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
      await saveGameModeAuto(next);
      setAuto(next);
    } catch (e) { fail(e); }
  };
  const toggleMotion = async () => {
    const next = !motion;
    try {
      await saveStarMotion(next);
      setMotion(next);
    } catch (e) { fail(e); }
  };
  // Settings already saved + told Rust; only mirror the values into HUD state.
  useEffect(() => {
    if (refresh === 0) return;
    getGameModeAuto().then(setAuto).catch(fail);
    getStarMotion().then((on) => { setMotion(on); shareStarMotion(on); }).catch(fail);
  }, [refresh]);
  const toggleManual = async () => {
    try {
      await invoke("set_game_mode", { manual: !manual });
      setManual(!manual);
    } catch (e) { fail(e); }
  };

  return (
    <div className="hud-row">
      <span className={`hud-state${active ? " on" : ""}`}>{active ? "Game mode on" : "Game mode off"}</span>
      <button className={manual ? "on" : ""} onClick={toggleManual}>Game mode</button>
      <button className={auto ? "on" : ""} disabled={auto === null} onClick={toggleAuto}>
        Auto {auto ? "on" : "off"}
      </button>
      <button className={motion ? "on" : ""} disabled={motion === null} onClick={toggleMotion}>
        Stars: {motion ? "on" : "off"}
      </button>
      <OrbitControls refresh={refresh} fail={fail} />
      <button className="hud-settings" onClick={() => openSettings().catch(fail)}>⚙ Settings</button>
    </div>
  );
}
