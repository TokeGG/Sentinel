import { openUrl } from "@tauri-apps/plugin-opener";
import type { Taste } from "../../core/taste/useTaste";
import { TasteButtons } from "../../ui/TasteButtons";
import { WhyBadge } from "../../ui/WhyBadge";
import { safeLink } from "../../ui/safeLink";
import type { ModuleState } from "../../ui/useModule";
import { memberTaste } from "./taste";
import { seat, tallyText, type MemberRow, type VoteRow } from "./panelLogic";

export function VoteList({ votes }: { votes: VoteRow[] }) {
  return (
    <ul className="cg-list">
      {votes.map((v) => {
        const link = safeLink(v.link);
        const pass = /pass|agree|confirm|adopt|enact/i.test(v.result);
        return (
          <li key={v.ref} className="cg-card">
            <div className="cg-top">
              <span className="cg-num">{v.chamber === "senate" ? "Senate" : v.chamber === "house" ? "House" : "Vote"}</span>
              <span className={`cg-status ${pass ? "ok" : "no"}`}>{v.result || "—"}</span>
              <span className="ui-meta">{v.votedAt ?? ""}</span>
            </div>
            {link ? (
              <button type="button" className="cg-title ui-link" title={v.question} onClick={() => void openUrl(link)}>{v.question}</button>
            ) : (
              <span className="cg-title">{v.question}</span>
            )}
            <div className="cg-foot">
              <span className="ui-meta">{tallyText(v)}</span>
              {v.bill && <span className="ui-src">{v.bill}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function MemberList({ members, busy, run, taste, forYou }: { members: MemberRow[]; busy: boolean; run: ModuleState["run"]; taste: Taste; forYou: boolean }) {
  return (
    <ul className="cg-members">
      {taste.order(members, memberTaste, forYou).slice(0, 300).map((rk) => {
        const m = rk.item;
        const link = safeLink(m.link);
        return (
          <li key={m.ref} className="cg-member">
            <span className={`cg-party p-${m.party || "x"}`} title={m.party}>{m.party || "?"}</span>
            {link ? (
              <button type="button" className="ui-link" title={m.name} onClick={() => void openUrl(link)}>{m.name}</button>
            ) : (
              <span>{m.name}</span>
            )}
            <span className="ui-meta">{seat(m)}</span>
            {forYou && <WhyBadge ranked={rk} />}
            <TasteButtons taste={taste} item={memberTaste(m)} />
            <button type="button" className="ui-btn ui-sm" disabled={busy} aria-pressed={m.followed} onClick={() => void run(m.followed ? "unfollow" : "follow", { kind: "member", ref: m.ref, label: m.name })}>
              {m.followed ? "★" : "☆"}
            </button>
          </li>
        );
      })}
      {members.length > 300 && <li className="ui-meta">Showing 300 of {members.length}; narrow the search.</li>}
    </ul>
  );
}
