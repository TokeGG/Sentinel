import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import { safeLink } from "../../ui/safeLink";
import { ReplyBox } from "./ReplyBox";
import type { ActionKind } from "./actionLogic";
import { linkify, platformColor, postAge, type FeedPost } from "./panelLogic";

const open = (u: string) => void openUrl(u);

export type CardActions = {
  can: { like: boolean; share: boolean; reply: boolean };
  busy: boolean;
  onAct: (kind: ActionKind) => void;
  onReply: (text: string) => Promise<boolean>;
};

export function PostCard({ post: p, label, showMedia, showCounts, actions }: {
  post: FeedPost; label: string; showMedia: boolean; showCounts: boolean; actions?: CardActions;
}) {
  const [replying, setReplying] = useState(false);
  const can = actions?.can;
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
          {can?.like && (
            <button type="button" className={`ui-link soc-act${p.meta.liked ? " on" : ""}`} aria-pressed={!!p.meta.liked} disabled={actions!.busy}
              onClick={() => actions!.onAct(p.meta.liked ? "unlike" : "like")}>{p.meta.liked ? "Liked" : "Like"}</button>
          )}
          {can?.share && (
            <button type="button" className={`ui-link soc-act${p.meta.shared ? " on" : ""}`} aria-pressed={!!p.meta.shared} disabled={actions!.busy}
              onClick={() => actions!.onAct(p.meta.shared ? "unshare" : "share")}>{p.meta.shared ? "Boosted" : p.platform === "bluesky" ? "Repost" : "Boost"}</button>
          )}
          {can?.reply && <button type="button" className="ui-link soc-act" onClick={() => setReplying(!replying)}>Reply</button>}
          {link && <button type="button" className="ui-link soc-open" onClick={() => open(link)}>Open ↗</button>}
        </footer>
        {replying && actions && <ReplyBox platform={p.platform} onSend={actions.onReply} onCancel={() => setReplying(false)} />}
      </div>
    </article>
  );
}
