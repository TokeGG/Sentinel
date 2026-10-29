import { openLink as openUrl } from "../../ui/openLink";
import type { Taste } from "../../core/taste/useTaste";
import { TasteButtons } from "../../ui/TasteButtons";
import { WhyBadge } from "../../ui/WhyBadge";
import { safeLink } from "../../ui/safeLink";
import type { ModuleState } from "../../ui/useModule";
import { timeline } from "./parse";
import type { BillRow } from "./panelLogic";
import { billTaste } from "./taste";

export function BillList({ bills, busy, run, taste, forYou }: { bills: BillRow[]; busy: boolean; run: ModuleState["run"]; taste: Taste; forYou: boolean }) {
  return (
    <ul className="cg-list">
      {taste.order(bills, billTaste, forYou).map((rk) => {
        const b = rk.item;
        const link = safeLink(b.link);
        return (
          <li key={b.ref} className={`cg-card${b.unseen ? " updated" : ""}`}>
            <div className="cg-top">
              <span className="cg-num">{b.number}</span>
              <span className="cg-status">{b.statusLabel || "Unknown status"}</span>
              {b.unseen && <span className="cg-new">UPDATED</span>}
              <span className="ui-meta">{b.statusDate ?? ""}</span>
            </div>
            {link ? (
              <button type="button" className="cg-title ui-link" title={b.title} onClick={() => { void taste.record(billTaste(b), "open"); void openUrl(link); }}>{b.title}</button>
            ) : (
              <span className="cg-title">{b.title}</span>
            )}
            <ol className="cg-steps" aria-label="Status timeline">
              {timeline(b.status).map((s) => (
                <li key={s.label} className={s.state}>{s.label}</li>
              ))}
            </ol>
            {b.history.length > 0 && (
              <ul className="cg-hist">
                {b.history.slice(-3).map((h) => <li key={h.date + h.text}><span className="ui-meta">{h.date}</span> {h.text}</li>)}
              </ul>
            )}
            {b.followed && (b.changes?.length ?? 0) > 0 && (
              <ul className="cg-diff" aria-label="What changed">
                {b.changes!.map((c) => <li key={c.field}><b>{c.field}:</b> <s>{c.from || "—"}</s> → {c.to || "—"}</li>)}
              </ul>
            )}
            <div className="cg-foot">
              {b.sponsor && <span className="ui-meta">Sponsor: {b.sponsor}</span>}
              <span className="cg-acts">
                {forYou && <WhyBadge ranked={rk} />}
                <TasteButtons taste={taste} item={billTaste(b)} />
                {b.unseen && <button type="button" className="ui-btn ui-sm" disabled={busy} onClick={() => void run("mark_seen", { ref: b.ref })}>Mark seen</button>}
                <button
                  type="button"
                  className="ui-btn ui-sm"
                  disabled={busy}
                  aria-pressed={b.followed}
                  onClick={() => void run(b.followed ? "unfollow" : "follow", { kind: "bill", ref: b.ref, label: `${b.number} ${b.title}` })}
                >
                  {b.followed ? "Following ✓" : "Follow"}
                </button>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
