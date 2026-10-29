import { registerModule, type ModuleManifest } from "../../core/module";
import { confirmPlan, listModels, planFromForm, removeInstalled, saveEnvSecret, saveModel, setEnabled, updatePlan } from "./actions";
import { loadItems } from "./items";
import { skillsSections } from "./panelLogic";

// Skills & MCP hub. Skills are inert markdown (see registry.ts: listSkills/getSkill);
// MCP servers are separate processes that run only after the user flips them on
// (see mcp.ts: listMcpTools/callMcpTool). Nothing here runs in the background.
export const skillsModule: ModuleManifest = {
  id: "hub.skills",
  name: "Skills & MCP",
  accent: "#fd93e5",
  ring: "system",
  icon: "skills",
  description: "Skills and MCP servers: bundled examples plus anything you install from GitHub after confirming the exact files and command. Nothing runs until you switch it on.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: skillsSections },
  credentialFields: [{ key: "github_pat", label: "GitHub token (optional, only raises the API rate limit)" }],
  skills: [
    { name: "set_enabled", run: setEnabled },
    { name: "plan_install", run: planFromForm },
    { name: "plan_update", run: updatePlan },
    { name: "confirm_plan", run: confirmPlan },
    { name: "remove_item", run: removeInstalled },
    { name: "save_secret", run: saveEnvSecret },
    { name: "list_models", run: listModels },
    { name: "save_model", run: saveModel },
  ],
  load: async () => (await loadItems()) as unknown as Record<string, unknown>[],
};

registerModule(skillsModule);
