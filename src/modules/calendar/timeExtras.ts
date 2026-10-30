// Pure calendar extras: side-by-side time zones (app_settings `cal_zones`),
// countdowns to events, recurring task templates (app_settings `task_templates`).
import { zoneTime, type ClockFmt } from "../../shell/desk/uiDefaults.ts";
export function validZone(z: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: z }); return true; } catch { return false; }
}
export const cleanZones = (raw: unknown): string[] =>
  Array.isArray(raw) ? [...new Set(raw.filter((z): z is string => typeof z === "string" && validZone(z)))].slice(0, 8) : [];
/** "HH:MM" plus weekday in each zone for one instant. */
export function zoneTimes(d: Date, zones: string[], clock: ClockFmt = "24h"): { zone: string; time: string }[] {
  return zones.map((zone) => ({ zone, time: zoneTime(d, zone, clock, true) }));
}
/** "3d 4h", "2h 05m", "12m", "now" or "passed". */
export function countdown(targetMs: number, nowMs: number): string {
  const s = Math.floor((targetMs - nowMs) / 1000);
  if (s < -60) return "passed";
  if (s < 60) return "now";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

export type Repeat = "daily" | "weekly" | "monthly";
export type TaskTemplate = { name: string; title: string; repeat: Repeat };
const REPEATS: Repeat[] = ["daily", "weekly", "monthly"];
export function cleanTemplates(raw: unknown): TaskTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t) => t && typeof t.name === "string" && t.name.trim() && typeof t.title === "string" && t.title.trim() && REPEATS.includes(t.repeat))
    .map((t) => ({ name: t.name.trim().slice(0, 40), title: t.title.trim().slice(0, 200), repeat: t.repeat as Repeat })).slice(0, 50);
}
/** Args for the calendar `add_item` skill: a repeating task starting today. */
export function templateItem(t: TaskTemplate, today: Date): Record<string, unknown> {
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return { kind: "task", title: t.title, day, repeat: t.repeat };
}
