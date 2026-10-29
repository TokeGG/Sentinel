import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { Chip, EmptyState, ErrorLine, Row, Tile } from "../../ui/kit";
import { QuickAdd } from "../../ui/QuickAdd";
import { Section, Sections } from "../../ui/useCustomize";
import { useModule, type ModuleState } from "../../ui/useModule";
import { rowAge } from "../news/panelLogic";
import { splitFiled } from "./panelLogic";

const TARGETS = ["Work", "Ideas", "Later"];

function NoteTile({ note, busy, run }: { note: Record<string, unknown>; busy: boolean; run: ModuleState["run"] }) {
  const [text, setText] = useState("");
  const file = (to: string) => to.trim() && void run("file_note", { id: note.id, filed_to: to.trim() });
  return (
    <Tile>
      <p className="ui-tile-body">{String(note.body)}</p>
      <div className="ui-tile-foot">
        <span className="ui-meta">{rowAge(note)}</span>
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
    </Tile>
  );
}

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const { unfiled, filed } = splitFiled(rows);
  return (
    <>
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{unfiled.length} unfiled</span>
      </h2>
      <Sections>
        <Section id="capture"><QuickAdd module={module} busy={busy} run={run} /></Section>
        <Section id="inbox">
          {error && <ErrorLine message={error} />}
          {unfiled.length ? (
            <div className="ui-tiles">
              {unfiled.map((n) => <NoteTile key={String(n.id)} note={n} busy={busy} run={run} />)}
            </div>
          ) : (
            <EmptyState title="Inbox is clear" hint="Capture a note above." />
          )}
        </Section>
        <Section id="filed">
          <div className="ui-chips"><Chip on>{filed.length} filed</Chip></div>
          <div className="ui-list">
            {filed.map((n) => (
              <Row key={String(n.id)} end={<span className="ui-src">{String(n.filed_to)}</span>}>
                <span className="ui-link">{String(n.body)}</span>
              </Row>
            ))}
          </div>
        </Section>
      </Sections>
    </>
  );
}
