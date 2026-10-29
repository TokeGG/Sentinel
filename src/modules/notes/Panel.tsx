import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { Chip, EmptyState, ErrorLine, Row } from "../../ui/kit";
import { QuickAdd } from "../../ui/QuickAdd";
import { Section, Sections } from "../../ui/useCustomize";
import { useModule, type ModuleState } from "../../ui/useModule";
import { rowAge } from "../news/panelLogic";
import { splitFiled } from "./panelLogic";
import "./notes.css";

const TARGETS = ["Work", "Ideas", "Later"];

function NoteTile({ note, busy, run }: { note: Record<string, unknown>; busy: boolean; run: ModuleState["run"] }) {
  const [text, setText] = useState("");
  const file = (to: string) => to.trim() && void run("file_note", { id: note.id, filed_to: to.trim() });
  return (
    <article className="nt-note">
      <p className="nt-body">{String(note.body)}</p>
      <div className="nt-foot">
        <span className="ui-meta">{rowAge(note)}</span>
        <span className="nt-file">File to</span>
        {TARGETS.map((t) => (
          <button key={t} type="button" className="kit-chip" disabled={busy} onClick={() => file(t)}>{t}</button>
        ))}
        <input
          className="ui-file-text"
          value={text}
          placeholder="file to…"
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && file(text)}
        />
      </div>
    </article>
  );
}

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const { unfiled, filed } = splitFiled(rows);
  return (
    <div className="nt">
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="nt-pill">{unfiled.length} unfiled</span>
      </h2>
      <Sections className="nt-grid">
        <Section id="capture"><QuickAdd module={module} busy={busy} run={run} /></Section>
        <Section id="inbox">
          {error && <ErrorLine message={error} />}
          {unfiled.length ? (
            <div className="nt-list">
              {unfiled.map((n) => <NoteTile key={String(n.id)} note={n} busy={busy} run={run} />)}
            </div>
          ) : (
            <EmptyState title="Inbox is clear" hint="Capture a note above." />
          )}
        </Section>
        <Section id="filed">
          <div className="ui-chips"><Chip on>{filed.length} filed</Chip></div>
          <div className="nt-filed">
            {filed.map((n) => (
              <Row key={String(n.id)} end={<span className="nt-tag">{String(n.filed_to)}</span>}>
                <span className="ui-link">{String(n.body)}</span>
              </Row>
            ))}
          </div>
        </Section>
      </Sections>
    </div>
  );
}
