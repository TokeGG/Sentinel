import { registerModule, type ModuleManifest } from "../../core/module";
import { runDueJobs } from "./jobRunner";
import { addTextNote, addUrlNote, deleteNote, exportBrain, importBrain, rateRun, resetBrain } from "./ops";
import { addJob, deleteJob, deleteSiteNote, deleteWorkflow, enableJob, putSiteNote, saveDemo, saveRunAsWorkflow, shareBrain, updateWorkflow } from "./opsExtras";
import * as more from "./opsMore";
import { botSections } from "./panelLogic";
import { recentEpisodes } from "./store";

// Browser bot: a local model (Ollama on this PC) drives a separate browser window to reach a goal you type.
// It runs when you press Run (or Replay) in the panel. Scheduled jobs exist but are doubly opt-in: the module's
// Auto-refresh toggle (core/scheduler, off by default) AND each job's own switch (off when created). Game mode
// pauses the scheduler and closes its browser.
export const botModule: ModuleManifest = {
  id: "hub.bot",
  name: "Browser Bot",
  accent: "#fea669",
  ring: "system",
  category: "dev",
  icon: "bot",
  description: "Type a goal; a local model browses in its own window to reach it, asking before anything irreversible. Learns from your notes and thumbs.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: botSections },
  schedule: { skill: "run_due_jobs", intervalMinutes: 15 },
  skills: [
    { name: "add_note", run: addTextNote },
    { name: "add_note_url", run: addUrlNote },
    { name: "delete_note", run: deleteNote },
    { name: "rate_run", run: rateRun },
    { name: "export_brain", run: exportBrain },
    { name: "import_brain", run: importBrain },
    { name: "reset_brain", run: resetBrain },
    { name: "share_brain", run: shareBrain },
    { name: "save_run_workflow", run: saveRunAsWorkflow },
    { name: "save_demo", run: saveDemo },
    { name: "update_workflow", run: updateWorkflow },
    { name: "delete_workflow", run: deleteWorkflow },
    { name: "add_job", run: addJob },
    { name: "enable_job", run: enableJob },
    { name: "delete_job", run: deleteJob },
    { name: "run_due_jobs", run: runDueJobs },
    { name: "put_site_note", run: putSiteNote },
    { name: "delete_site_note", run: deleteSiteNote },
    ...([["save_settings", more.saveSettings], ["save_site_rules", more.saveRules], ["rate_skill", more.rateSkill], ["reset_skill_scores", more.resetScores],
      ["set_boost_weight", more.setBoostWeight], ["save_prompts", more.savePrompts], ["save_routines", more.saveRoutines], ["export_recipe", more.exportRecipe],
      ["import_recipe", more.importRecipe], ["update_note", more.updateNote], ["delete_lesson", more.deleteLesson], ["clear_memory", more.clearMemory]] as const).map(([name, run]) => ({ name, run })),
  ],
  load: async () => (await recentEpisodes()) as unknown as Record<string, unknown>[],
};

registerModule(botModule);
