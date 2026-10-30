// Courses storage: one JSON value in app_settings `courses` (Tauri glue; logic lives in logic.ts / plan.ts).
import { getSetting, setSetting } from "../../ui/appSetting";
import { KEY, parseState, type CoursesState } from "./logic";
import { importLab } from "./plan";

export async function readState(): Promise<CoursesState> {
  const s = parseState(await getSetting(KEY));
  if (s.imported) return s;
  const next = importLab(s, await getSetting("lab_hub"), Date.now()); // once: copies the Lab hub's course list
  await setSetting(KEY, JSON.stringify(next));
  return next;
}

export async function mutate(f: (s: CoursesState) => CoursesState): Promise<CoursesState> {
  const next = f(await readState());
  await setSetting(KEY, JSON.stringify(next));
  return next;
}
