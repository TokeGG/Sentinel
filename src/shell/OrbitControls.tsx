import { useEffect, useState } from "react";
import { getIgnoreReduced, getNotifMoons, getOrbitMotion, getOrbitSpeed } from "./layoutStore";
import { saveNotifMoons, saveOrbitMotion, saveOrbitSpeed } from "./generalSettings";
import { setIgnoreReduced as shareIgnore, setNotifMoons as shareMoons, setOrbitMotion as shareMotion, setOrbitSpeed as shareSpeed } from "./motionStore";
import { SPEED_MAX, SPEED_MIN } from "./orbit";

// HUD orbit controls: on/off button + speed slider. Loads the saved values on
// mount and re-reads them when `refresh` bumps (the Settings panel saved).
export function OrbitControls({ refresh, fail }: { refresh: number; fail: (e: unknown) => void }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [speed, setSpeed] = useState(1);
  const [moons, setMoons] = useState<boolean | null>(null);
  useEffect(() => {
    getOrbitMotion().then((v) => { setOn(v); shareMotion(v); }).catch((e) => { setOn(true); fail(e); });
    getNotifMoons().then((v) => { setMoons(v); shareMoons(v); }).catch((e) => { setMoons(true); fail(e); }); // fail-open: on
    getIgnoreReduced().then(shareIgnore).catch(fail);
    getOrbitSpeed().then((v) => { setSpeed(v); shareSpeed(v); }).catch(fail);
  }, [refresh]);
  const toggle = async () => {
    try {
      await saveOrbitMotion(!on);
      setOn(!on);
    } catch (e) { fail(e); }
  };
  const toggleMoons = async () => {
    try {
      await saveNotifMoons(!moons);
      setMoons(!moons);
    } catch (e) { fail(e); }
  };
  const change = (v: number) => {
    setSpeed(v);
    saveOrbitSpeed(v).catch(fail);
  };
  return (
    <>
      <button className={on ? "on" : ""} disabled={on === null} onClick={toggle}>
        Orbits: {on ? "on" : "off"}
      </button>
      <button className={moons ? "on" : ""} disabled={moons === null} onClick={toggleMoons}>
        Moons: {moons ? "on" : "off"}
      </button>
      <label className="hud-speed">
        Speed
        <input type="range" min={SPEED_MIN} max={SPEED_MAX} step={0.25} value={speed}
          aria-label="Orbit speed" onChange={(e) => change(Number(e.target.value))} />
        <output>{speed}x</output>
      </label>
    </>
  );
}
