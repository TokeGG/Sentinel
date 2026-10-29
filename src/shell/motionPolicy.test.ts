import test from "node:test";
import assert from "node:assert/strict";
import { shouldAnimate } from "./motionPolicy.ts";
import { anyMotion, getMotion, setGameMode, setOrbitMotion, setOrbitSpeed, setStarMotion, subscribeMotion } from "./motionStore.ts";

const on = { visible: true, gameMode: false, reducedMotion: false, motionOn: true };
test("animates only when visible, no game mode, no reduced motion, motion on", () => {
  assert.equal(shouldAnimate(on), true);
  assert.equal(shouldAnimate({ ...on, visible: false }), false);
  assert.equal(shouldAnimate({ ...on, gameMode: true }), false);
  assert.equal(shouldAnimate({ ...on, reducedMotion: true }), false);
  assert.equal(shouldAnimate({ ...on, motionOn: false }), false);
});
test("motion store notifies only on change and unsubscribes", () => {
  let n = 0;
  const un = subscribeMotion(() => n++);
  setGameMode(true); setGameMode(true); setStarMotion(false);
  assert.equal(n, 2);
  assert.deepEqual(getMotion(), { gameMode: true, starMotion: false, orbitMotion: true, orbitSpeed: 1, notifMoons: true });
  un(); setGameMode(false);
  assert.equal(n, 2);
});
test("orbit settings notify on change; the loop may run if either layer is on", () => {
  let n = 0;
  const un = subscribeMotion(() => n++);
  setStarMotion(false); setOrbitMotion(true);
  assert.equal(anyMotion(), true);
  setOrbitSpeed(1.5); setOrbitSpeed(1.5);
  assert.equal(n, 1);
  setOrbitMotion(false);
  assert.equal(anyMotion(), false);
  setStarMotion(true);
  assert.equal(anyMotion(), true);
  assert.equal(n, 3);
  un(); setOrbitMotion(true); setOrbitSpeed(1);
});
