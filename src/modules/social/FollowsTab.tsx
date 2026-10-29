// "Following & Likes": per platform, who/what you follow and what you liked, where the API allows.
import { useEffect, useState } from "react";
import { openLink as openUrl } from "../../ui/openLink";
import { ErrorLine, Tile } from "../../ui/kit";
import { safeLink } from "../../ui/safeLink";
import { FOLLOW_PLATFORMS, type FollowItem, type FollowLists, type FollowPlatform } from "./follows";
import { connectedIds, loadFollows } from "./followsApi";

const open = (u: string | null) => { const l = safeLink(u); if (l) void openUrl(l).catch(() => {}); };

function List({ title, items }: { title: string; items: FollowItem[] }) {
  return (
    <details open={items.length > 0 && items.length <= 30}>
      <summary>{title} ({items.length})</summary>
      <ul className="soc-follow-list">
        {items.map((it, i) => (
          <li key={`${it.url ?? it.title}-${i}`}>
            {it.url ? <button type="button" className="soc-link" onClick={() => open(it.url)}>{it.title || "(untitled)"}</button> : it.title}
            {it.subtitle && <span className="ui-meta"> {it.subtitle}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function PlatformCard({ p, connected }: { p: FollowPlatform; connected: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<FollowLists | null>(null);
  const load = async () => {
    setBusy(true); setErr(null);
    try { setData(await loadFollows(p.id)); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const hasApi = p.following === "api" || p.liked === "api";
  return (
    <Tile title={`${p.label}${hasApi ? (connected ? " - connected" : "") : " - no API"}`}>
      <p className="ui-meta">{p.note}</p>
      {hasApi && <button type="button" className="ui-btn" disabled={busy} onClick={() => void load()}>{busy ? "Loading…" : data ? "Reload" : "Load"}</button>}
      {p.pages?.map((pg) => <button key={pg.url} type="button" className="ui-btn" onClick={() => open(pg.url)}>Open {pg.label} on {p.label}</button>)}
      {err && <ErrorLine message={err} onDismiss={() => setErr(null)} />}
      {data && p.following === "api" && <List title="Following" items={data.following} />}
      {data && p.liked === "api" && <List title={p.id === "github" ? "Starred" : p.id === "reddit" ? "Upvoted" : p.id === "mastodon" ? "Favourites" : "Liked"} items={data.liked} />}
    </Tile>
  );
}

export function FollowsTab() {
  const [connected, setConnected] = useState<Set<string>>(new Set());
  useEffect(() => { connectedIds().then(setConnected).catch(() => {}); }, []);
  return (
    <div className="soc-col soc-follows">
      <p className="ui-meta">Loads only when you press Load; nothing is stored. Sign-ins come from Settings &gt; Accounts.</p>
      {FOLLOW_PLATFORMS.map((p) => <PlatformCard key={p.id} p={p} connected={connected.has(p.id)} />)}
    </div>
  );
}
