// A JSON value in app_settings with a sanitizer (bad/missing data = fallback), plus the
// Calendar hand-off used by manual plans (watch party, streamer schedule, CS2 matches).
import { useCallback, useEffect, useState } from "react";
import { registry } from "../core/module";
import { getSetting, setSetting } from "./appSetting";
import { findSkill } from "./moduleRun";

export function useJsonSetting<T>(key: string, clean: (raw: unknown) => T) {
  const [value, setValue] = useState<T>(() => clean(undefined));
  useEffect(() => {
    getSetting(key).then((v) => { try { setValue(clean(JSON.parse(v ?? "null"))); } catch { /* keep fallback */ } }).catch(() => {});
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useCallback((next: T) => { setValue(next); void setSetting(key, JSON.stringify(next)).catch(() => {}); }, [key]);
  return [value, save] as const;
}

/** Adds an event through the Calendar module's add_item skill. */
export async function toCalendar(args: { title: string; day: string; time?: string; repeat?: string; notes?: string }) {
  const cal = registry.find((m) => m.id === "hub.calendar");
  if (!cal) throw new Error("The Calendar module is not available");
  return findSkill(cal, "add_item").run({ kind: "event", ...args });
}

export const arrayOf = <T>(ok: (x: unknown) => x is T) => (raw: unknown): T[] => (Array.isArray(raw) ? raw.filter(ok) : []);
