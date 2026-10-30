// Shared bits for the system/privacy Settings sections: the sys_prefs hook and a number field.
import { useEffect, useState } from "react";
import { DEFAULT_SYS, type SysPrefs } from "./sysPrefs";
import { loadSys, saveSys } from "./sysPrefsStore";

export function useSys(onError: (e: unknown) => void) {
  const [p, setP] = useState<SysPrefs | null>(null);
  useEffect(() => { loadSys().then(setP).catch((e) => { setP(DEFAULT_SYS); onError(e); }); }, []);
  const set = (patch: Partial<SysPrefs>) => saveSys(patch).then(setP).catch(onError);
  return [p, set] as const;
}

export function NumField({ label, value, min, max, unit, hint, onSave }: {
  label: string; value: number; min: number; max: number; unit?: string; hint?: string; onSave(n: number): void;
}) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <label className="st-switch">{label}
      <input className="ui-input" type="number" min={min} max={max} value={v} aria-label={label} style={{ width: 80 }}
        onChange={(e) => setV(e.target.value)} onBlur={() => onSave(Number(v))} />
      {unit && <span className="ui-meta">{unit}</span>}
      {hint && <small className="ui-meta">{hint}</small>}
    </label>
  );
}
