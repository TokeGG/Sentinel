import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toTradeRow, toWatchRow } from "./rows.ts";

describe("finance rows", () => {
  it("toWatchRow keeps the generic title and adds panel fields", () => {
    const r = toWatchRow({ id: 3, symbol: "aapl", kind: "stock", last_price: 190.5, last_checked: "t" });
    assert.deepEqual([r.id, r.title, r.kind, r.asset, r.price, r.last_checked], ["w-3", "AAPL (stock): $190.50", "watch", "stock", 190.5, "t"]);
    assert.equal(toWatchRow({ id: 1, symbol: "x", kind: "crypto", last_price: null, last_checked: null }).title, "X (crypto): —");
  });
  it("toTradeRow keeps title/label and adds panel fields", () => {
    const r = toTradeRow({ id: 2, chamber: "house", politician: "A", ticker: null, transaction_type: null, trade_date: "2026-01-01", amount_range: "$1 - $2" });
    assert.deepEqual([r.id, r.title, r.label, r.kind, r.date], ["t-2", "A (house) traded ? — $1 - $2", "2026-01-01", "trade", "2026-01-01"]);
  });
});
