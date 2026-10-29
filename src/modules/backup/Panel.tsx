import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { EmptyState, ErrorLine, Tile } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { Section, Sections, useSections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import "./backup.css";
import { snapshotsOf, whenText } from "./panelLogic";
import { HealthCard } from "./HealthCard";

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
    <div className="bk-acts">
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
        <div className="bk-acts">
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
    <div className="bk-root">
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="health"><HealthCard snaps={snaps} /></Section>
        <Section id="last">
          <div className="bk-hero">
            <div className="bk-hero-main">
              <span className="bk-label">Last backup</span>
              {lastSnap ? (
                <>
                  <p className="bk-big">{whenText(lastSnap.when)}</p>
                  <div className="bk-path" title={lastSnap.path}>{lastSnap.path}</div>
                </>
              ) : (
                <EmptyState title="No backup made in this session" hint="Backup history is kept only until the app closes." />
              )}
            </div>
            {backupHome === "last" && <div className="bk-acts">{backupBtn}</div>}
          </div>
        </Section>
        <Section id="snapshots">
          <Tile title="Snapshots this session">
            {backupAndRestore("snapshots")}
            {snaps.length === 0 ? (
              <EmptyState title="No snapshots yet" />
            ) : (
              <ol className="bk-line">
                {snaps.map((s, i) => (
                  <li key={s.path} className={`bk-snap${i === 0 ? " latest" : ""}`}>
                    <div className="bk-snap-main">
                      <span className="bk-when">{whenText(s.when)}</span>
                      <span className="bk-name" title={s.path}>{s.name}</span>
                    </div>
                    <button type="button" className="ui-btn sm" disabled={busy} onClick={() => setPending({ dir: s.path, from: "snapshots" })}>
                      Restore…
                    </button>
                    <ConfirmButton label="Delete" className="ui-btn sm" disabled={busy} title="Deletes this snapshot's files" onConfirm={() => void run("delete_backup", { dir: s.path })} />
                  </li>
                ))}
              </ol>
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
            <p className="ui-meta bk-note">After a restore, a restart reminder appears here.</p>
          )}
          {backupAndRestore("notice")}
          {confirmBar("notice")}
        </Section>
      </Sections>
    </div>
  );
}
