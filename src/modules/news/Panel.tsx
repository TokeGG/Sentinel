import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { FeedPanel } from "./FeedPanel";
import { TasteBar } from "../../ui/TasteBar";
import { useOption } from "../../ui/useOption";
import { useTasteView } from "../../ui/useTasteView";
import { groupStories, viewRows, type NewsView } from "./extras";
import { NewsCard } from "./NewsCard";
import { NewsTools, useTopics } from "./NewsTools";
import { newsTaste } from "./taste";

// Headlines open via the opener plugin (a real button, never an <a href>).
export default function Panel({ module }: { module: ModuleManifest }) {
  const { taste, forYou, setForYou } = useTasteView(module.id, useOption("taste", true));
  const grouped = useOption("grouped", true);
  const { topics, reload } = useTopics();
  const [view, setView] = useState<NewsView>("all");
  return (
    <FeedPanel
      module={module}
      listId="headlines"
      empty="No headlines yet"
      toolbar={({ rows, busy, run }) => (
        <>
          <TasteBar taste={taste} name="News" forYou={forYou} onForYou={setForYou} />
          <NewsTools rows={rows} busy={busy} run={run} taste={taste} topics={topics} reloadTopics={reload} view={view} setView={setView} />
        </>
      )}
      list={(rows, _busy, run) => {
        const ranked = taste.order(viewRows(rows, view, topics), newsTaste, forYou && view !== "topics");
        const groups = grouped ? groupStories(ranked.map((rk) => ({ ...rk.item, _rk: rk }))) : ranked.map((rk) => ({ lead: { ...rk.item, _rk: rk }, more: [] }));
        return (
          <div className="nw-grid">
            {groups.map(({ lead, more }) => {
              const r = lead as Record<string, unknown>;
              return <NewsCard key={String(r.id)} r={r} rk={lead._rk} more={more.length} item={newsTaste(r)} taste={taste} forYou={forYou} run={run} />;
            })}
          </div>
        );
      }}
    />
  );
}
