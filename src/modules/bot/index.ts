import { registerModule, type ModuleManifest } from "../../core/module";
import { addTextNote, addUrlNote, deleteNote, exportBrain, importBrain, rateRun, resetBrain } from "./ops";
import { botSections } from "./panelLogic";
import { recentEpisodes } from "./store";

// Browser bot: a local model (Ollama on this PC) drives a separate browser window to reach a goal you type.
// It runs ONLY when you press Run in the panel: no schedule, no autostart. Game mode closes its browser.
export const botModule: ModuleManifest = {
  id: "hub.bot",
  name: "Browser Bot",
  accent: "#ff9f5a",
  ring: "system",
  icon: "bot",
  description: "Type a goal; a local model browses in its own window to reach it, asking before anything irreversible. Learns from your notes and thumbs.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: botSections },
  skills: [
    { name: "add_note", run: addTextNote },
    { name: "add_note_url", run: addUrlNote },
    { name: "delete_note", run: deleteNote },
    { name: "rate_run", run: rateRun },
    { name: "export_brain", run: exportBrain },
    { name: "import_brain", run: importBrain },
    { name: "reset_brain", run: resetBrain },
  ],
  load: async () => (await recentEpisodes()) as unknown as Record<string, unknown>[],
};

registerModule(botModule);
