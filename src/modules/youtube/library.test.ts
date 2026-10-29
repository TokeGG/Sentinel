import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { hiddenOf, isHidden, mergeWatched, ratingOf, type Sig, type Watched } from "./library.ts";
import { BACKFILL_SQL, IMPORT_SQL, PLAY_SQL } from "./librarySql.ts";
import { mergeTakeout } from "./takeout.ts";

const w = (id: string, at: string | null, title = id, ch: string | null = null, count = 1): Watched => ({ videoId: id, channelId: ch, title, watchedAt: at, firstAt: at, count });

describe("mergeWatched", () => {
  it("one row per video: latest time + title, earliest first, summed count, newest first", () => {
    const out = mergeWatched([w("a", "2026-01-01 00:00:00", "old"), w("b", "2026-03-01 00:00:00"), w("a", "2026-02-01 00:00:00", "new", "c1"), w("a", "2025-12-01 00:00:00", "older")]);
    assert.deepEqual(out.map((x) => x.videoId), ["b", "a"]);
    assert.deepEqual(out[1], { videoId: "a", channelId: "c1", title: "new", watchedAt: "2026-02-01 00:00:00", firstAt: "2025-12-01 00:00:00", count: 3 });
  });
  it("handles unknown times without losing known ones", () => {
    const [a] = mergeWatched([w("a", null, "x"), w("a", "2026-01-01 00:00:00", "y")]);
    assert.equal(a.watchedAt, "2026-01-01 00:00:00");
    assert.equal(a.firstAt, "2026-01-01 00:00:00");
    const [b] = mergeWatched([w("a", "2026-01-01 00:00:00", "y"), w("a", null, "x")]);
    assert.equal(b.title, "y");
  });
  it("mixes ISO (Takeout) and SQLite timestamps", () => {
    const [a] = mergeWatched([w("a", "2026-01-01T12:00:00.000Z", "iso"), w("a", "2026-01-01 13:00:00", "sql")]);
    assert.equal(a.title, "sql");
  });
  it("mergeTakeout dedupes replays, keeps latest and counts them", () => {
    const item = (t: string | null, title: string) => ({ videoId: "dQw4w9WgXcQ", title, channelId: null, watchedAt: t });
    const out = mergeTakeout([item("2026-10-01T00:00:00Z", "a"), item("2026-10-03T00:00:00Z", "c"), item("2026-10-02T00:00:00Z", "b")]);
    assert.equal(out.length, 1);
    assert.deepEqual([out[0].title, out[0].watchedAt, out[0].firstAt, out[0].count], ["c", "2026-10-03T00:00:00Z", "2026-10-01T00:00:00Z", 3]);
  });
});

describe("signals helpers", () => {
  const s = (kind: "video" | "channel", id: string, signal: Sig["signal"]): Sig => ({ kind, id, signal, channelId: null, title: "", at: null });
  it("hidden sets and rating", () => {
    const sigs = [s("video", "a", "hide"), s("channel", "c", "hide"), s("video", "b", "like")];
    const h = hiddenOf(sigs);
    assert.ok(isHidden(h, "a", null) && isHidden(h, "z", "c") && !isHidden(h, "b", "x") && !isHidden(h, "b", null));
    assert.equal(ratingOf(sigs, "b"), "like");
    assert.equal(ratingOf(sigs, "a"), null);
  });
});

// The exact SQL the store runs, against a real in-memory SQLite.
const SCHEMA = `
CREATE TABLE youtube_watched (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT NOT NULL, channel_id TEXT, title TEXT NOT NULL,
  watched_at TEXT NOT NULL DEFAULT (datetime('now')), secs INTEGER, UNIQUE (video_id, watched_at));
CREATE TABLE youtube_seen (video_id TEXT PRIMARY KEY, channel_id TEXT, title TEXT NOT NULL, first_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_at TEXT NOT NULL DEFAULT (datetime('now')), watch_count INTEGER NOT NULL DEFAULT 1);`;
// plugin-sql uses $1..$n; node:sqlite binds those as named params "$1".
const run = (db: DatabaseSync, sql: string, p: unknown[] = []) => db.prepare(sql).run(Object.fromEntries(p.map((x, i) => [`$${i + 1}`, x ?? null])) as never);
const seen = (db: DatabaseSync) => db.prepare("SELECT * FROM youtube_seen ORDER BY video_id").all() as Record<string, unknown>[];

describe("youtube_seen SQL", () => {
  it("backfill merges old duplicate rows and is idempotent", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(SCHEMA);
    for (const [id, at, title, ch] of [["a", "2026-01-01 10:00:00", "t1", null], ["a", "2026-01-05 10:00:00", "t2", "c1"], ["a", "2026-01-03 10:00:00", "t3", null], ["b", "2026-02-01 00:00:00", "bb", null]])
      db.prepare("INSERT INTO youtube_watched (video_id, channel_id, title, watched_at) VALUES (?, ?, ?, ?)").run(id, ch, title, at);
    db.exec(BACKFILL_SQL);
    db.exec(BACKFILL_SQL);
    const rows = seen(db);
    assert.equal(rows.length, 2);
    assert.deepEqual({ ...rows[0] }, { video_id: "a", channel_id: "c1", title: "t2", first_at: "2026-01-01 10:00:00", last_at: "2026-01-05 10:00:00", watch_count: 3 });
  });
  it("backfill never overwrites rows already in youtube_seen", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(SCHEMA);
    db.prepare("INSERT INTO youtube_watched (video_id, title, watched_at) VALUES ('a', 'old', '2026-01-01 00:00:00')").run();
    run(db, PLAY_SQL, ["a", null, "live"]);
    db.exec(BACKFILL_SQL);
    assert.equal(seen(db)[0].title, "live");
  });
  it("a replay bumps count and last_at but keeps first_at; one row only", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(SCHEMA);
    run(db, PLAY_SQL, ["a", "c1", "t"]);
    db.prepare("UPDATE youtube_seen SET first_at = '2020-01-01 00:00:00', last_at = '2020-01-01 00:00:00'").run();
    run(db, PLAY_SQL, ["a", null, "t2"]);
    const [r] = seen(db);
    assert.equal(seen(db).length, 1);
    assert.deepEqual([r.watch_count, r.first_at, r.channel_id, r.title], [2, "2020-01-01 00:00:00", "c1", "t2"]);
    assert.ok(String(r.last_at) > "2025");
  });
  it("import: dedupes, keeps latest, and re-importing the same file is a no-op", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(SCHEMA);
    const [m] = mergeTakeout([
      { videoId: "a", title: "first", channelId: null, watchedAt: "2026-10-01T00:00:00Z" },
      { videoId: "a", title: "latest", channelId: "c1", watchedAt: "2026-10-03T00:00:00Z" },
    ]);
    for (let i = 0; i < 2; i++) run(db, IMPORT_SQL, [m.videoId, m.channelId, m.title, m.firstAt, m.watchedAt, m.count]);
    const [r] = seen(db);
    assert.equal(seen(db).length, 1);
    assert.deepEqual([r.title, r.first_at, r.last_at, r.watch_count, r.channel_id], ["latest", "2026-10-01 00:00:00", "2026-10-03 00:00:00", 2, "c1"]);
  });
  it("import never replaces a newer local play", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(SCHEMA);
    run(db, PLAY_SQL, ["a", null, "today"]);
    run(db, IMPORT_SQL, ["a", null, "ancient", "2020-01-01 00:00:00", "2020-01-02 00:00:00", 1]);
    const [r] = seen(db);
    assert.deepEqual([r.title, r.first_at, r.watch_count], ["today", "2020-01-01 00:00:00", 1]);
  });
});
