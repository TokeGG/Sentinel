// Opt-in daily prep: only when the owner ticked "Prepare a daily puzzle" (app_settings coach_daily, off by default) AND
// switched on the Bot module's Auto-refresh (core/scheduler). It caches today's puzzle; it never submits anything.
import { getSetting, setSetting } from "../../skills/store";
import { loadAoc } from "./aoc";
import { getAocCookie, savePuzzle } from "./coachStore";
import { COACH_DAILY_KEY, COACH_TODAY_KEY } from "./coachSql";
import { practiceForDay } from "./bundled";
import { aocKey, todayAoc } from "./puzzles";

export async function prepareDaily(now = new Date()): Promise<string | null> {
  if ((await getSetting(COACH_DAILY_KEY)) !== "1") return null;
  const aoc = todayAoc(now);
  let key: string;
  if (aoc && (await getAocCookie().catch(() => null))) {
    key = aocKey(aoc.year, aoc.day);
    if ((await getSetting(COACH_TODAY_KEY)) === key) return key;
    await loadAoc(aoc.year, aoc.day);
  } else {
    const p = practiceForDay(Math.floor(now.getTime() / 86_400_000));
    key = p.key;
    await savePuzzle(p);
  }
  await setSetting(COACH_TODAY_KEY, key);
  return key;
}
