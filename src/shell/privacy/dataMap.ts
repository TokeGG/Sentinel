// Pure: which tables and app_settings keys belong to which module (Settings > Data map).
// Tables are matched by prefix against the live table list, so new tables of a module show up on their own.
export interface ModuleData { id: string; name: string; prefixes: string[]; tables?: string[]; keys: string[] }

// keys: exact app_settings keys or prefixes ending in "*".
export const MODULE_DATA: ModuleData[] = [
  { id: "hub.notes", name: "Notes", prefixes: ["note"], tables: ["notes", "snippets", "vault_docs", "clip_pins"], keys: [] },
  { id: "hub.news", name: "News", prefixes: ["news_"], keys: ["src_state:news"] },
  { id: "hub.deals", name: "Deals", prefixes: ["deal"], keys: ["src_state:deals"] },
  { id: "hub.finance", name: "Finance", prefixes: ["fin_", "finance"], tables: ["quotes", "watchlist"], keys: [] },
  { id: "hub.email", name: "Email", prefixes: ["mail_"], keys: [] },
  { id: "hub.social", name: "Social", prefixes: ["social_"], keys: [] },
  { id: "hub.youtube", name: "YouTube", prefixes: ["youtube_", "yt_"], keys: ["yt_*"] },
  { id: "hub.chat", name: "Chat", prefixes: ["chat_"], keys: [] },
  { id: "hub.calendar", name: "Calendar", prefixes: ["calendar_"],
    tables: ["reminders", "habits", "habit_checks", "focus_sessions", "contacts", "subscriptions", "expenses", "bookmarks", "time_blocks"], keys: ["focus_until"] },
  { id: "hub.homenet", name: "Home Network", prefixes: ["network_", "net_"], keys: ["net_nicknames", "net_ping_targets", "homenet_scan_last"] },
  { id: "hub.pccare", name: "PC Care", prefixes: ["pc_"], keys: ["disk_hist", "game_profiles", "update_list"] },
  { id: "hub.pentest", name: "Pentest Lab", prefixes: ["pentest_", "lab_", "engagement"], keys: ["lab_guide", "lab_mode"] },
  { id: "hub.github", name: "GitHub", prefixes: ["cloned_", "github"], keys: [] },
  { id: "hub.congress", name: "Congress", prefixes: ["congress_"], keys: ["congress_my_seat"] },
  { id: "hub.browser", name: "Browser", prefixes: ["browser_"], keys: ["links_open_in"] },
  { id: "hub.games", name: "Games", prefixes: ["game_"], keys: [] },
  { id: "hub.media", name: "Media", prefixes: ["media_"], keys: [] },
  { id: "hub.skills", name: "Skills & MCP", prefixes: ["mcp_"], tables: ["installed_skills"], keys: ["local_model"] },
  { id: "hub.backup", name: "Backup", prefixes: [], keys: ["backup_last"] },
  { id: "hub.weather", name: "Weather", prefixes: ["weather"], keys: [] },
  { id: "hub.clipboard", name: "Clipboard", prefixes: ["clipboard"], keys: [] },
];

// Never offered for wiping: the shell's own bookkeeping.
export const SHELL_TABLES = ["panel_layout", "app_settings", "panel_prefs", "_sqlx_migrations", "sqlite_sequence", "activity_log", "notif_log"];
const SAFE = /^[a-z_][a-z0-9_]*$/;

export function tablesOf(m: ModuleData, all: string[]): string[] {
  return all.filter((t) => SAFE.test(t) && !SHELL_TABLES.includes(t)
    && ((m.tables ?? []).includes(t) || m.prefixes.some((p) => t.startsWith(p)))).sort();
}

export function keysOf(m: ModuleData, allKeys: string[]): string[] {
  const own = [`modset:${m.id}`, `taste_off:${m.id.replace(/^hub\./, "")}`, `client_id:${m.id}`];
  return allKeys.filter((k) => own.includes(k) || m.keys.some((p) => (p.endsWith("*") ? k.startsWith(p.slice(0, -1)) : k === p))).sort();
}

/** Tables in no module's list (shown so the map is honest about what it doesn't know). */
export function unmapped(all: string[]): string[] {
  const owned = new Set(MODULE_DATA.flatMap((m) => tablesOf(m, all)));
  return all.filter((t) => !owned.has(t) && !SHELL_TABLES.includes(t) && !t.startsWith("sqlite_")).sort();
}

export interface WipeStep { sql: string; args: string[]; label: string }

/** Wipe = delete every row of the module's tables + its settings keys + saved views. Preview shows these labels. */
export function wipePlan(m: ModuleData, tables: string[], keys: string[]): WipeStep[] {
  return [
    ...tables.filter((t) => SAFE.test(t)).map((t) => ({ sql: `DELETE FROM ${t}`, args: [], label: `all rows of ${t}` })),
    ...resetPlan(m, keys),
  ];
}

/** Reset to defaults = forget settings and saved views, keep the data. */
export function resetPlan(m: ModuleData, keys: string[]): WipeStep[] {
  return [
    ...keys.map((k) => ({ sql: "DELETE FROM app_settings WHERE key = $1", args: [k], label: `setting ${k}` })),
    { sql: "DELETE FROM panel_prefs WHERE module_id = $1", args: [m.id], label: "saved panel views" },
  ];
}
