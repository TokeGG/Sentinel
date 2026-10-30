// Opens the Bot panel with the Challenge Coach in CTF mode (used by the Lab's Learn tab). Tauri glue.
import { registry } from "../../../core/module";
import { openPanel } from "../../../shell/panelApi";
import { setSetting } from "../../skills/store";
import { COACH_MODE_KEY } from "./coachSql";

export async function openCtfCoach() {
  const bot = registry.find((m) => m.id === "hub.bot");
  if (!bot) throw new Error("The Browser Bot module is not available");
  await setSetting(COACH_MODE_KEY, "ctf");
  await openPanel(bot);
}
