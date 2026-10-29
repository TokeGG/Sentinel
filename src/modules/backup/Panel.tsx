import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { EmptyState, ErrorLine, Row, Tile } from "../../ui/kit";
import { Section, Sections, useSections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import { snapshotsOf, whenText } from "./panelLogic";

// Where the user is asked to confirm a restore. dir === null means "pick a
// folder in the dialog" (exactly what the generic action did); a string is a
// snapshot row, restored with that same dir once confirmed.
type Pending = { dir: string | null; from: "restore" | "snapshots" | "notice" };

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const ids = useSections();
  const [pending, setPending] = useState<Pending | null>(null);
  const [restored, setRestored] = useState(false);
  const snaps = snapshotsOf(rows);
  const lastSnap = snaps[0];
  // Each control has one home; if its section is hidden it moves to the next visible one.
  const backupHome = ["last", "restore", "snapshots", "notice"].find((id) => ids.includes(id));
  const restoreHome = ["restore", "snapshots", "notice"].find((id) => ids.includes(id));
  const backupAndRestore = (home: string) => (
    <div className="ui-actions">
      {backupHome === home && backupBtn}
      {restoreHome === home && (
        <button type="button" className="ui-btn" disabled={busy} onClick={() => setPending({ dir: null, from: home as Pending["from"] })}>
          Restore from a folder…
        </button>
      )}
    </div>
  );

  const backupBtn = (
    <button type="button" className="ui-btn primary" disabled={busy} onClick={() => void run("backup_now")}>
      {busy ? "Working…" : "Back up now"}
    </button>
  );
  const confirmBar = (from: Pending["from"]) =>
    pending?.from === from && (
      <div className="ui-banner" role="alertdialog" aria-label="Confirm restore">
        <strong>Restore {pending.dir ? <code>{pending.dir}</code> : "from a folder you pick next"}?</strong>
        <div className="ui-meta">
          {pending.dir
            ? "This overwrites Sentinel's current data. Restart the app afterwards."
            : "The folder you choose next will be restored immediately and replaces Sentinel's current data. This cannot be undone."}
        </div>
        <div className="ui-actions">
          <button
            type="button"
            className="ui-btn primary"
            disabled={busy}
            onClick={async () => {
              const p = pending;
              setPending(null);
              const out = (await run("restore_from", p.dir ? { dir: p.dir } : undefined)) as { ok?: boolean } | undefined;
              if (out?.ok) setRestored(true);
            }}
          >
            {pending.dir ? "Restore this snapshot" : "Choose folder and restore"}
          </button>
          <button type="button" className="ui-btn" onClick={() => setPending(null)}>Cancel</button>
        </div>
      </div>
    );

  return (
    <>
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="last">
          <Tile title="Last backup">
            {lastSnap ? (
              <p className="ui-big">
                {whenText(lastSnap.when)} <span className="ui-meta">· size not recorded</span>
              </p>
            ) : (
              <EmptyState title="No backup made in this session" hint="Backup history is kept only until the app closes." />
            )}
            {lastSnap && <div className="ui-meta ui-path">{lastSnap.path}</div>}
            {backupHome === "last" && <div className="ui-actions">{backupBtn}</div>}
          </Tile>
        </Section>
        <Section id="snapshots">
          <Tile title="Snapshots this session">
            {backupAndRestore("snapshots")}
            {snaps.length === 0 ? (
              <EmptyState title="No snapshots yet" />
            ) : (
              <div className="ui-list">
                {snaps.map((s) => (
                  <Row
                    key={s.path}
                    end={
                      <button type="button" className="ui-btn" disabled={busy} onClick={() => setPending({ dir: s.path, from: "snapshots" })}>
                        Restore…
                      </button>
                    }
                  >
                    <span className="ui-link" title={s.path}>{s.name}</span>
                    <span className="ui-meta"> {whenText(s.when)}</span>
                  </Row>
                ))}
              </div>
            )}
            {confirmBar("snapshots")}
          </Tile>
        </Section>
        <Section id="restore">
          <Tile title="Restore">
            {backupAndRestore("restore")}
            {confirmBar("restore")}
          </Tile>
        </Section>
        <Section id="notice">
          {restored ? (
            <div className="ui-banner" role="status">
              <strong>Restored.</strong> Restart Sentinel to see the restored data take effect.
            </div>
          ) : (
            <p className="ui-meta">After a restore, a restart reminder appears here.</p>
          )}
          {backupAndRestore("notice")}
          {confirmBar("notice")}
        </Section>
      </Sections>
    </>
  );
}
