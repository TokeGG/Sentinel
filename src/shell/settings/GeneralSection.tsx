import { useEffect, useState } from "react";
import { Row } from "../../ui/kit";
import { getGameModeAuto, getIgnoreReduced, getNotifMoons, getOrbitMotion, getOrbitSpeed, getStarMotion } from "../layoutStore";
import {
  notifySettingsChanged, saveGameModeAuto, saveIgnoreReduced, saveNotifMoons, saveOrbitMotion, saveOrbitSpeed, saveStarMotion, type SettingKey,
} from "../generalSettings";
import { getRestorePanels, setRestorePanels } from "../settingsStore";
import { SPEED_MAX, SPEED_MIN } from "../orbit";
import { Head, Switch } from "./Switch";
import { resetPlanetPos } from "../planetPosStore";
import { getSetting, setSetting } from "../../ui/appSetting";
import { parseUndoSecs } from "../../ui/ConfirmButton";

// null = still loading. A failed read shows the default (`fallback`).
function useSetting<T>(get: () => Promise<T>, fallback: T, onError: (e: unknown) => void) {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    get().then(setV).catch((e) => { setV(fallback); onError(e); });
  }, []);
  return [v, setV] as const;
}

export function GeneralSection({ onError }: { onError(e: unknown): void }) {
  const [auto, setAuto] = useSetting(getGameModeAuto, true, onError);
  const [motion, setMotion] = useSetting(getStarMotion, true, onError);
  const [orbit, setOrbit] = useSetting(getOrbitMotion, true, onError);
  const [speed, setSpeed] = useSetting(getOrbitSpeed, 1, onError);
  const [moons, setMoons] = useSetting(getNotifMoons, true, onError);
  const [ignoreRM, setIgnoreRM] = useSetting(getIgnoreReduced, true, onError);
  const [restore, setRestore] = useSetting(getRestorePanels, true, onError);
  const [banner, setBanner] = useSetting(() => getSetting("changed_banner").then((v) => v !== "0"), true, onError);
  const [undo, setUndo] = useSetting(() => getSetting("undo_secs").then(parseUndoSecs), 5, onError);
  const change = <T,>(save: (n: T) => Promise<void>, set: (n: T) => void, key?: SettingKey) =>
    async (next: T) => {
      try {
        await save(next);
        set(next);
        if (key) await notifySettingsChanged(key); // main window re-reads
      } catch (e) { onError(e); }
    };
  // Slider: state first so the thumb never snaps back while dragging, then save.
  const onSpeed = (v: number) => {
    setSpeed(v);
    saveOrbitSpeed(v).then(() => notifySettingsChanged("orbit_speed")).catch(onError);
  };
  return (
    <section className="st-section" aria-label="General">
      <Head>General</Head>
      <Row><Switch checked={auto ?? true} disabled={auto === null} onChange={change(saveGameModeAuto, setAuto, "game_mode_auto")}>
        Auto game mode <small className="ui-meta">pause background work while a game is fullscreen</small></Switch></Row>
      <Row><Switch checked={motion ?? true} disabled={motion === null} onChange={change(saveStarMotion, setMotion, "star_motion")}>
        Star map motion</Switch></Row>
      <Row><Switch checked={orbit ?? true} disabled={orbit === null} onChange={change(saveOrbitMotion, setOrbit, "orbit_motion")}>
        Orbit motion <small className="ui-meta">planets circle the core</small></Switch></Row>
      <Row><label className="st-switch">Orbit speed
        <input type="range" min={SPEED_MIN} max={SPEED_MAX} step={0.25} value={speed ?? 1} disabled={speed === null}
          aria-label="Orbit speed" onChange={(e) => onSpeed(Number(e.target.value))} />
        <output>{speed ?? 1}x</output></label></Row>
      <Row><Switch checked={ignoreRM ?? true} disabled={ignoreRM === null} onChange={change(saveIgnoreReduced, setIgnoreRM, "ignore_reduced_motion")}>
        Animate even if Windows animations are off <small className="ui-meta">turn off to follow the system setting</small></Switch></Row>
      <Row><Switch checked={moons ?? true} disabled={moons === null} onChange={change(saveNotifMoons, setMoons, "notif_moons")}>
        Notification moons <small className="ui-meta">unread counts around planets</small></Switch></Row>
      <Row><Switch checked={restore ?? true} disabled={restore === null} onChange={change(setRestorePanels, setRestore)}>
        Reopen panels at startup</Switch></Row>
      <Row><Switch checked={banner ?? true} disabled={banner === null} onChange={(on) => setSetting("changed_banner", on ? "1" : "0").then(() => setBanner(on)).catch(onError)}>
        "What changed" banner <small className="ui-meta">new items since you last opened a panel</small></Switch></Row>
      <Row><label className="st-switch">Undo window for deletes
        <select id="undo-secs" value={undo ?? 5} onChange={(e) => { const v = Number(e.target.value); setSetting("undo_secs", String(v)).then(() => setUndo(v)).catch(onError); }}>
          {[0, 3, 5, 10, 15].map((n) => <option key={n} value={n}>{n ? `${n} seconds` : "off"}</option>)}</select></label>
        <small className="ui-meta">applies to panels opened after the change</small></Row>
      <Row><button className="ui-btn" onClick={() => resetPlanetPos().catch(onError)}>Reset planet positions</button>
        <small className="ui-meta">undo planets you dragged to other orbits</small></Row>
    </section>
  );
}
