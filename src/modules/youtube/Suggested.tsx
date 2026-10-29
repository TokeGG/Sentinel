// "Suggested channels" starter list under Channels: one Add per @handle (resolved by add_channel).
import type { ModuleState } from "../../ui/useModule";
import { notFollowed } from "./suggested";

export function Suggested({ handles, busy, run }: { handles: (string | null | undefined)[]; busy: boolean; run: ModuleState["run"] }) {
  const list = notFollowed(handles);
  if (!list.length) return null;
  return (
    <details className="yt-suggested">
      <summary>Suggested channels ({list.length}, unverified)</summary>
      {list.map((s) => (
        <div key={s.handle} className="yt-chrow">
          <span className="yt-meta"><span className="yt-ctitle">{s.handle}</span><span className="ui-meta">{s.topic}</span></span>
          <button type="button" className="ui-btn" disabled={busy} onClick={() => void run("add_channel", { url: s.handle })}>Add</button>
        </div>
      ))}
    </details>
  );
}
