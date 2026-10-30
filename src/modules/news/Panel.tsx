// News as a newspaper: masthead, section tabs, a trending lead story and ruled columns.
import { useMemo, useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { FeedPanel } from "./FeedPanel";
import type { ModuleRow } from "../../ui/useModule";
import { TasteBar } from "../../ui/TasteBar";
import { useOption, useStartTab } from "../../ui/useOption";
import { useTasteView } from "../../ui/useTasteView";
import { viewRows, type NewsView } from "./extras";
import { NewsTools, useTopics } from "./NewsTools";
import { newsTaste } from "./taste";
import { Tabs } from "../../ui/kit";
import { CongressTab } from "./CongressTab";
import { NewsSources } from "./NewsSources";
import { FrontPage } from "./FrontPage";
import { NewsViewCtx } from "./Reader";
import { NewsPrefs } from "./NewsPrefs";
import { useSpoilers, useWordList } from "../../ui/wordList";
import { ALERT_KEY, BLOCK_KEY, withoutBlocked } from "./newsPrefsLogic";
import { SECTIONS, masthead, sectionOf, trending, type SectionId } from "./front";

const EMPTY: Record<string, string> = { front: "No headlines yet", foryou: "Nothing to recommend yet", later: "Nothing saved for later" };

export default function Panel({ module }: { module: ModuleManifest }) {
  const { taste, forYou, setForYou } = useTasteView(module.id, useOption("taste", true));
  const grouped = useOption("grouped", true);
  const { topics, reload } = useTopics();
  const [view, setView] = useState<NewsView>("all");
  const [chosen, setSec] = useState<SectionId | null>(null);
  const sec = useStartTab(SECTIONS, chosen) as SectionId;
  const spoil = useSpoilers();
  const blocked = useWordList(BLOCK_KEY);
  const alerts = useWordList(ALERT_KEY);
  const fontPx = useOption("fontSize", 15);
  const widthCh = useOption("readWidth", 70);
  const vp = { headlineOnly: useOption("headlineOnly", false), fontPx, widthCh, spoilers: spoil.words };
  const head = useMemo(() => masthead(new Date()), []);
  const tabs = <Tabs className="np-tabs" tabs={[...SECTIONS]} active={sec} onChange={(id) => setSec(id as SectionId)} />;
  const top = (
    <header className="np-mast">
      <div className="np-mast-line"><span>{head.date}</span><span>{head.edition}</span></div>
      <h1 className="np-title">The Sentinel</h1>
    </header>
  );
  const style = { "--nw-fs": `${fontPx}px`, "--nw-w": `${widthCh}ch` } as React.CSSProperties;
  const frame = (body: React.ReactNode) => <NewsViewCtx.Provider value={vp}><div className="nw-top np-paper" style={style}>{top}{tabs}{body}</div></NewsViewCtx.Provider>;
  if (sec === "sources") return frame(<NewsSources />);
  if (sec === "congress") return frame(<CongressTab />);
  return frame(
    <FeedPanel
      module={module}
      listId="headlines"
      empty="No headlines yet"
      toolbar={({ rows, busy, run }) => (
        <details className="np-tools">
          <summary className="ui-meta">Topics, views & presets</summary>
          <TasteBar taste={taste} name="News" forYou={forYou} onForYou={setForYou} />
          <NewsPrefs blocked={blocked} alerts={alerts} spoil={spoil} />
          <NewsTools rows={rows} busy={busy} run={run} taste={taste} topics={topics} reloadTopics={reload} view={view} setView={setView} />
        </details>
      )}
      list={(all, _busy, run) => {
        const rows = withoutBlocked(all, blocked.words);
        const base = sec === "later" ? viewRows(rows, "later", topics) : sec === "front" || sec === "foryou" ? viewRows(rows, view, topics) : rows.filter((r) => sectionOf(r) === sec);
        const ranked = taste.order(base, newsTaste, forYou || sec === "foryou");
        const items = ranked.map((rk) => ({ ...rk.item, _rk: rk }) as ModuleRow & { _rk: typeof rk });
        const score = new Map(ranked.map((rk) => [rk.item.id, rk.score]));
        const stories = grouped
          ? trending(items, Date.now(), (r) => (forYou ? Number(score.get(r.id) ?? 0) : 0))
          : items.map((r) => ({ lead: r, more: [], sources: 1, score: 0 }));
        if (sec === "foryou") stories.sort((a, b) => Number(score.get(b.lead.id) ?? 0) - Number(score.get(a.lead.id) ?? 0));
        return <FrontPage stories={stories} taste={taste} forYou={forYou} run={run} empty={EMPTY[sec] ?? "Nothing in this section yet"} />;
      }}
    />,
  );
}
