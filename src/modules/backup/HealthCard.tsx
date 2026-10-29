// Backup health card: age of the last backup across sessions (app_settings backup_last).
import { getSetting } from "../../ui/appSetting";
import { useStore } from "../../ui/useStore";
import { healthOf, LAST_KEY, latest } from "./health";
import type { Snapshot } from "./panelLogic";

export function HealthCard({ snaps }: { snaps: Snapshot[] }) {
  const stored = useStore(() => getSetting(LAST_KEY), null);
  const h = healthOf(latest(stored.data, snaps.map((s) => s.when)), new Date());
  return (
    <div className={`bk-health ${h.tone}`} role="status">
      <strong>{h.title}</strong>
      <span className="ui-meta">{h.advice}</span>
    </div>
  );
}
