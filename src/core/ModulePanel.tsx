import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ModuleManifest } from "./module";
import { setCredential } from "./credentials";
import { getScheduleEnabled, setScheduleEnabled } from "./scheduler";

// The generic panel: renders any module whose manifest declares panel:"list"
// or "table" with no module-specific UI code. "chat" and "custom" modules
// (Chat, Pentest Lab) get their own components later — everything else
// should fit here.
export function ModulePanel({ module }: { module: ModuleManifest }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (module.load) setRows(await module.load());
  }

  const [scheduleOn, setScheduleOn] = useState(false);

  useEffect(() => {
    refresh();
    if (module.schedule) {
      getScheduleEnabled(module.id).then(setScheduleOn);
    }
  }, [module.id]);

  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const quickAdd = module.quickAdd;
  const quickAddSkill = quickAdd
    ? module.skills.find((s) => s.name === quickAdd.skill)
    : undefined;

  return (
    <div className="module-panel">
      <h2>{module.name}</h2>
      <p className="module-desc">{module.description}</p>

      {(module.credentialFields ?? []).length > 0 && (
        <div className="module-credentials">
          {module.credentialFields!.map((f) => (
            <div key={f.key} className="credential-row">
              <label>{f.label}</label>
              <input
                type="password"
                value={creds[f.key] ?? ""}
                onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                placeholder="never shown again after saving"
              />
              <button
                type="button"
                onClick={async () => {
                  await setCredential(module.id, f.key, creds[f.key] ?? "");
                  setCreds((c) => ({ ...c, [f.key]: "" }));
                  setSavedKey(f.key);
                  setTimeout(() => setSavedKey(null), 2000);
                }}
              >
                {savedKey === f.key ? "Saved ✓" : "Save"}
              </button>
            </div>
          ))}
          <p className="credential-note">
            Stored in your OS keychain only — never in the database, never
            sent anywhere else.
          </p>
        </div>
      )}

      {(module.actions ?? []).length > 0 && (
        <div className="module-actions">
          {module.actions!.map((a) => {
            const skill = module.skills.find((s) => s.name === a.skill)!;
            return (
              <button
                key={a.skill}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await skill.run();
                  await refresh();
                  setBusy(false);
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      )}

      {module.schedule && (
        <label className="schedule-toggle">
          <input
            type="checkbox"
            checked={scheduleOn}
            onChange={async (e) => {
              const on = e.target.checked;
              setScheduleOn(on);
              await setScheduleEnabled(module, on);
            }}
          />
          Auto-refresh every {module.schedule.intervalMinutes} min (off by default)
        </label>
      )}

      {(module.forms ?? []).map((form) => {
        const skill = module.skills.find((s) => s.name === form.skill)!;
        const values = formValues[form.skill] ?? {};
        return (
          <form
            key={form.skill}
            className="module-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              await skill.run(values);
              setFormValues((v) => ({ ...v, [form.skill]: {} }));
              await refresh();
              setBusy(false);
            }}
          >
            <h4>{form.label}</h4>
            {form.fields.map((f) =>
              f.type === "textarea" ? (
                <textarea
                  key={f.key}
                  placeholder={f.label}
                  value={values[f.key] ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    setFormValues((v) => ({ ...v, [form.skill]: { ...values, [f.key]: e.target.value } }))
                  }
                />
              ) : (
                <input
                  key={f.key}
                  type={f.type ?? "text"}
                  placeholder={f.label}
                  value={values[f.key] ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    setFormValues((v) => ({ ...v, [form.skill]: { ...values, [f.key]: e.target.value } }))
                  }
                />
              )
            )}
            <button type="submit" disabled={busy}>
              {form.label}
            </button>
          </form>
        );
      })}

      {quickAdd && quickAddSkill && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            setBusy(true);
            await quickAddSkill.run({ [quickAdd.argName]: draft });
            setDraft("");
            await refresh();
            setBusy(false);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={quickAdd.placeholder}
            disabled={busy}
          />
          <button type="submit" disabled={busy}>
            Add
          </button>
        </form>
      )}

      <ul className="module-list">
        {rows.map((r) => (
          <li key={String(r.id)}>
            {r.title && typeof r.link === "string" && r.link ? (
              // A real button, not an <a href>: Tauri's opener plugin
              // intercepts anchor clicks app-wide, including bare "#" ones
              // with no real target, and tries to open them externally —
              // calling openUrl explicitly, only when there's a real link,
              // avoids that misfire entirely.
              <button
                type="button"
                className="row-link"
                onClick={() => openUrl(r.link as string)}
              >
                {String(r.title)}
              </button>
            ) : r.title ? (
              <span>{String(r.title)}</span>
            ) : (
              <span>{String(r.body ?? JSON.stringify(r))}</span>
            )}
            {r.label ? <em> — {String(r.label)}</em> : null}
            {r.filed_to ? <em> — filed: {String(r.filed_to)}</em> : null}
            {module.rowAction && (
              <button
                className="row-action"
                disabled={busy}
                onClick={async () => {
                  const ra = module.rowAction!;
                  const skill = module.skills.find((s) => s.name === ra.skill)!;
                  setBusy(true);
                  await skill.run({ [ra.argName]: r[ra.fromField] });
                  await refresh();
                  setBusy(false);
                }}
              >
                {module.rowAction.label}
              </button>
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="empty">Nothing here yet.</li>}
      </ul>
    </div>
  );
}
