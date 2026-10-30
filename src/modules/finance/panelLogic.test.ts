import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  changeInfo, changePct, emptyHistory, financeSections, fmtPrice, pctText, shownParts, sortTrades, tradeSizeText, trackPrices, tradeView,
} from "./panelLogic.ts";

describe("finance panelLogic", () => {
  it("changePct is zero/NaN safe", () => {
    assert.equal(changePct(100, 110), 10);
    assert.equal(changePct(200, 150), -25);
    assert.equal(changePct(0, 5), null);
    assert.equal(changePct(NaN, 5), null);
    assert.equal(changePct(5, NaN), null);
    assert.equal(changePct(null, 5), null);
    assert.equal(changePct(5, 5), 0);
  });
  it("pctText signs and rounds", () => {
    assert.equal(pctText(1.234), "+1.23%");
    assert.equal(pctText(-0.5), "-0.50%");
    assert.equal(pctText(0), "0.00%");
    assert.equal(pctText(null), "—");
  });
  it("fmtPrice: thousands, 2dp, small crypto keeps decimals, bad -> dash", () => {
    assert.equal(fmtPrice(1234.5), "$1,234.50");
    assert.equal(fmtPrice(67000), "$67,000.00");
    assert.equal(fmtPrice(1), "$1.00");
    assert.equal(fmtPrice(0.5), "$0.50");
    assert.equal(fmtPrice(0.1234567), "$0.1235");
    assert.equal(fmtPrice(0.00001234), "$0.00001234");
    assert.equal(fmtPrice(null), "—");
    assert.equal(fmtPrice(NaN), "—");
    assert.equal(fmtPrice(0), "$0.00");
  });
  it("tradeSizeText compacts disclosure ranges", () => {
    assert.equal(tradeSizeText("$1,001 - $15,000"), "$1k–$15k");
    assert.equal(tradeSizeText("$250,001 - $500,000"), "$250k–$500k");
    assert.equal(tradeSizeText("$1,000,001 - $5,000,000"), "$1M–$5M");
    assert.equal(tradeSizeText("Over $50,000,000"), "Over $50,000,000");
    assert.equal(tradeSizeText(null), "—");
    assert.equal(tradeSizeText("  "), "—");
  });
  it("sortTrades: newest first, mixed date formats, unknown last, stable", () => {
    const rows = [
      { id: 1, date: "2026-01-05" },
      { id: 2, date: "03/02/2026" },
      { id: 3, date: null },
      { id: 4, date: "2026-03-02" },
      { id: 5, date: "garbage" },
    ];
    assert.deepEqual(sortTrades(rows).map((r) => r.id), [2, 4, 1, 3, 5]);
    assert.deepEqual(rows.map((r) => r.id), [1, 2, 3, 4, 5]); // input untouched
  });
  it("trackPrices keeps timestamped session points, keyed by kind:symbol", () => {
    const w = (p: number | null, t: string | null, asset = "stock") => [{ symbol: "aapl", asset, price: p, last_checked: t }];
    let h = trackPrices(emptyHistory(), w(100, "2026-10-22 10:00:00"));
    assert.deepEqual(h.series["stock:aapl"], [{ price: 100, at: "2026-10-22 10:00:00" }]);
    h = trackPrices(h, w(100, "2026-10-22 10:00:00")); // same check re-rendered: no duplicate
    assert.equal(h.series["stock:aapl"].length, 1);
    h = trackPrices(h, w(101, "t2"));
    h = trackPrices(h, w(101, "t3")); // flat but newly checked: still a point
    assert.deepEqual(h.series["stock:aapl"].map((x) => x.price), [100, 101, 101]);
    assert.equal(trackPrices(h, w(null, null)).series["stock:aapl"].length, 3);
    let g = emptyHistory();
    for (let p = 1; p <= 40; p++) g = trackPrices(g, w(p, `t${p}`));
    assert.equal(g.series["stock:aapl"].length, 30);
    assert.equal(g.series["stock:aapl"][29].price, 40);
  });
  it("same symbol under two kinds keeps separate series and seen stamps", () => {
    const rows = (a: number, c: number, t: string) => [
      { symbol: "dash", asset: "stock", price: a, last_checked: t },
      { symbol: "dash", asset: "crypto", price: c, last_checked: t },
    ];
    let h = trackPrices(emptyHistory(), rows(10, 30, "t1"));
    h = trackPrices(h, rows(10, 30, "t1")); // idempotent re-render
    assert.deepEqual(h.series["stock:dash"].map((x) => x.price), [10]);
    assert.deepEqual(h.series["crypto:dash"].map((x) => x.price), [30]);
    h = trackPrices(h, rows(11, 33, "t2"));
    assert.deepEqual(h.series["stock:dash"].map((x) => x.price), [10, 11]);
    assert.deepEqual(h.series["crypto:dash"].map((x) => x.price), [30, 33]);
  });
  it("changeInfo: change + on-screen span from the previous point's stored timestamp", () => {
    const now = new Date("2026-10-28T10:00:00Z");
    const c = changeInfo([{ price: 100, at: "2026-10-22 10:00:00" }, { price: 108.4, at: "2026-10-28 09:59:30" }], now);
    assert.equal(Math.round((c.pct as number) * 100) / 100, 8.4);
    assert.equal(c.caption, "since 6d ago");
    assert.equal(changeInfo([{ price: 100, at: "2026-10-28 09:55:00" }, { price: 101, at: "x" }], now).caption, "since 5m ago");
    assert.equal(changeInfo([{ price: 100, at: "2026-10-28 09:59:50" }, { price: 101, at: "x" }], now).caption, "since moments ago");
  });
  it("changeInfo shows nothing without a usable previous point or timestamp", () => {
    const now = new Date("2026-10-28T10:00:00Z");
    const none = { pct: null, caption: "" };
    assert.deepEqual(changeInfo([], now), none);
    assert.deepEqual(changeInfo([{ price: 1, at: "2026-10-22 10:00:00" }], now), none);
    assert.deepEqual(changeInfo([{ price: 1, at: null }, { price: 2, at: "t" }], now), none);
    assert.deepEqual(changeInfo([{ price: 1, at: "garbage" }, { price: 2, at: "t" }], now), none);
    assert.deepEqual(changeInfo([{ price: 0, at: "2026-10-22 10:00:00" }, { price: 2, at: "t" }], now), none);
  });
  it("tradeView derives display fields from sparse rows", () => {
    const v = tradeView({ id: "t-1", politician: "A B", chamber: "senate", ticker: "NVDA", transaction_type: "Purchase", amount_range: "$1,001 - $15,000", date: "2026-03-02" });
    assert.deepEqual([v.who, v.ticker, v.type, v.size, v.date], ["A B (Sen)", "NVDA", "Buy", "$1k–$15k", "2026-03-02"]);
    const s = tradeView({ id: "t-2", politician: "X", chamber: "house", transaction_type: "Sale (Partial)" });
    assert.deepEqual([s.who, s.ticker, s.type, s.size, s.date, s.tone], ["X (Rep)", "—", "Sell", "—", "—", "down"]);
    assert.equal(tradeView({ id: "t-3", transaction_type: "Purchase" }).tone, "up");
    assert.equal(tradeView({ id: "t-4" }).who, "Unknown");
  });
  it("shownParts: tabs pick one data section; hidden/absent sections never leave nothing", () => {
    const all = ["tabs", "watchlist", "congress", "add", "actions", "tools"];
    assert.deepEqual(shownParts(all, "watchlist"), { tab: "watchlist", watchlist: true, congress: false });
    assert.deepEqual(shownParts(all, "congress"), { tab: "congress", watchlist: false, congress: true });
    // active tab's section hidden -> fall to the visible one
    assert.deepEqual(shownParts(["tabs", "congress"], "watchlist"), { tab: "congress", watchlist: false, congress: true });
    assert.deepEqual(shownParts(["tabs", "watchlist"], "congress"), { tab: "watchlist", watchlist: true, congress: false });
    // tabs hidden -> every visible data section is shown
    assert.deepEqual(shownParts(["watchlist", "congress"], "congress"), { tab: "congress", watchlist: true, congress: true });
    assert.deepEqual(shownParts(["congress"], "watchlist"), { tab: "congress", watchlist: false, congress: true });
  });
  it("section ids", () => {
    assert.deepEqual(financeSections.map((s) => s.id), ["tabs", "watchlist", "congress", "add", "actions", "tools", "plan"]);
  });
  it("every <Section id> in Panel.tsx is declared, and vice versa", () => {
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, financeSections.map((s) => s.id).sort());
  });
});
