// Pure per-game profiles (app_settings `game_profiles`): which apps to close when a game runs.
// Closing is never automatic: the panel previews the plan and each close needs a confirm.
export interface GameProfile { game: string; close: string[]; pauseSentinel: boolean }
export const PROFILES_KEY = "game_profiles";

// Never offered for closing, whatever a profile says.
export const PROTECTED = ["system", "explorer.exe", "csrss.exe", "winlogon.exe", "lsass.exe", "services.exe", "svchost.exe", "dwm.exe", "smss.exe", "wininit.exe", "sentinel.exe", "msedgewebview2.exe"];

const exe = (s: string) => s.trim().toLowerCase();

export function parseProfiles(text: string | null): GameProfile[] {
  try {
    const v = JSON.parse(text ?? "[]");
    if (!Array.isArray(v)) return [];
    return v.filter((p) => p && typeof p.game === "string" && p.game.trim())
      .map((p) => ({
        game: exe(p.game),
        close: [...new Set((Array.isArray(p.close) ? p.close : []).filter((x: unknown): x is string => typeof x === "string").map(exe).filter(Boolean))] as string[],
        pauseSentinel: p.pauseSentinel !== false,
      })).slice(0, 50);
  } catch { return []; }
}

/** "a.exe, b.exe" -> ["a.exe","b.exe"]. */
export const splitNames = (s: string) => [...new Set(s.split(/[,\n]/).map(exe).filter(Boolean))];

/** The profile whose game is running now, if any. */
export const runningProfile = (profiles: GameProfile[], procs: { name: string }[]) =>
  profiles.find((p) => procs.some((x) => exe(x.name) === p.game)) ?? null;

/** Running processes the profile would close (protected names and the game itself excluded). */
export function closePlan<T extends { pid: number; name: string }>(p: GameProfile, procs: T[]): T[] {
  return procs.filter((x) => { const n = exe(x.name); return p.close.includes(n) && n !== p.game && !PROTECTED.includes(n); });
}
