import type { ModuleState } from "../../ui/useModule";
import { EmptyState } from "../../ui/kit";
import { Avatar } from "./Cards";
import type { Sig } from "./library";
import type { Channel } from "./panelLogic";

// Channel management: open one (Home filtered to it), remove, and restore what was hidden.
export function ChannelsView({ channels, signals, busy, run, onOpen }: { channels: Channel[]; signals: Sig[]; busy: boolean; run: ModuleState["run"]; onOpen(id: string): void }) {
  const hidden = signals.filter((s) => s.signal === "hide");
  const names = new Map(channels.map((c) => [c.channelId, c.title]));
  return (
    <div className="yt-chlist">
      {channels.length === 0 && <EmptyState title="No channels" hint="Use Add channel by link: a channel URL, @handle or UC… id." />}
      {channels.map((c) => (
        <div key={c.channelId} className="yt-chrow">
          <Avatar name={c.title} />
          <button type="button" className="yt-meta" onClick={() => onOpen(c.channelId)}>
            <span className="yt-ctitle">{c.title}</span>
            {c.handle && <span className="ui-meta">{c.handle}</span>}
          </button>
          <button type="button" className="ui-btn" disabled={busy} onClick={() => void run("remove_channel", { channelId: c.channelId })}>Remove</button>
        </div>
      ))}
      {hidden.length > 0 && (
        <>
          <h4 className="yt-sub">Hidden ({hidden.length})</h4>
          {hidden.map((s) => (
            <div key={`${s.kind}:${s.id}`} className="yt-chrow">
              <span className="yt-meta"><span className="yt-ctitle">{s.kind === "channel" ? (names.get(s.id) ?? s.id) : s.title || s.id}</span><span className="ui-meta">{s.kind === "channel" ? "channel" : "video"}</span></span>
              <button type="button" className="ui-btn" disabled={busy} onClick={() => void run("clear_signal", { kind: s.kind, id: s.id, signal: "hide" })}>Restore</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
