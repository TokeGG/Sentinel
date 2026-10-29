import { test } from "node:test";
import assert from "node:assert/strict";
import { alertsToFire, budgetStatus, calendarRepeat, expiryState, lotSummary, upcomingBills } from "./money.ts";

test("alerts fire above/below once", () => {
  const a = [
    { id: 1, watch_id: 1, dir: "above", price: 100, fired: 0 },
    { id: 2, watch_id: 1, dir: "below", price: 50, fired: 0 },
    { id: 3, watch_id: 1, dir: "above", price: 10, fired: 1 },
    { id: 4, watch_id: 2, dir: "below", price: 5, fired: 0 },
  ];
  assert.deepEqual(alertsToFire(a, new Map([[1, 120], [2, null]])), [1]);
  assert.deepEqual(alertsToFire(a, new Map([[1, 40]])), [2]);
});

test("lot gain/loss", () => {
  assert.deepEqual(lotSummary([{ qty: 2, cost: 10 }, { qty: 1, cost: 20 }], 15), { qty: 3, cost: 40, value: 45, gain: 5, pct: 12.5 });
  assert.equal(lotSummary([{ qty: 1, cost: 1 }], null).gain, null);
});

test("budgets", () => {
  const [b] = budgetStatus([{ category: "food", monthly: 100 }], new Map([["food", 120]]));
  assert.equal(b.over, true);
  assert.equal(b.left, -20);
  assert.equal(b.pct, 100);
});

test("bills roll forward and flag soon", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  const [b, c] = upcomingBills([{ id: 1, name: "rent", amount: 1, due_on: "2026-09-30", cycle: "monthly" }, { id: 2, name: "x", amount: 1, due_on: "2026-12-01", cycle: "once" }], now);
  assert.equal(b.next, "2026-10-30");
  assert.equal(b.soon, true);
  assert.equal(c.soon, false);
  assert.equal(calendarRepeat("yearly"), "none");
});

test("vault expiry", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  assert.equal(expiryState("2026-10-01", now), "expired");
  assert.equal(expiryState("2026-11-10", now), "soon");
  assert.equal(expiryState("2027-11-10", now), null);
  assert.equal(expiryState("", now), null);
});
