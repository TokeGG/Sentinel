import { getDb, logActivity } from "./db";
import type { ModuleManifest } from "./module";

const timers = new Map<string, ReturnType<typeof setInterval>>();

async function isEnabled(moduleId: string): Promise<boolean> {
  const d = await getDb();
  const rows = await d.select<{ enabled: number }[]>(
    "SELECT enabled FROM schedule_settings WHERE module_id = $1",
    [moduleId]
  );
  return rows[0]?.enabled === 1;
}

function startTimer(module: ModuleManifest) {
  if (!module.schedule || timers.has(module.id)) return;
  const skill = module.skills.find((s) => s.name === module.schedule!.skill);
  if (!skill) return;

  const run = async () => {
    try {
      await skill.run();
    } catch (e) {
      await logActivity(module.id, module.schedule!.skill, "scheduled run failed", String(e));
    }
  };
  timers.set(module.id, setInterval(run, module.schedule.intervalMinutes * 60_000));
}

function stopTimer(moduleId: string) {
  const t = timers.get(moduleId);
  if (t) {
    clearInterval(t);
    timers.delete(moduleId);
  }
}

// Called once at startup: only starts timers for modules the user already
// switched on in a previous session (persisted). Nothing runs on a timer
// just because a module declares `schedule` — see `module.ts`.
export async function initScheduler(registry: ModuleManifest[]) {
  for (const module of registry) {
    if (module.schedule && (await isEnabled(module.id))) {
      startTimer(module);
    }
  }
}

export async function setScheduleEnabled(module: ModuleManifest, enabled: boolean) {
  const d = await getDb();
  await d.execute(
    `INSERT INTO schedule_settings (module_id, enabled) VALUES ($1, $2)
     ON CONFLICT(module_id) DO UPDATE SET enabled = $2`,
    [module.id, enabled ? 1 : 0]
  );
  if (enabled) startTimer(module);
  else stopTimer(module.id);
}

export async function getScheduleEnabled(moduleId: string): Promise<boolean> {
  return isEnabled(moduleId);
}
