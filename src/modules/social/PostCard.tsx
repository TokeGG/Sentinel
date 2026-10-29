import { openUrl } from "@tauri-apps/plugin-opener";
import { safeLink } from "../../ui/safeLink";
import { linkify, platformColor, postAge, type FeedPost } from "./panelLogic";

const open = (u: string) => void openUrl(u);

export function PostCard({ post: p, label, showMedia, showCounts }: { post: FeedPost; label: string; showMedia: boolean; showCounts: boolean }) {
  const link = safeLink(p.link);
  const counts = [["↩", p.replies], ["⟲", p.reposts], ["♥", p.likes]].filter(([, n]) => n !== null);
  return (
    <article className="soc-post">
      {p.avatar ? (
        <img className="soc-avatar" src={p.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span className="soc-avatar soc-initial" aria-hidden>{(p.name || p.handle).charAt(0).toUpperCase()}</span>
      )}
      <div className="soc-body">
        <header className="soc-meta">
          <strong className="soc-name">{p.name}</strong>
          <span className="ui-meta soc-handle">@{p.handle.replace(/^[@u/]+/, "")}</span>
          <span className="soc-chip" style={{ background: platformColor(p.platform) }}>{label}</span>
          <span className="ui-meta soc-age" title={p.postedAt ?? ""}>{postAge(p.postedAt)}</span>
        </header>
        <p className="soc-text">
          {linkify(p.text).map((s, i) =>
            s.url ? (
              <button key={i} type="button" className="soc-link" onClick={() => open(s.url!)}>{s.text}</button>
            ) : (
              <span key={i}>{s.text}</span>
            )
          )}
        </p>
        {showMedia && p.media.length > 0 && (
          <div className="soc-media">
            {p.media.slice(0, 4).map((m) => (
              <img key={m} src={m} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ))}
          </div>
        )}
        <footer className="soc-foot">
          {showCounts && counts.map(([g, n]) => <span key={g} className="ui-meta">{g} {n}</span>)}
          {link && <button type="button" className="ui-link soc-open" onClick={() => open(link)}>Open ↗</button>}
        </footer>
      </div>
    </article>
  );
}
