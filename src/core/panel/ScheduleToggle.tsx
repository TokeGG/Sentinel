import { useEffect, useState } from "react";
import type { ModuleManifest } from "../module";
import { getScheduleEnabled, setScheduleEnabled } from "../scheduler";

export function ScheduleToggle({ module }: { module: ModuleManifest }) {
  const [scheduleOn, setScheduleOn] = useState(false);

  useEffect(() => {
    if (module.schedule) {
      getScheduleEnabled(module.id).then(setScheduleOn);
    }
  }, [module.id]);

  if (!module.schedule) return null;
  return (
    <label className="schedule-toggle">
      <input
        type="checkbox"
        checked={scheduleOn}
        onChange={async (e) => {
          const on = e.target.checked;
          setScheduleOn(on);
          await setScheduleEnabled(module, on);
        }}
      />
      Auto-refresh every {module.schedule.intervalMinutes} min (off by default)
    </label>
  );
}
