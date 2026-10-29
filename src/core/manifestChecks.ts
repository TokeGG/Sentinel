import type { ModuleManifest } from "./module.ts";

const PROFILE_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/; // web profile dir name: no path chars

export function skillRefs(m: ModuleManifest): { what: string; skill: string }[] {
  return [
    ...(m.actions ?? []).map((a) => ({ what: `action "${a.label}"`, skill: a.skill })),
    ...(m.quickAdd ? [{ what: "quickAdd", skill: m.quickAdd.skill }] : []),
    ...(m.forms ?? []).map((f) => ({ what: `form "${f.label}"`, skill: f.skill })),
    ...(m.schedule ? [{ what: "schedule", skill: m.schedule.skill }] : []),
    ...(m.rowAction ? [{ what: "rowAction", skill: m.rowAction.skill }] : []),
  ];
}

// Returns an error message (without the "where" prefix) or null if web config is fine.
export function webError(m: ModuleManifest): string | null {
  if (m.panel !== "web") {
    return m.web ? `web config is only valid on a "web" panel` : null;
  }
  if (!m.web) return `panel "web" needs a web config {url, profile}`;
  let u: URL | null = null;
  try {
    u = new URL(m.web.url);
  } catch {
    // falls through to the error below
  }
  if (!u || u.protocol !== "https:" || !u.hostname || u.username || u.password) {
    return `web.url must be https with a host and no credentials, got ${JSON.stringify(m.web.url)}`;
  }
  if (!PROFILE_PATTERN.test(m.web.profile ?? "")) {
    return `web.profile must match ${PROFILE_PATTERN}, got ${JSON.stringify(m.web.profile)}`;
  }
  return null;
}

export function uiError(m: ModuleManifest): string | null {
  return m.panel === "custom" && typeof m.ui !== "function"
    ? `panel "custom" needs a ui() loader`
    : null;
}
