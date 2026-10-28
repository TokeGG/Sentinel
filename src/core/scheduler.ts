import type { ModuleManifest } from "./module";

// `./db` (and @tauri-apps/plugin-sql) is imported lazily so tests can load
// this file under plain node with injected deps.
const db = () => import("./db");

type Handle = ReturnType<typeof setInterval>;
export interface SchedulerDeps {
  isEnabled: (moduleId: string) => Promise<boolean>;
  setInterval: (fn: () => void, ms: number) => Handle;
  clearInterval: (h: Handle) => void;
}
const defaults: SchedulerDeps = {
  isEnabled,
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h),
};

const timers = new Map<string, Handle>();
// True while game mode is active: no timer may start (including via
// setScheduleEnabled) until resumeEnabled() clears it.
let paused = false;

async function isEnabled(moduleId: string): Promise<boolean> {
  const d = await (await db()).getDb();
  const rows = await d.select<{ enabled: number }[]>(
    "SELECT enabled FROM schedule_settings WHERE module_id = $1",
    [moduleId]
  );
  return rows[0]?.enabled === 1;
}

function startTimer(module: ModuleManifest, deps: SchedulerDeps = defaults) {
  if (paused || !module.schedule || timers.has(module.id)) return;
  const skill = module.skills.find((s) => s.name === module.schedule!.skill);
  if (!skill) return;

  const run = async () => {
    try {
      await skill.run();
    } catch (e) {
      await (await db()).logActivity(module.id, module.schedule!.skill, "scheduled run failed", String(e));
    }
  };
  timers.set(module.id, deps.setInterval(run, module.schedule.intervalMinutes * 60_000));
}

function stopTimer(moduleId: string, deps: SchedulerDeps = defaults) {
  const t = timers.get(moduleId);
  if (t) {
    deps.clearInterval(t);
    timers.delete(moduleId);
  }
}

// Called once at startup: only starts timers for modules the user already
// switched on in a previous session (persisted). Nothing runs on a timer
// just because a module declares `schedule` — see `module.ts`.
export async function initScheduler(registry: ModuleManifest[], deps: SchedulerDeps = defaults) {
  for (const module of registry) {
    if (module.schedule && (await deps.isEnabled(module.id))) {
      startTimer(module, deps);
    }
  }
}

// Game mode (Task 8): stop every timer; the toggles in SQLite are untouched.
export function pauseAll(deps: SchedulerDeps = defaults): void {
  paused = true;
  for (const t of timers.values()) deps.clearInterval(t);
  timers.clear();
}

// Leaving game mode: same rule as startup — only persisted-on modules.
export function resumeEnabled(registry: ModuleManifest[], deps: SchedulerDeps = defaults): Promise<void> {
  paused = false;
  return initScheduler(registry, deps);
}

// Timers are owned ONLY by the main window. Panel webviews load the same
// bundle but must never start timers (they escape game-mode pause and would
// duplicate the main window's); they persist the toggle and ask main to sync.
let owner = false;
export function setTimersOwner(isMain: boolean): void {
  owner = isMain;
}

export const SCHEDULE_CHANGED = "schedule-changed";
export interface ToggleDeps {
  persist: (moduleId: string, enabled: boolean) => Promise<void>;
  notify: (moduleId: string) => Promise<void>;
}
const toggleDefaults: ToggleDeps = {
  persist: async (moduleId, enabled) => {
    const d = await (await db()).getDb();
    await d.execute(
      `INSERT INTO schedule_settings (module_id, enabled) VALUES ($1, $2)
       ON CONFLICT(module_id) DO UPDATE SET enabled = $2`,
      [moduleId, enabled ? 1 : 0]
    );
  },
  notify: async (moduleId) => {
    const { emit } = await import("@tauri-apps/api/event");
    await emit(SCHEDULE_CHANGED, { moduleId });
  },
};

export async function setScheduleEnabled(
  module: ModuleManifest, enabled: boolean,
  deps: SchedulerDeps = defaults, toggle: ToggleDeps = toggleDefaults
) {
  await toggle.persist(module.id, enabled);
  if (owner) await syncModule(module, deps);
  else await toggle.notify(module.id);
}

// Main window: bring one module's timer in line with its persisted toggle.
// startTimer already refuses while paused (game mode).
export async function syncModule(module: ModuleManifest, deps: SchedulerDeps = defaults) {
  if (await deps.isEnabled(module.id)) startTimer(module, deps);
  else stopTimer(module.id, deps);
}

export async function getScheduleEnabled(moduleId: string): Promise<boolean> {
  return isEnabled(moduleId);
}
