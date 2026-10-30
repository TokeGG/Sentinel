// One News card: source + tag/reliability badges, title, read-later, highlight note, podcast audio.
import { useState } from "react";
import { openLink as openUrl } from "../../ui/openLink";
import type { Ranked, TasteItem } from "../../core/taste/model";
import type { Taste } from "../../core/taste/useTaste";
import { safeLink } from "../../ui/safeLink";
import { TasteButtons } from "../../ui/TasteButtons";
import type { ModuleRow, ModuleState } from "../../ui/useModule";
import { WhyBadge } from "../../ui/WhyBadge";
import { audioSrc, isAudio } from "./extras";
import { rowAge, sourceLabel } from "./panelLogic";

export function NewsCard({ r, rk, more, item, taste, forYou, run }: {
  r: ModuleRow; rk: Ranked<ModuleRow>; more: number; item: TasteItem; taste: Taste; forYou: boolean; run: ModuleState["run"];
}) {
  const [editing, setEditing] = useState(false);
  const link = safeLink(r.link);
  const later = Number(r.later) === 1;
  const hl = String(r.highlight ?? "");
  const audio = isAudio(r.audio_type, r.audio_url) ? audioSrc(r.audio_url) : null;
  const save = (a: { later?: boolean; highlight?: string }) => void run("set_saved", { id: r.id, later: a.later ?? later, highlight: a.highlight ?? hl });
  return (
    <article className="nw-card">
      <div className="nw-meta">
        {sourceLabel(r) ? <span className="nw-src">{sourceLabel(r)}</span> : null}
        {r.tag ? <span className="nw-badge">{String(r.tag)}</span> : null}
        {r.reliability ? <span className={`nw-badge rel-${String(r.reliability)}`}>{String(r.reliability)}</span> : null}
        <span className="ui-meta">{rowAge(r)}</span>
        {forYou && <WhyBadge ranked={rk} />}
        <TasteButtons taste={taste} item={item} />
      </div>
      {link ? (
        <button type="button" className="nw-title" title={String(r.title)} onClick={() => { void taste.record(item, "open"); void openUrl(link); }}>{String(r.title)}</button>
      ) : <span className="nw-title">{String(r.title)}</span>}
      {r.summary ? <p className="np-sum">{String(r.summary)}</p> : null}
      {more > 0 && <span className="ui-meta">+{more} similar {more === 1 ? "story" : "stories"}</span>}
      {audio && <audio className="nw-audio" controls preload="none" src={audio} />}
      {hl && !editing && <blockquote className="nw-hl">{hl}</blockquote>}
      {editing && (
        <textarea className="ui-file-text" defaultValue={hl} autoFocus aria-label="Highlight" placeholder="Paste a quote or note…"
          onBlur={(e) => { setEditing(false); save({ highlight: e.target.value }); }} />
      )}
      <div className="nw-acts">
        <button type="button" className="ui-btn ui-sm" onClick={() => save({ later: !later })}>{later ? "✓ Later" : "Read later"}</button>
        <button type="button" className="ui-btn ui-sm" onClick={() => setEditing(true)}>{hl ? "Edit highlight" : "Highlight"}</button>
      </div>
    </article>
  );
}
