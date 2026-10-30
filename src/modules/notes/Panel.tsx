import { useEffect, useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { Chip, EmptyState, ErrorLine, Row } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { QuickAdd } from "../../ui/QuickAdd";
import { useSectionTabs } from "../../ui/SectionTabs";
import { Section, Sections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import { CardsTab } from "./CardsTab";
import { ClipTab } from "./ClipTab";
import { GraphTab } from "./GraphTab";
import { JournalTab, useDailyNote } from "./JournalTab";
import { NotebookTab } from "./NotebookTab";
import { NoteTile } from "./NoteTile";
import { SnippetsTab } from "./SnippetsTab";
import { VaultTab } from "./VaultTab";
import { BoardTab } from "./BoardTab";
import { GoalsTab } from "./GoalsTab";
import { MeetingTab } from "./MeetingTab";
import { TotpTab } from "./TotpTab";
import { NOTES_TABS, splitFiled } from "./panelLogic";
import { useNotes } from "./useNotes";
import "./notes.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run, refresh } = useModule(module);
  const { unfiled, filed } = splitFiled(rows);
  const store = useNotes();
  const [tab, bar, setTab] = useSectionTabs(NOTES_TABS);
  const [openId, setOpenId] = useState<number | null>(null);
  useDailyNote(store);
  useEffect(() => { void store.reload(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (id: number) => { void store.reload(); void refresh(); setOpenId(id); setTab("notebook"); };
  return (
    <div className="nt">
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="nt-pill">{unfiled.length} unfiled</span>
      </h2>
      {bar}
      <Sections className={tab === "inbox" ? "nt-grid" : "nt-tab"}>
        {tab === "inbox" && <Section id="capture"><QuickAdd module={module} busy={busy} run={run} /></Section>}
        {tab === "inbox" && <Section id="inbox">
          {error && <ErrorLine message={error} />}
          {unfiled.length ? (
            <div className="nt-list">
              {unfiled.map((n) => <NoteTile key={String(n.id)} note={n} busy={busy} run={run} />)}
            </div>
          ) : (
            <EmptyState title="Inbox is clear" hint="Capture a note above." />
          )}
        </Section>}
        {tab === "inbox" && <Section id="filed">
          <div className="ui-chips"><Chip on>{filed.length} filed</Chip></div>
          <div className="nt-filed">
            {filed.map((n) => (
              <Row key={String(n.id)} end={<><span className="nt-tag">{String(n.filed_to)}</span><ConfirmButton label="Delete" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void run("delete_note", { id: n.id })} /></>}>
                <button type="button" className="ui-link" onClick={() => open(Number(n.id))}>{String(n.body)}</button>
              </Row>
            ))}
          </div>
        </Section>}
        {tab === "notebook" && <Section id="editor"><NotebookTab store={store} openId={openId} setOpenId={setOpenId} /></Section>}
        {tab === "journal" && <Section id="journal"><JournalTab store={store} open={open} /></Section>}
        {tab === "graph" && <Section id="graph"><GraphTab notes={store.data} open={open} /></Section>}
        {tab === "cards" && <Section id="cards"><CardsTab /></Section>}
        {tab === "snippets" && <Section id="snippets"><SnippetsTab /></Section>}
        {tab === "vault" && <Section id="vault"><VaultTab /></Section>}
        {tab === "board" && <Section id="board"><BoardTab /></Section>}
        {tab === "goals" && <Section id="goals"><GoalsTab /></Section>}
        {tab === "meeting" && <Section id="meeting"><MeetingTab onSaved={open} /></Section>}
        {tab === "totp" && <Section id="totp"><TotpTab /></Section>}
        {tab === "clip" && <Section id="clipper"><ClipTab onSaved={open} /></Section>}
      </Sections>
    </div>
  );
}
