// State + derived lists + card actions for the YouTube panel (kept out of Panel.tsx for size).
import { emit } from "@tauri-apps/api/event";
import { useMemo, useState } from "react";
import { registry, type ModuleManifest } from "../../core/module";
import { openPanel } from "../../shell/panelApi";
import { ago } from "../../ui/kit";
import { utcDate } from "../../ui/kit/format";
import { findSkill } from "../../ui/moduleRun";
import { score } from "../../core/taste/model";
import { useTaste } from "../../core/taste/useTaste";
import { useModule } from "../../ui/useModule";
import type { Card, CardActions } from "./Cards";
import { byGroup } from "./extras";
import { ratingOf } from "./library";
import { recommend, type Video } from "./recommend";
import { splitRows, watchUrl } from "./panelLogic";
import { agoLabel, filterVideos, matchWatched, upNext, type View } from "./viewLogic";
import { videoTaste } from "./taste";
import { useYtExtras } from "./useYtExtras";
import { useLive } from "./LiveView";
import { popOut } from "./popOut";
import { buildQueue } from "./queue";

const age = (d: string | null) => (d ? agoLabel(ago(utcDate(d))) : "");

export function useYt(module: ModuleManifest) {
  const m = useModule(module);
  const { rows, run } = m;
  const [view, setView] = useState<View>("home");
  const [chip, setChipRaw] = useState("all");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<Card | null>(null);
  const [mini, setMini] = useState(false);
  const [forYou, setForYou] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const taste = useTaste(module.id);
  const d = useMemo(() => splitRows(rows), [rows]);
  const x = useYtExtras(d.videos);
  const live = useLive(run);
  const seen = useMemo(() => new Set(d.watched.map((w) => w.videoId)), [d.watched]);
  const queue = useMemo(() => new Set(d.later.map((l) => l.videoId)), [d.later]);
  const names = useMemo(() => new Map(d.channels.map((c) => [c.channelId, c.title])), [d.channels]);

  const card = (v: Video): Card => ({ videoId: v.videoId, channelId: v.channelId, channel: v.channel, title: v.title, meta: age(v.publishedAt), dim: seen.has(v.videoId) });
  const useTasteScore = forYou && !taste.off;
  const rec = useMemo(() => recommend(d.videos, d.watched, Date.now(), 8, d.signals, useTasteScore ? (v) => 1.5 * score(videoTaste(v), taste.profile) : undefined), [d, taste.profile, useTasteScore]);
  const latest = byGroup(filterVideos(d.videos, { chip: chip.startsWith("grp:") ? "all" : chip, query, seen, signals: d.signals }), chip, x.groups).slice(0, 60).map(card);
  const q = query.trim().toLowerCase();
  const byQuery = (c: Card) => !q || c.title.toLowerCase().includes(q) || c.channel.toLowerCase().includes(q);
  const named = (id: string | null) => (id ? (names.get(id) ?? "") : "");
  const laterCards: Card[] = d.later.map((l) => ({ videoId: l.videoId, channelId: l.channelId, channel: named(l.channelId), title: l.title, meta: age(l.addedAt) && `saved ${age(l.addedAt)}` })).filter(byQuery);
  const historyCards: Card[] = matchWatched(d.watched, query).slice(0, 120).map((w) => ({
    videoId: w.videoId, channelId: w.channelId, channel: named(w.channelId), title: w.title,
    meta: [age(w.watchedAt), w.count > 1 ? `watched ${w.count}×` : ""].filter(Boolean).join(" · "),
  }));

  const sig = (kind: "video" | "channel", id: string, signal: string, c: Card) => {
    void taste.record(videoTaste(c), signal === "like" ? "like" : signal === "dislike" ? "dislike" : "dismiss");
    void run("set_signal", { kind, id, signal, channelId: c.channelId, title: kind === "channel" ? c.channel : c.title });
  };
  const act: CardActions = {
    play: (c) => { void taste.record(videoTaste(c), "open"); setPlaying(c); setMini(false); setView("watch"); void run("mark_watched", { videoId: c.videoId, channelId: c.channelId, title: c.title }); },
    later: (c, on) => void run(on ? "add_later" : "remove_later", { videoId: c.videoId, channelId: c.channelId, title: c.title }),
    notInterested: (c) => sig("video", c.videoId, "hide", c),
    hideChannel: (c) => c.channelId && sig("channel", c.channelId, "hide", c),
  };
  const rate = (r: "like" | "dislike") => {
    if (!playing) return;
    if (ratingOf(d.signals, playing.videoId) === r) void run("clear_signal", { kind: "video", id: playing.videoId, signal: r });
    else sig("video", playing.videoId, r, playing);
  };
  async function chat(c: Card | null = playing) {
    const chatMod = registry.find((mm) => mm.id === "hub.chat");
    if (!chatMod || !c) return setNote("The Chat module is not available");
    try {
      setNote(null);
      const out = (await findSkill(chatMod, "add_room").run({ input: watchUrl(c.videoId), site: "youtube", label: `YT ${c.title.slice(0, 24)}` })) as { id?: string };
      await emit("chat-rooms-changed", { id: out?.id });
      await openPanel(chatMod);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  }
  // Opening a channel's chip marks its uploads seen (clears its part of the moon).
  const setChip = (c: string) => { setChipRaw(c); if (c.startsWith("ch:")) x.markSeen(c.slice(3)); };
  const go = (v: View) => { setView(v); setNote(null); };
  const visible = filterVideos(d.videos, { chip: "all", query: "", seen, signals: d.signals });
  const next = playing ? upNext(playing.videoId, rec, visible, seen).map(card) : [];
  // Pop-out: continue through Watch later / the playlist holding it, else Up next.
  const pop = (c: Card) => void popOut(buildQueue(c, [laterCards, ...x.playlists.map((p) => p.items)], next, x.resumeAt(c.videoId)))
    .then(() => { setMini(false); if (view === "watch") setView("home"); }).catch((e) => setNote(e instanceof Error ? e.message : String(e)));
  const recCards = rec.map((v) => ({ ...card(v), meta: `${age(v.publishedAt)} · ${v.why}` }));

  return { ...m, d, x, view, go, setView, chip, setChip, query, setQuery, q, playing, setPlaying, mini, setMini, forYou, setForYou, taste, note,
    seen, queue, named, latest, recCards, laterCards, historyCards, act, rate, chat, next, live, pop, rating: playing ? ratingOf(d.signals, playing.videoId) : null };
}
