// validateManifest(): rejects a bad manifest at registration (split out of module.ts for the size cap).
import { skillRefs, uiError, webError } from "./manifestChecks.ts";
import { accentError, customizeError, iconError, ringError } from "./customizeChecks.ts";
import { categoryError } from "./categories.ts";
import type { ModuleManifest, PanelKind } from "./module.ts";

const PANEL_KINDS: PanelKind[] = ["list", "table", "chat", "custom", "web"];
const ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/; // reverse-DNS, e.g. "hub.notes"

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
    throw new ManifestError(`${where}: panel "${m.panel}" needs a load() to render anything`);
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
  if (m.search !== undefined && typeof m.search !== "function") {
    throw new ManifestError(`${where}: search must be a function`);
  }
  const extraErr = webError(m) ?? uiError(m) ?? accentError(m.accent) ?? ringError(m.ring) ??
    iconError(m.icon) ?? customizeError(m.customize) ?? categoryError(m.category);
  if (extraErr) throw new ManifestError(`${where}: ${extraErr}`);
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

