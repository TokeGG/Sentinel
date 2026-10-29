// The module contract (Core Architecture in the plan doc). Every module —
// built-in or later installed from GitHub — declares one of these. The shell
// never hardcodes module-specific UI beyond what `panel` tells it to render.

import type { ComponentType } from "react";
import type { WebConfig } from "./manifestChecks.ts";
import type { CustomizeDef, Ring } from "./customizeChecks.ts";
import { validateManifest } from "./manifestValidate.ts";
export { validateManifest, ManifestError } from "./manifestValidate.ts";
export type { CustomizeDef, OptionDef, Ring } from "./customizeChecks.ts";

export type PanelKind = "list" | "table" | "chat" | "custom" | "web";

export interface SkillDef {
  name: string;
  run: (args?: Record<string, unknown>) => Promise<unknown>;
}

export interface ActionDef {
  label: string;
  skill: string; // name of a skill in `skills` that takes no required args
}

export interface ModuleManifest {
  id: string;
  name: string;
  description: string;
  panel: PanelKind;
  skills: SkillDef[];
  // Rendered by the generic panel when panel === "list" | "table".
  // Returns rows to display; each module owns its own shape.
  load?: () => Promise<Record<string, unknown>[]>;
  // Zero-arg skills surfaced as buttons in the generic panel (e.g. "Fetch now").
  actions?: ActionDef[];
  // A per-row button (e.g. "Clone") whose skill is called with one arg taken
  // from that row's field named `fromField`.
  rowAction?: { label: string; skill: string; argName: string; fromField: string };
  // A single-field add form the generic panel renders (e.g. "add a feed URL").
  quickAdd?: { skill: string; argName: string; placeholder: string };
  // Secrets this module needs, stored in the OS keychain (never SQLite, never
  // a plaintext file). The generic panel renders one password input per
  // field; `getCredential(module.id, field.key)` reads it back at call time.
  credentialFields?: { key: string; label: string }[];
  // Multi-field forms the generic panel renders below quickAdd/actions —
  // for a skill whose args don't fit one field (Email's send_mail, Pentest's
  // add_engagement/scan_target). Each form is its own small <form>; submit
  // calls `skill` with an object of {fieldKey: value}.
  forms?: {
    skill: string;
    label: string;
    fields: { key: string; label: string; type?: "text" | "password" | "textarea" }[];
  }[];
  // A skill that CAN run on a timer. Off by default everywhere — the
  // scheduler only starts a timer for a module once its toggle is switched
  // on (persisted in `schedule_settings`), never just because this field
  // exists. Keeps "no background task without explicit enable" true.
  schedule?: { skill: string; intervalMinutes: number };
  // panel === "web": an https site in an isolated webview; `profile` names its persistent storage.
  web?: WebConfig;
  accent?: string; // #rrggbb default accent for this module's panel and planet
  ring?: Ring; // star-map orbit ring; default "system" (see ringOf)
  icon?: string; // glyph key in src/shell/icons.ts ICONS, drawn on the planet
  customize?: CustomizeDef; // user-tunable sections/options (generic customize pane)
  // Required for panel === "custom": lazy-loaded panel body.
  ui?: () => Promise<{ default: ComponentType<{ module: ModuleManifest }> }>;
  badge?: () => Promise<number>;
  // Universal search (Ctrl+K). Optional: without it the palette searches the
  // titles of load() rows. Return titles only, never secrets or message bodies.
  search?: (q: string) => Promise<SearchHit[]>;
}

export type SearchHit = { title: string; subtitle?: string; id?: string };

export const ringOf = (m: Pick<ModuleManifest, "ring">): Ring => m.ring ?? "system";
export const registry: ModuleManifest[] = [];

export function registerModule(manifest: ModuleManifest) {
  validateManifest(manifest, registry);
  registry.push(manifest);
}
