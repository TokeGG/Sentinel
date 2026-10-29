// First-run tour (main window): a few cards, dismissed for good via `tour_done`.
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { TOUR } from "./helpLogic";
import { DESK_CHANGED, getFlag, setFlag } from "./store";

export function Tour() {
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => {
    const check = () => getFlag("tour_done").then((d) => setStep(d ? null : 0)).catch(() => {});
    check();
    const un = listen(DESK_CHANGED, check);
    return () => void un.then((f) => f());
  }, []);
  if (step === null) return null;
  const finish = () => { setStep(null); setFlag("tour_done", true).catch(() => {}); };
  const t = TOUR[step];
  return (
    <div className="tour" role="dialog" aria-label="Tour">
      <strong>{t.title}</strong>
      <p>{t.body}</p>
      <div className="tour-acts">
        <span className="ui-meta">{step + 1}/{TOUR.length}</span>
        <button className="mh-btn" onClick={finish}>Skip</button>
        <button className="mh-btn" onClick={() => (step + 1 < TOUR.length ? setStep(step + 1) : finish())}>{step + 1 < TOUR.length ? "Next" : "Done"}</button>
      </div>
    </div>
  );
}
