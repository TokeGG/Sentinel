// Courses panel contract (pure): sections and every changeable value as a customize option.
import type { OptionDef } from "../../core/customizeChecks.ts";
import { clampInt } from "../../ui/numOption.ts";

export const coursesSections = [
  { id: "upcoming", label: "Coming up (due dates and exams)" },
  { id: "courses", label: "My classes and courses" },
  { id: "time", label: "Weekly study time" },
  { id: "add", label: "Add a course" },
];

export const coursesOptions: OptionDef[] = [
  { key: "sort", label: "Sort courses by", type: "select", choices: ["date", "name", "progress"], default: "date" },
  { key: "showDone", label: "Show finished courses", type: "toggle", default: true },
  { key: "soonDays", label: "Coming up: days ahead", type: "number", default: 14, min: 1, max: 365 },
  { key: "weeks", label: "Study time: weeks shown", type: "number", default: 8, min: 1, max: 52 },
  { key: "goalMins", label: "Weekly study goal (minutes)", type: "number", default: 180, min: 0, max: 5000 },
  { key: "logMins", label: "Default minutes per study log", type: "number", default: 30, min: 5, max: 600 },
];

/** Bar width (0..100) of a week's minutes against the goal (or the busiest week when there is no goal). */
export function barPct(mins: number, goal: number, max: number): number {
  const top = goal > 0 ? Math.max(goal, max) : max;
  return top > 0 ? clampInt((mins / top) * 100, 0, 0, 100) : 0;
}
export const hm = (mins: number) => (mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60 ? `${mins % 60} min` : ""}`.trim() : `${mins} min`);
