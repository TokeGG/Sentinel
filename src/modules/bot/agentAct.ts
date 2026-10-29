// One action with verification and retries (agent.ts). verify: with strictness >= .5 a click that changed nothing
// counts as failed (and is retried).
import { CLICKY, NO_CHANGE, type Action, type ActionResult, type BrowserDriver } from "./actions.ts";
import { int } from "./brainSpecs.ts";
import type { Brain } from "./kernel/brain.ts";

export async function actVerified(d: { driver: BrowserDriver; brain: Brain; clock: { sleep(ms: number): Promise<void> } }, action: Action, cancelled: () => boolean) {
  const retryLimit = int(d.brain, "retryLimit");
  const strict = (d.brain.verifyStrictness ?? 0.5) >= 0.5 && CLICKY.has(action.type);
  const verify = (r: ActionResult): ActionResult => (strict && r.ok && !r.changed ? { ...r, ok: false, error: NO_CHANGE } : r);
  let res = verify(await d.driver.act(action));
  let retries = 0;
  while (!res.ok && retries < retryLimit && !cancelled()) {
    retries++;
    await d.clock.sleep(d.brain.waitAfterAction ?? 900);
    res = verify(await d.driver.act(action));
  }
  await d.clock.sleep(d.brain.waitAfterAction ?? 900);
  return { res, retries };
}
