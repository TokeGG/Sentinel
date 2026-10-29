import { useEffect, useState } from "react";
import { Row } from "../../ui/kit";
import { loadPrefs, savePrefs } from "../notifDb";
import { DEFAULT_PREFS, fmtHM, parseHM, type NotifPrefs } from "../notifLogic";
import { Head, Switch } from "./Switch";

// Quiet hours: during the range, moons / sun glow / title-bar count are muted;
// the Master Hub and its history still record everything.
export function NotificationsSection({ onError }: { onError(e: unknown): void }) {
  const [p, setP] = useState<NotifPrefs | null>(null);
  useEffect(() => { loadPrefs().then(setP).catch((e) => { setP(DEFAULT_PREFS); onError(e); }); }, []);
  const q = (p ?? DEFAULT_PREFS).quiet;
  const set = (patch: Partial<typeof q>) => {
    if (!p) return;
    const next = { ...p, quiet: { ...q, ...patch } };
    setP(next);
    savePrefs(next, ["quiet"]).catch(onError);
  };
  const time = (label: string, key: "start" | "end") => (
    <label className="st-switch">{label}
      <input type="time" value={fmtHM(q[key])} disabled={!p || !q.on} aria-label={label}
        onChange={(e) => { const m = parseHM(e.target.value); if (m !== null) set({ [key]: m }); }} />
    </label>
  );
  return (
    <section className="st-section" aria-label="Notifications">
      <Head>Notifications</Head>
      <Row><Switch checked={q.on} disabled={!p} onChange={(on) => set({ on })}>
        Quiet hours <small className="ui-meta">mute moons in a time range (the log keeps recording)</small></Switch></Row>
      <Row>{time("From", "start")}{time("Until", "end")}</Row>
    </section>
  );
}
