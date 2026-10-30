// Shown in the Today section: side-by-side time zones (app_settings `cal_zones`,
// set in Settings > Productivity) and countdowns to the next 3 upcoming entries.
import { useLimit } from "../../ui/useOption";
import { useEffect, useState } from "react";
import { getSetting } from "../../ui/appSetting";
import { calendarLimits, rowDate } from "./panelLogic";
import { cleanZones, countdown, zoneTimes } from "./timeExtras";
import { useUiDefaults } from "../../shell/desk/useUiDefaults";

export function ClocksBar({ rows, now }: { rows: Record<string, unknown>[]; now: Date }) {
  const [zones, setZones] = useState<string[]>([]);
  const { clock } = useUiDefaults();
  const cd = useLimit(calendarLimits, "countdowns");
  useEffect(() => { getSetting("cal_zones").then((v) => { try { setZones(cleanZones(JSON.parse(v ?? "[]"))); } catch { /* none */ } }).catch(() => {}); }, []);
  const next = rows
    .map((r) => ({ r, d: rowDate(r) }))
    .filter((x): x is { r: Record<string, unknown>; d: Date } => !!x.d && x.d.getTime() > now.getTime())
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .slice(0, cd);
  if (!zones.length && !next.length) return null;
  return (
    <div className="ui-chips" aria-label="Clocks and countdowns">
      {zoneTimes(now, zones, clock).map((z) => <span key={z.zone} className="ui-meta cal-chip" title={z.zone}>{z.zone.split("/").pop()?.replace(/_/g, " ")} {z.time}</span>)}
      {next.map(({ r, d }) => <span key={String(r.id)} className="ui-meta cal-chip">{String(r.title ?? "Event")} in {countdown(d.getTime(), now.getTime())}</span>)}
    </div>
  );
}
