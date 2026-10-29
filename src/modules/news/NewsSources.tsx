// News > Sources tab: the curated catalog plus your own feeds, with status from Check sources.
import { NEWS_CATEGORIES } from "./catalog/index";
import { SourceList, type SourceApi } from "./sources/SourceList";
import { checkNewsSources, listNewsSources, removeNewsSource, setNewsEnabled } from "./sourceStore";

const API: SourceApi = { list: listNewsSources, setEnabled: setNewsEnabled, remove: removeNewsSource, check: checkNewsSources };
const CATS = [...NEWS_CATEGORIES.map(({ id, label }) => ({ id, label })), { id: "other", label: "Your own / other" }];

export function NewsSources() {
  return (
    <div className="nw-sources">
      <p className="ui-meta">Curated feeds are added once and start “unverified”. Press Check sources to fetch each one and mark it working or broken; switch off or remove what you don't want (removed feeds are not re-added).</p>
      <SourceList api={API} categories={CATS} busy={false} />
    </div>
  );
}
