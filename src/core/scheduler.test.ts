import { test } from "node:test";
import assert from "node:assert/strict";
import { initScheduler, pauseAll, resumeEnabled, setScheduleEnabled, setTimersOwner, syncModule, type SchedulerDeps } from "./scheduler.ts";
import type { ModuleManifest } from "./module.ts";

function mod(id: string, scheduled = true): ModuleManifest {
  return {
    id, name: id, panel: "list", load: async () => [],
    skills: [{ name: "refresh", description: "", run: async () => {} }],
    ...(scheduled ? { schedule: { skill: "refresh", intervalMinutes: 1 } } : {}),
  } as unknown as ModuleManifest;
}

function fakes(enabled: string[]) {
  let next = 1;
  const live = new Set<number>();
  const started: number[] = [];
  const deps: SchedulerDeps = {
    isEnabled: async (id) => enabled.includes(id),
    setInterval: (_fn, ms) => { const h = next++; live.add(h); started.push(ms); return h as never; },
    clearInterval: (h) => { live.delete(h as unknown as number); },
  };
  return { deps, live, started };
}

test("resumeEnabled starts only user-enabled modules", async () => {
  const f = fakes(["a"]);
  await resumeEnabled([mod("a"), mod("b")], f.deps);
  assert.equal(f.live.size, 1);
  assert.deepEqual(f.started, [60_000]);
  pauseAll(f.deps);
});

test("resumeEnabled never starts a module without schedule", async () => {
  const f = fakes(["a", "c"]);
  await resumeEnabled([mod("c", false)], f.deps);
  assert.equal(f.live.size, 0);
  pauseAll(f.deps);
});

test("pauseAll clears every timer", async () => {
  const f = fakes(["a", "b"]);
  await resumeEnabled([mod("a"), mod("b")], f.deps);
  assert.equal(f.live.size, 2);
  pauseAll(f.deps);
  assert.equal(f.live.size, 0);
  await resumeEnabled([mod("a")], f.deps);
  assert.equal(f.live.size, 1, "a restarts after pause");
  pauseAll(f.deps);
});

test("no timer starts while paused (game mode) until resumeEnabled", async () => {
  const f = fakes(["a"]);
  pauseAll(f.deps);
  await initScheduler([mod("a")], f.deps);
  assert.equal(f.live.size, 0, "paused blocks starts");
  await resumeEnabled([mod("a")], f.deps);
  assert.equal(f.live.size, 1);
  pauseAll(f.deps);
  await resumeEnabled([], f.deps); // leave module state unpaused for other tests
});

function toggles() {
  const persisted: [string, boolean][] = [];
  const notified: string[] = [];
  return {
    persisted, notified,
    deps: {
      persist: async (id: string, on: boolean) => { persisted.push([id, on]); },
      notify: async (id: string) => { notified.push(id); },
    },
  };
}

test("non-owner setScheduleEnabled persists but starts no timer and requests sync", async () => {
  const f = fakes(["a"]);
  const t = toggles();
  setTimersOwner(false);
  await setScheduleEnabled(mod("a"), true, f.deps, t.deps);
  assert.deepEqual(t.persisted, [["a", true]]);
  assert.deepEqual(t.notified, ["a"]);
  assert.equal(f.live.size, 0);
});

test("owner sync starts enabled module unless paused", async () => {
  const f = fakes(["a"]);
  setTimersOwner(true);
  pauseAll(f.deps);
  await syncModule(mod("a"), f.deps);
  assert.equal(f.live.size, 0, "paused: no start");
  await resumeEnabled([], f.deps);
  await syncModule(mod("a"), f.deps);
  assert.equal(f.live.size, 1);
  pauseAll(f.deps);
  await resumeEnabled([], f.deps);
});

test("owner sync stops a disabled module", async () => {
  const enabled = ["a"];
  const f = fakes(enabled);
  setTimersOwner(true);
  await syncModule(mod("a"), f.deps);
  assert.equal(f.live.size, 1);
  enabled.length = 0;
  await syncModule(mod("a"), f.deps);
  assert.equal(f.live.size, 0);
});
