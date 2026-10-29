// "My representatives": enter state + district; shows your senators/House member and their recent votes.
import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { EmptyState } from "../../ui/kit";
import { safeLink } from "../../ui/safeLink";
import type { ModuleState } from "../../ui/useModule";
import type { MemberRow } from "./panelLogic";
import { seat as seatOf } from "./panelLogic";
import { getSeat, listRepVotes } from "./repStore";
import { myReps, seatText, type Seat } from "./reps";

export function MyReps({ members, busy, run }: { members: MemberRow[]; busy: boolean; run: ModuleState["run"] }) {
  const [seat, setSeat] = useState<Seat | null>(null);
  const [text, setText] = useState("");
  const [votes, setVotes] = useState<Awaited<ReturnType<typeof listRepVotes>>>([]);
  useEffect(() => {
    void getSeat().then((s) => { setSeat(s); if (s) setText(seatText(s)); }).catch(() => {});
    void listRepVotes().then(setVotes).catch(() => {});
  }, [members]);
  const save = async () => { await run("set_seat", { seat: text }); setSeat(await getSeat()); };
  const reps = seat ? myReps(members, seat) : [];
  return (
    <div className="cg-mine">
      <div className="ui-controls">
        <input className="ui-file-text" value={text} onChange={(e) => setText(e.target.value)} placeholder='State + district, e.g. "CA 12"' aria-label="Your state and district" />
        <button type="button" className="ui-btn ui-sm" disabled={busy} onClick={() => void save()}>Save</button>
      </div>
      <p className="ui-meta">Stored locally only. Recent votes are fetched on the next Sync (GovTrack, no key).</p>
      {!seat ? <EmptyState title="No district set" hint="Enter your state code and district number." /> : !reps.length ? <EmptyState title="No members found" hint="Press Sync Congress first." /> : (
        <ul className="cg-list">
          {reps.map((m) => {
            const mv = votes.filter((v) => v.member_id === m.ref).slice(0, 8);
            return (
              <li key={m.id} className="cg-card">
                <div className="cg-top"><b>{m.name}</b> <span className="ui-meta">{m.party} · {seatOf(m)}</span></div>
                {mv.length ? (
                  <ul className="cg-hist">
                    {mv.map((v) => {
                      const link = safeLink(v.link);
                      return (
                        <li key={v.vote_id}>
                          <span className={`cg-pos ${v.position.toLowerCase()}`}>{v.position}</span> <span className="ui-meta">{v.voted_at ?? ""}</span>{" "}
                          {link ? <button type="button" className="ui-link" onClick={() => void openUrl(link)}>{v.question}</button> : v.question}
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="ui-meta">No votes stored yet — Sync to fetch.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
