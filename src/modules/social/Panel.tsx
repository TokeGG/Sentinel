import { useEffect, useMemo, useState } from "react";
import { embedHide, embedShow } from "../../shell/panelApi";
import type { ModuleManifest } from "../../core/module";
import { Chip, EmptyState, ErrorLine, Tabs } from "../../ui/kit";
import { findSkill } from "../../ui/moduleRun";
import { Section, Sections } from "../../ui/useCustomize";
import { useOption } from "../../ui/useOption";
import { useModule } from "../../ui/useModule";
import { Accounts, type Status } from "./Accounts";
import { Composer } from "./Composer";
import { PostCard, type CardActions } from "./PostCard";
import { cardActions, postKey } from "./actionLogic";
import { useActions } from "./useActions";
import { dividerIndex, filterPosts, mergePosts, platformColor, rowToPost, type FeedPost } from "./panelLogic";
import { FEED_TAB, SOCIAL_TABS, parseTab, siteOf } from "./embedSites";
import { TasteBar } from "../../ui/TasteBar";
import { useTasteView } from "../../ui/useTasteView";
import { socialTaste } from "./taste";
import { getLastVisit, markVisited } from "./store";
import { useFeedFilters } from "./useFeedFilters";
import { ListsTool } from "./ListsTool";
import "./social.css";

const PAGE = 100;
const TAB_KEY = "soc.tab"; // per-viewer convenience: a raise re-creates this webview

function useTab(panelId: string) {
  const [tab, set] = useState(() => {
    try { return parseTab(localStorage.getItem(TAB_KEY)); } catch { return FEED_TAB; }
  });
  // Show the site's embedded view (or hide them all on Feed). Rust keeps the others alive.
  useEffect(() => {
    const s = siteOf(tab);
    void (s ? embedShow(panelId, s.id, s.url, s.profile, s.hosts) : embedHide(panelId)).catch(() => {});
    try { localStorage.setItem(TAB_KEY, tab); } catch { /* optional */ }
  }, [panelId, tab]);
  return [tab, set] as const;
}

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const [tab, setTab] = useTab(module.id);
  const density = useOption("density", "comfortable");
  const showMedia = useOption("showMedia", true);
  const showCounts = useOption("showCounts", true);
  const showActions = useOption("showActions", true);
  const { taste, forYou, setForYou } = useTasteView(module.id, useOption("taste", true));
  const [status, setStatus] = useState<Status[]>([]);
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  // The divider uses the previous visit; opening the panel marks it visited.
  useEffect(() => {
    getLastVisit().then(setLastVisit).then(markVisited).catch(() => {});
  }, []);
  useEffect(() => {
    findSkill(module, "connection_status").run().then((s) => setStatus(s as Status[])).catch(() => {});
  }, [module, busy]);

  const base = useMemo(() => mergePosts(rows.map(rowToPost)), [rows]);
  const acts = useActions(module, base);
  const posts = acts.view;
  const ff = useFeedFilters();
  const shown = useMemo(() => filterPosts(ff.apply(ff.inbox ?? posts), picked, query), [ff, posts, picked, query]);
  const ranked = useMemo(() => taste.order(shown, socialTaste, forYou), [taste, shown, forYou]);
  const divider = (forYou && !taste.off) || ff.inbox ? -1 : dividerIndex(shown, lastVisit);
  const statusById = Object.fromEntries(status.map((s) => [s.id, s]));
  const labels = Object.fromEntries(status.map((s) => [s.id, s.label]));
  const platforms = [...new Set([...status.filter((s) => s.connected).map((s) => s.id), ...posts.map((p) => p.platform)])];
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const cardProps = (p: FeedPost): CardActions | undefined => {
    const can = cardActions(statusById[p.platform], showActions);
    if (!(can.like || can.share || can.reply)) return undefined;
    return { can, busy: acts.busy.includes(postKey(p)), onAct: (k) => void acts.act(p, k), onReply: (t) => acts.reply(p, t) };
  };

  const post = async (text: string, targets: string[]) => {
    if ((await run("post_status", { text, targets })) === undefined) return false;
    await run("fetch_all_feeds");
    return true;
  };

  return (
    <div className="soc-root">
      <Tabs className="soc-tabs" tabs={SOCIAL_TABS} active={tab} onChange={setTab} />
      {tab === FEED_TAB && <>
      <h2 className="ui-head soc-bar">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{shown.length}</span>
        <button type="button" className="ui-btn soc-refresh" disabled={busy} onClick={() => void run("fetch_all_feeds")}>{busy ? "Working…" : "Refresh"}</button>
      </h2>
      {(error || acts.error || ff.inboxErr) && <ErrorLine message={(error || acts.error || ff.inboxErr)!} />}
      <Sections className="soc-col">
        <Section id="composer"><Composer status={status} busy={busy} onPost={post} /></Section>
        <Section id="filters">
          <div className="ui-chips">
            <Chip on={picked.length === 0} onClick={() => setPicked([])}>All</Chip>
            {platforms.map((id) => (
              <Chip key={id} on={picked.includes(id)} onClick={() => toggle(id)}>
                <i className="soc-dot" style={{ background: platformColor(id) }} />{labels[id] ?? id}
              </Chip>
            ))}
          </div>
          <div className="ui-chips">
            <Chip on={!!ff.inbox} onClick={() => (ff.inbox ? ff.closeInbox() : void ff.loadInbox())}>{ff.inboxBusy ? "Loading…" : "Inbox (mentions & replies)"}</Chip>
            {ff.listNames.map((n) => <Chip key={n} on={ff.list === n} onClick={() => ff.setList(ff.list === n ? null : n)}>☰ {n}</Chip>)}
          </div>
          <TasteBar taste={taste} name="Social" forYou={forYou} onForYou={setForYou} />
          <input className="ui-file-text soc-search" type="search" value={query} placeholder="Search posts…" onChange={(e) => setQuery(e.target.value)} />
        </Section>
        <Section id="feed">
          {shown.length ? (
            <div className={`soc-feed ${density}`}>
              {ranked.slice(0, limit).map((rk, i) => { const p = rk.item; return (
                <div key={`${p.platform}:${p.postId}`}>
                  {i === divider && <div className="soc-divider"><span>New since your last visit</span></div>}
                  <PostCard post={p} label={labels[p.platform] ?? p.platform} showMedia={showMedia} showCounts={showCounts} actions={cardProps(p)} taste={taste} ranked={forYou ? rk : undefined} />
                </div>
              ); })}
              {ranked.length > limit && <button type="button" className="ui-btn soc-more" onClick={() => setLimit(limit + PAGE)}>Show more</button>}
            </div>
          ) : (
            <EmptyState
              title={posts.length ? "No posts match" : "No posts yet"}
              hint={posts.length ? "Clear the filters or search." : "Connect an account under Accounts, then press Refresh."}
            />
          )}
        </Section>
        <Section id="lists"><ListsTool f={ff} /></Section>
        <Section id="accounts"><Accounts module={module} status={status} busy={busy} run={run} /></Section>
      </Sections>
      </>}
    </div>
  );
}
