import { useEffect, useMemo, useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { Chip, EmptyState, ErrorLine } from "../../ui/kit";
import { findSkill } from "../../ui/moduleRun";
import { Section, Sections } from "../../ui/useCustomize";
import { useOption } from "../../ui/useOption";
import { useModule } from "../../ui/useModule";
import { Accounts, type Status } from "./Accounts";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import { dividerIndex, filterPosts, mergePosts, platformColor, rowToPost } from "./panelLogic";
import { getLastVisit, markVisited } from "./store";
import "./social.css";

const PAGE = 100;

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const density = useOption("density", "comfortable");
  const showMedia = useOption("showMedia", true);
  const showCounts = useOption("showCounts", true);
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

  const posts = useMemo(() => mergePosts(rows.map(rowToPost)), [rows]);
  const shown = useMemo(() => filterPosts(posts, picked, query), [posts, picked, query]);
  const divider = dividerIndex(shown, lastVisit);
  const labels = Object.fromEntries(status.map((s) => [s.id, s.label]));
  const platforms = [...new Set([...status.filter((s) => s.connected).map((s) => s.id), ...posts.map((p) => p.platform)])];
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const post = async (text: string, targets: string[]) => {
    if ((await run("post_status", { text, targets })) === undefined) return false;
    await run("fetch_all_feeds");
    return true;
  };

  return (
    <>
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{shown.length}</span>
        <button type="button" className="ui-btn" disabled={busy} onClick={() => void run("fetch_all_feeds")}>{busy ? "Working…" : "Refresh"}</button>
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections>
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
          <input className="ui-file-text soc-search" type="search" value={query} placeholder="Search posts…" onChange={(e) => setQuery(e.target.value)} />
        </Section>
        <Section id="feed">
          {shown.length ? (
            <div className={`soc-feed ${density}`}>
              {shown.slice(0, limit).map((p, i) => (
                <div key={`${p.platform}:${p.postId}`}>
                  {i === divider && <div className="soc-divider"><span>New since your last visit</span></div>}
                  <PostCard post={p} label={labels[p.platform] ?? p.platform} showMedia={showMedia} showCounts={showCounts} />
                </div>
              ))}
              {shown.length > limit && <button type="button" className="ui-btn" onClick={() => setLimit(limit + PAGE)}>Show more</button>}
            </div>
          ) : (
            <EmptyState
              title={posts.length ? "No posts match" : "No posts yet"}
              hint={posts.length ? "Clear the filters or search." : "Connect an account under Accounts, then press Refresh."}
            />
          )}
        </Section>
        <Section id="accounts"><Accounts module={module} status={status} busy={busy} run={run} /></Section>
      </Sections>
    </>
  );
}
