import { openUrl } from "@tauri-apps/plugin-opener";
import { useState, type CSSProperties } from "react";
import { safeLink } from "../../ui/safeLink";
import { ReplyBox } from "./ReplyBox";
import type { ActionKind } from "./actionLogic";
import { linkify, nameHue, platformColor, postAge, type FeedPost } from "./panelLogic";

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
  const n = (v: number | null) => (showCounts && v !== null ? <span>{v}</span> : null);
  const stat = (g: string, v: number | null) => (showCounts && v !== null ? <span className="soc-act static" title={String(v)}>{g} {v}</span> : null);
  return (
    <article className="soc-post">
      {p.avatar ? (
        <img className="soc-avatar" src={p.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span className="soc-avatar soc-initial" style={{ "--h": nameHue(p.name || p.handle) } as CSSProperties} aria-hidden>{(p.name || p.handle).charAt(0).toUpperCase()}</span>
      )}
      <div className="soc-body">
        <header className="soc-meta">
          <strong className="soc-name">{p.name}</strong>
          <span className="ui-meta soc-handle">@{p.handle.replace(/^[@u/]+/, "")}</span>
          <span className="soc-chip" style={{ "--pc": platformColor(p.platform) } as CSSProperties}>{label}</span>
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
          {can?.reply ? <button type="button" className="ui-link soc-act" title="Reply" onClick={() => setReplying(!replying)}>↩ {n(p.replies)}</button> : stat("↩", p.replies)}
          {can?.share ? (
            <button type="button" className={`ui-link soc-act share${p.meta.shared ? " on" : ""}`} aria-pressed={!!p.meta.shared} disabled={actions!.busy}
              title={p.meta.shared ? "Undo" : p.platform === "bluesky" ? "Repost" : "Boost"} onClick={() => actions!.onAct(p.meta.shared ? "unshare" : "share")}>↻ {n(p.reposts)}</button>
          ) : stat("↻", p.reposts)}
          {can?.like ? (
            <button type="button" className={`ui-link soc-act like${p.meta.liked ? " on" : ""}`} aria-pressed={!!p.meta.liked} disabled={actions!.busy}
              title={p.meta.liked ? "Unlike" : "Like"} onClick={() => actions!.onAct(p.meta.liked ? "unlike" : "like")}>{p.meta.liked ? "♥" : "♡"} {n(p.likes)}</button>
          ) : stat("♡", p.likes)}
          {link && <button type="button" className="ui-link soc-open" onClick={() => open(link)}>Open ↗</button>}
        </footer>
        {replying && actions && <ReplyBox platform={p.platform} onSend={actions.onReply} onCancel={() => setReplying(false)} />}
      </div>
    </article>
  );
}
