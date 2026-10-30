// Challenge Coach tab of the Bot panel: Coach / Your turn / Make your own / CTF / Practice CTF / Progress.
import { useEffect, useState } from "react";
import { Tabs } from "../../../ui/kit";
import { getSetting, setSetting } from "../../skills/store";
import { CoachWork } from "./CoachWork";
import { COACH_DAILY_KEY, COACH_MODE_KEY, COACH_TODAY_KEY } from "./coachSql";
import { cachedPuzzle } from "./coachStore";
import { CtfPane } from "./CtfPane";
import { MakePane } from "./MakePane";
import { PracticeCtf } from "./PracticeCtf";
import { ProgressPane } from "./ProgressPane";
import { PuzzlePicker } from "./PuzzlePicker";
import { useCoach } from "./useCoach";

const TABS = [{ id: "coach", label: "Coach" }, { id: "yours", label: "Your turn" }, { id: "make", label: "Make your own" }, { id: "ctf", label: "CTF dailies" }, { id: "pctf", label: "Practice CTF" }, { id: "progress", label: "Progress" }];

export function CoachPane() {
  const c = useCoach();
  const [tab, setTab] = useState("coach");
  const [daily, setDaily] = useState(false);
  useEffect(() => {
    void getSetting(COACH_MODE_KEY).then((m) => { if (m === "ctf") { setTab("ctf"); void setSetting(COACH_MODE_KEY, ""); } }, () => {});
    void getSetting(COACH_DAILY_KEY).then((v) => setDaily(v === "1"), () => {});
    void getSetting(COACH_TODAY_KEY).then(async (k) => { const p = k ? await cachedPuzzle(k) : null; if (p) c.setPuzzle(p); }, () => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (t: string) => { setTab(t); if (t === "coach" || t === "yours") c.setMode(t); };
  return (
    <div className="coach-col">
      <Tabs tabs={TABS} active={tab} onChange={go} />
      {c.busy && <span role="status" className="bot-dim">{c.busy}</span>}
      {c.error && <span role="alert" className="coach-err">{c.error}</span>}
      {(tab === "coach" || tab === "yours") && <><PuzzlePicker c={c} /><CoachWork c={c} /></>}
      {tab === "make" && <MakePane c={c} done={() => setTab("yours")} />}
      {tab === "ctf" && <CtfPane c={c} />}
      {tab === "pctf" && <PracticeCtf c={c} />}
      {tab === "progress" && <ProgressPane />}
      <label className="bot-dim"><input type="checkbox" checked={daily} onChange={(e) => { setDaily(e.target.checked); void setSetting(COACH_DAILY_KEY, e.target.checked ? "1" : "0"); }} />
        {" "}Prepare a daily puzzle (also needs this module's Auto-refresh; only caches it, never submits)</label>
    </div>
  );
}
