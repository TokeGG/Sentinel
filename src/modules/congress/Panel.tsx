import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { Chip, EmptyState, ErrorLine, Tabs } from "../../ui/kit";
import { TasteBar } from "../../ui/TasteBar";
import { useOption } from "../../ui/useOption";
import { useTasteView } from "../../ui/useTasteView";
import { Section, Sections, useSections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import { BillList } from "./BillList";
import { MyReps } from "./MyReps";
import { MemberList, VoteList } from "./OtherLists";
import "./congress.css";
import { TABS, filterBills, filterMembers, filterVotes, shownTab, splitRows, type Tab } from "./panelLogic";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const ids = useSections();
  const { taste, forYou, setForYou } = useTasteView(module.id, useOption("taste", true));
  const { bills, votes, members } = splitRows(rows);
  const [chosen, setChosen] = useState<Tab>("bills");
  const [q, setQ] = useState("");
  const [followed, setFollowed] = useState(false);
  const [chamber, setChamber] = useState("");
  const [party, setParty] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const tab = shownTab(ids, chosen);
  const updates = bills.filter((b) => b.unseen).length;

  const sync = async () => {
    const out = (await run("sync_congress")) as { bills: number; votes: number; members: number; updated: number; errors: string[] } | undefined;
    if (out) setNote(`Synced ${out.bills} bills, ${out.votes} votes, ${out.members} members${out.errors.length ? ` · ${out.errors.length} part(s) failed: ${out.errors[0]}` : ""}`);
  };
  const syncBtn = (
    <button type="button" className="ui-btn primary" disabled={busy} onClick={() => void sync()}>{busy ? "Syncing…" : "Sync Congress"}</button>
  );
  const none = !rows.length;
  return (
    <div className="cg-root">
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{bills.length} bills</span>
        {updates > 0 && <span className="cg-new">{updates} updated</span>}
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="sync">
          <div className="ui-controls">
            {syncBtn}
            <ScheduleToggle module={module} />
            {!none && <ConfirmButton label="Clear synced data" disabled={busy} title="Deletes the cached bills, votes and members; follows are kept" onConfirm={() => void run("clear_cache")} />}
            {updates > 0 && <button type="button" className="ui-btn" disabled={busy} onClick={() => void run("mark_seen")}>Mark all seen</button>}
          </div>
          {note && <p className="ui-meta" role="status">{note}</p>}
          <p className="ui-meta">Data from GovTrack.us (public API, no key). Only fetched when you sync.</p>
        </Section>
        <Section id="search">
          <div className="cg-filters">
            <input className="ui-file-text" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bills, votes, members…" aria-label="Search" />
            <TasteBar taste={taste} name="Congress" forYou={forYou} onForYou={setForYou} />
            <Chip on={followed} onClick={() => setFollowed(!followed)}>Followed</Chip>
            {tab === "votes" && ["house", "senate"].map((c) => <Chip key={c} on={chamber === c} onClick={() => setChamber(chamber === c ? "" : c)}>{c}</Chip>)}
            {tab === "members" && ["D", "R", "I"].map((p) => <Chip key={p} on={party === p} onClick={() => setParty(party === p ? "" : p)}>{p}</Chip>)}
          </div>
        </Section>
        {TABS.filter((t) => ids.includes(t.id)).length > 1 && <Tabs tabs={TABS.filter((t) => ids.includes(t.id))} active={tab ?? "bills"} onChange={(id) => setChosen(id as Tab)} />}
        {tab === "bills" && (
          <Section id="bills">
            {none ? <EmptyState title="Nothing synced yet" hint={ids.includes("sync") ? "Press Sync Congress." : "Re-enable “Sync & auto-refresh” in Customize to sync."} /> : (
              <BillList bills={filterBills(bills, q, followed)} busy={busy} run={run} taste={taste} forYou={forYou} />
            )}
          </Section>
        )}
        {tab === "votes" && (
          <Section id="votes">
            {none ? <EmptyState title="Nothing synced yet" /> : <VoteList votes={filterVotes(votes, q, chamber)} />}
          </Section>
        )}
        {tab === "members" && (
          <Section id="members">
            {none ? <EmptyState title="Nothing synced yet" /> : <MemberList members={filterMembers(members, q, followed, party)} busy={busy} run={run} taste={taste} forYou={forYou} />}
          </Section>
        )}
        {tab === "mine" && (
          <Section id="mine">
            <MyReps members={members} busy={busy} run={run} />
          </Section>
        )}
      </Sections>
    </div>
  );
}
