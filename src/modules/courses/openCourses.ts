// Opens the Courses panel (used by the Lab's Learn tab). Tauri glue.
import { registry } from "../../core/module";
import { openPanel } from "../../shell/panelApi";

export async function openCourses() {
  const m = registry.find((x) => x.id === "hub.courses");
  if (!m) throw new Error("The Courses module is not available");
  await openPanel(m);
}
