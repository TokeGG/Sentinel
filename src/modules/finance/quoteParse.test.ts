import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAlphaVantage, parseCoinGecko, parseFinnhub, parseStooq, parseYahoo, stooqSymbol, yahooSymbol } from "./quoteParse.ts";

const close = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 1e-6, `${a} != ${b}`);

describe("finance quote parsers", () => {
  it("maps symbols per provider", () => {
    assert.equal(stooqSymbol("AAPL"), "aapl.us");
    assert.equal(stooqSymbol("aapl.us"), "aapl.us");
    assert.equal(stooqSymbol("brk.b"), "brk-b.us");
    assert.equal(stooqSymbol("^spx"), "^spx");
    assert.equal(yahooSymbol("aapl.us"), "AAPL");
    assert.equal(yahooSymbol("brk.b"), "BRK-B");
  });

  it("parses Stooq CSV (CRLF, header-driven) and N/D", () => {
    const q = parseStooq("Symbol,Date,Time,Open,High,Low,Close,Volume\r\nAAPL.US,2026-10-29,22:00:19,230.1,233,229.5,232.15,51234567\r\n");
    assert.equal(q.price, 232.15);
    close(q.change, 2.05);
    assert.equal(q.at, "2026-10-29T22:00:19");
    assert.throws(() => parseStooq("Symbol,Date,Time,Open,High,Low,Close,Volume\nXX.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D"), /N\/D/);
    assert.throws(() => parseStooq(""), /empty/);
  });

  it("parses Yahoo v8 chart meta and errors", () => {
    const q = parseYahoo({ chart: { result: [{ meta: { regularMarketPrice: 110, chartPreviousClose: 100, regularMarketTime: 1761768000 } }], error: null } });
    assert.equal(q.price, 110);
    close(q.pct, 10);
    assert.ok(q.at?.startsWith("2025-"));
    assert.throws(() => parseYahoo({ chart: { result: null, error: { description: "No data found" } } }), /No data found/);
    assert.throws(() => parseYahoo({}), /no price/);
  });

  it("parses Finnhub and Alpha Vantage", () => {
    const f = parseFinnhub({ c: 50, d: 1, dp: 2.04, pc: 49, t: 1761768000 });
    close(f.change, 1);
    assert.throws(() => parseFinnhub({ c: 0, pc: 0 }), /unknown/);
    const a = parseAlphaVantage({ "Global Quote": { "05. price": "200.00", "08. previous close": "250.00", "07. latest trading day": "2026-10-29" } });
    close(a.pct, -20);
    assert.throws(() => parseAlphaVantage({ Note: "Thank you for using Alpha Vantage! rate limit" }), /rate limit/);
  });

  it("parses CoinGecko simple price", () => {
    const q = parseCoinGecko({ bitcoin: { usd: 110, usd_24h_change: 10, last_updated_at: 1761768000 } }, "bitcoin");
    close(q.change, 10);
    assert.throws(() => parseCoinGecko({}, "nope"), /unknown coin/);
  });
});
