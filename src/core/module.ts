// The module contract (Core Architecture in the plan doc). Every module —
// built-in or later installed from GitHub — declares one of these. The shell
// never hardcodes module-specific UI beyond what `panel` tells it to render.

import { skillRefs, webError } from "./manifestChecks.ts";

export type PanelKind = "list" | "table" | "chat" | "custom" | "web";

const PANEL_KINDS: PanelKind[] = ["list", "table", "chat", "custom", "web"];
const ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/; // reverse-DNS, e.g. "hub.notes"

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
  // For panel === "web": an https site shown in an isolated webview, with its
  // own persistent profile (cookies/storage) named by `profile`.
  web?: { url: string; profile: string };
}

export class ManifestError extends Error {}

// Rejects a bad manifest before it ever reaches the registry — this is the
// "invalid manifest, duplicate ID, missing dependency ... rejected with
// actionable errors" acceptance criterion from the plan's Foundation milestone.
export function validateManifest(m: ModuleManifest, existing: ModuleManifest[]) {
  const where = `module manifest ${m.id ?? "(no id)"}`;

  if (!m.id || !ID_PATTERN.test(m.id)) {
    throw new ManifestError(
      `${where}: id must be reverse-DNS style (e.g. "hub.notes"), got ${JSON.stringify(m.id)}`
    );
  }
  if (existing.some((e) => e.id === m.id)) {
    throw new ManifestError(`${where}: duplicate module id`);
  }
  if (!m.name?.trim()) {
    throw new ManifestError(`${where}: name is required`);
  }
  if (!m.description?.trim()) {
    throw new ManifestError(`${where}: description is required`);
  }
  if (!PANEL_KINDS.includes(m.panel)) {
    throw new ManifestError(
      `${where}: panel must be one of ${PANEL_KINDS.join(", ")}, got ${JSON.stringify(m.panel)}`
    );
  }
  if (!Array.isArray(m.skills)) {
    throw new ManifestError(`${where}: skills must be an array (can be empty)`);
  }
  const seen = new Set<string>();
  for (const s of m.skills) {
    if (!s.name?.trim()) {
      throw new ManifestError(`${where}: every skill needs a name`);
    }
    if (seen.has(s.name)) {
      throw new ManifestError(`${where}: duplicate skill name "${s.name}"`);
    }
    if (typeof s.run !== "function") {
      throw new ManifestError(`${where}: skill "${s.name}" is missing run()`);
    }
    seen.add(s.name);
  }
  if ((m.panel === "list" || m.panel === "table") && !m.load) {
    throw new ManifestError(
      `${where}: panel "${m.panel}" needs a load() to render anything`
    );
  }
  for (const f of m.forms ?? []) {
    if (f.fields.length === 0) {
      throw new ManifestError(`${where}: form "${f.label}" has no fields`);
    }
  }
  for (const r of skillRefs(m)) {
    if (!seen.has(r.skill)) {
      throw new ManifestError(`${where}: ${r.what} references unknown skill "${r.skill}"`);
    }
  }
  if (m.schedule && m.schedule.intervalMinutes < 1) {
    throw new ManifestError(`${where}: schedule.intervalMinutes must be >= 1`);
  }
  const webErr = webError(m);
  if (webErr) throw new ManifestError(`${where}: ${webErr}`);
  const credKeys = new Set<string>();
  for (const f of m.credentialFields ?? []) {
    if (!f.key?.trim()) {
      throw new ManifestError(`${where}: a credentialField needs a key`);
    }
    if (credKeys.has(f.key)) {
      throw new ManifestError(`${where}: duplicate credentialField key "${f.key}"`);
    }
    credKeys.add(f.key);
  }
}

export const registry: ModuleManifest[] = [];

export function registerModule(manifest: ModuleManifest) {
  validateManifest(manifest, registry);
  registry.push(manifest);
}
