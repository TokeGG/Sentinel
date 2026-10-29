// Public OAuth client IDs. Ship them here (they are not secrets) or let the user
// paste their own in Settings > Accounts > Client IDs (stored in app_settings).
// Empty = "Add a client ID" step; see docs/ACCOUNTS.md for the free registrations.
export const CLIENT_IDS: Record<string, string> = {
  google: "",
  microsoft: "",
  twitch: "",
  github: "",
  reddit: "",
};

export const clientIdSettingKey = (group: string): string => `client_id:${group}`;

/** A user override wins over the shipped ID. "" = none configured. */
export function resolveClientId(group: string, overrides: Record<string, string | undefined>, shipped = CLIENT_IDS): string {
  return (overrides[group] ?? "").trim() || (shipped[group] ?? "").trim();
}
