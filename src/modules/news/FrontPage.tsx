// Newspaper layout for one section: lead story (headline, image, summary) + secondary stories in ruled columns.
import { openLink as openUrl } from "../../ui/openLink";
import type { Ranked } from "../../core/taste/model";
import type { Taste } from "../../core/taste/useTaste";
import { safeLink } from "../../ui/safeLink";
import type { ModuleRow, ModuleState } from "../../ui/useModule";
import { EmptyState } from "../../ui/kit";
import { frontPage, imageSrc, type Story } from "./front";
import { NewsCard } from "./NewsCard";
import { rowAge, sourceLabel } from "./panelLogic";
import { newsTaste } from "./taste";

type R = ModuleRow & { _rk: Ranked<ModuleRow> };

function Lead({ s, taste }: { s: Story<R>; taste: Taste }) {
  const r = s.lead;
  const link = safeLink(r.link);
  const img = imageSrc(r.image);
  const open = () => { if (!link) return; void taste.record(newsTaste(r), "open"); void openUrl(link); };
  return (
    <article className="np-lead">
      {img && <img className="np-lead-img" src={img} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      <div className="np-lead-body">
        <span className="np-kicker">{s.sources > 1 ? `Trending · ${s.sources} sources` : sourceLabel(r)} · {rowAge(r)}</span>
        <h2 className="np-lead-head"><button type="button" onClick={open} disabled={!link}>{String(r.title)}</button></h2>
        {r.summary ? <p className="np-lead-sum">{String(r.summary)}</p> : null}
        {s.more.length > 0 && <p className="ui-meta">Also: {[...new Set(s.more.map(sourceLabel))].slice(0, 4).join(", ")}</p>}
      </div>
    </article>
  );
}

export function FrontPage({ stories, taste, forYou, run, empty }: {
  stories: Story<R>[]; taste: Taste; forYou: boolean; run: ModuleState["run"]; empty: string;
}) {
  const { lead, rest } = frontPage(stories);
  if (!lead) return <EmptyState title={empty} hint="Press Fetch now, or add feeds in Sources." />;
  return (
    <div className="np-page">
      <Lead s={lead} taste={taste} />
      <div className="np-cols">
        {rest.map(({ lead: r, more }) => (
          <NewsCard key={String(r.id)} r={r} rk={r._rk} more={more.length} item={newsTaste(r)} taste={taste} forYou={forYou} run={run} />
        ))}
      </div>
    </div>
  );
}
