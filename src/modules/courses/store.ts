// Courses storage: one JSON value in app_settings `courses` (Tauri glue; logic lives in logic.ts / plan.ts).
import { getSetting, setSetting } from "../../ui/appSetting";
import { KEY, parseState, type CoursesState } from "./logic";
import { importLab, seedFree } from "./plan";
import { FREE_COURSES } from "./freeCourses";

export async function readState(): Promise<CoursesState> {
  const s = parseState(await getSetting(KEY));
  if (s.imported && s.seeded) return s;
  // once each: copy the Lab hub's course list, then add the free courses with certificates in order
  const next = seedFree(importLab(s, await getSetting("lab_hub"), Date.now()), FREE_COURSES, Date.now());
  await setSetting(KEY, JSON.stringify(next));
  return next;
}

export async function mutate(f: (s: CoursesState) => CoursesState): Promise<CoursesState> {
  const next = f(await readState());
  await setSetting(KEY, JSON.stringify(next));
  return next;
}
