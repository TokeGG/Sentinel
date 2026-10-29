// Pure help + first-run tour content, generated from manifests (name/description).
export type HelpEntry = { id: string; name: string; description: string; extras: string[] };
type M = { id: string; name: string; description: string; actions?: unknown[]; schedule?: unknown; credentialFields?: unknown[]; search?: unknown; badge?: unknown };

export function helpEntries(mods: M[], q = ""): HelpEntry[] {
  const t = q.trim().toLowerCase();
  return mods
    .map((m) => ({
      id: m.id, name: m.name, description: m.description,
      extras: [
        m.schedule ? "optional auto-refresh (off until you enable it)" : "",
        m.credentialFields?.length ? "secrets kept in the OS keychain" : "",
        m.badge ? "notification moon (counts only)" : "",
        m.actions?.length ? `${m.actions.length} quick action${m.actions.length === 1 ? "" : "s"} in Ctrl+K` : "",
      ].filter(Boolean),
    }))
    .filter((e) => !t || `${e.name} ${e.description}`.toLowerCase().includes(t))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const TOUR: { title: string; body: string }[] = [
  { title: "Welcome to Sentinel", body: "Every planet is a module. Click one to open its panel; drag the strip to move it." },
  { title: "The sun", body: "The sun opens the Master Hub: missed notifications (counts only), snooze and do-not-disturb." },
  { title: "Ctrl+K", body: "Search everything: open panels, run module actions, toggle settings, find notes, news, deals and more." },
  { title: "Layouts", body: "Save named layouts (work, gaming, stream) from Ctrl+K, tile panels, focus one panel with Ctrl+Shift+F." },
  { title: "Your choice", body: "Nothing runs in the background unless you turn it on. Hotkeys, tray toasts and start-with-Windows are in Settings > Desktop." },
];
