import type { ModuleManifest } from "./module.ts";

/** Embedded https site. `hosts` = navigation allow-list (default: the url's host);
 *  `size`/`min` = default and minimum panel size. */
export type WebConfig = {
  url: string;
  profile: string;
  hosts?: string[];
  size?: { w: number; h: number };
  min?: { w: number; h: number };
};

const HOST_PATTERN = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const dimOk = (d?: { w: number; h: number }) => d === undefined || (d.w >= 240 && d.h >= 160 && d.w <= 10000 && d.h <= 10000);

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
  const bad = (m.web.hosts ?? []).find((h) => !HOST_PATTERN.test(h) || /(^|\.)localhost$/.test(h));
  if (bad !== undefined) return `web.hosts entry ${JSON.stringify(bad)} must be host.tld or *.host.tld`;
  if (!dimOk(m.web.size) || !dimOk(m.web.min)) return `web.size / web.min must be at least 240x160`;
  return null;
}

export function uiError(m: ModuleManifest): string | null {
  return m.panel === "custom" && typeof m.ui !== "function"
    ? `panel "custom" needs a ui() loader`
    : null;
}
