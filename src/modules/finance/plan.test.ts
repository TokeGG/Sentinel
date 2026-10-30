import { test } from "node:test";
import assert from "node:assert/strict";
import { canAfford, goalProgress, monthlyTotal, recurringCharges, remindersDue, upcomingDividends } from "./plan.ts";
import { addSnapshot, chartPoints, monthChange, monthlyReport, netWorth, searchVault } from "./report.ts";
import { parseCsv, splitLine, toCsv } from "./csv.ts";
import { dueKinds } from "./schedule.ts";

const now = new Date(2026, 9, 30, 12);

test("recurring charges merge subs + recurring bills, skip once", () => {
  const r = recurringCharges(
    [{ id: 1, name: "Netflix", amount: 12, cycle: "monthly", renew_on: "2026-01-05", category: "Fun" }],
    [{ id: 2, name: "Rent", amount: 1000, cycle: "monthly", due_on: "2026-11-01" }, { id: 3, name: "Fee", amount: 5, due_on: "2026-11-01", cycle: "once" }],
    now,
  );
  assert.deepEqual(r.map((x) => [x.name, x.next]), [["Rent", "2026-11-01"], ["Netflix", "2026-11-05"]]);
  assert.equal(monthlyTotal(r), 1012);
  const due = remindersDue(r, ["b2|2026-11-01"], now, 7);
  assert.deepEqual(due.map((x) => x.name), ["Netflix"]);
});

test("can I afford it", () => {
  const b = [{ category: "Fun", monthly: 100 }, { category: "Food", monthly: 300 }];
  const s = new Map([["Fun", 70]]);
  assert.equal(canAfford(20, "Fun", b, s).ok, true);
  assert.equal(canAfford(40, "Fun", b, s).after, -10);
  assert.equal(canAfford(50, "Car", b, s).left, 330);
  assert.equal(canAfford(0, "Fun", b, s).ok, false);
  assert.equal(canAfford(5, "Fun", [], s).ok, false);
});

test("goal progress", () => {
  const g = goalProgress({ id: "a", name: "Trip", target: 1000, saved: 400, by: "2027-04-01" }, now);
  assert.deepEqual(g, { left: 600, pct: 40, perMonth: 100 });
  assert.equal(goalProgress({ id: "a", name: "x", target: 10, saved: 0, by: "" }, now).perMonth, null);
});

test("dividends upcoming only", () => {
  const d = upcomingDividends([{ id: "1", symbol: "a", pay_on: "2026-12-01", amount: 1 }, { id: "2", symbol: "b", pay_on: "2026-01-01", amount: 1 }, { id: "3", symbol: "c", pay_on: "2026-11-01", amount: 1 }], now);
  assert.deepEqual(d.map((x) => x.id), ["3", "1"]);
});

test("net worth snapshots, chart, month change, report", () => {
  let s = addSnapshot([], "2026-09-30", 100);
  s = addSnapshot(s, "2026-10-02", 120);
  s = addSnapshot(s, "2026-10-02", 150);
  assert.equal(s.length, 2);
  assert.equal(monthChange(s, "2026-10"), 50);
  assert.equal(monthChange(s, "2026-08"), null);
  assert.equal(chartPoints(s, 100, 50), "4,46 96,4");
  assert.equal(netWorth([{ watch_id: 1, qty: 2 }], new Map([[1, 10]]), 5, 3), 28);
  const t = monthlyReport("2026-10", new Map([["Food", 50], ["Fun", 120]]), [{ category: "Fun", monthly: 100 }], 50, 12, (n) => `$${n}`);
  assert.match(t, /Total spent: \$170/);
  assert.match(t, /Fun: \$120 of \$100 \(over\)/);
  assert.match(t, /Net worth change: \+\$50/);
});

test("vault search by name/date/notes", () => {
  const v = [{ id: 1, name: "TV receipt", file_name: "tv.pdf", expires_on: "2027-01-01", note: "Best Buy" }, { id: 2, name: "Laptop", file_name: "", expires_on: "2026-05-01", note: "" }];
  assert.deepEqual(searchVault(v, "best").map((x) => x.id), [1]);
  assert.deepEqual(searchVault(v, "2026-05").map((x) => x.id), [2]);
  assert.equal(searchVault(v, " ").length, 2);
});

test("csv round trip and preview errors", () => {
  assert.deepEqual(splitLine('a,"b,c","d""e"'), ["a", "b,c", 'd"e']);
  const text = toCsv([{ symbol: "aapl", kind: "stock", qty: 2, cost: 150, bought_on: "2026-01-02" }]);
  const p = parseCsv(`${text}\nbad sym,stock,1,1,\nbtc,crypto,x,1,\neth,crypto,1,2000,`);
  assert.equal(p.rows.length, 2);
  assert.equal(p.rows[1].bought_on, "");
  assert.equal(p.errors.length, 2);
});

test("scheduled tick due kinds", () => {
  const p = { stockMinutes: 60, cryptoMinutes: 5 };
  assert.deepEqual(dueKinds(10 * 60000, { stock: 0, crypto: 0 }, p), ["crypto"]);
  assert.deepEqual(dueKinds(60 * 60000, { stock: 0, crypto: 0 }, p), ["stock", "crypto"]);
});
