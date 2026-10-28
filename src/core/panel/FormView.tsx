import { useState } from "react";
import type { ModuleManifest } from "../module";

// Declared multi-field forms, followed by the single-input quickAdd form.
export function FormView({
  module,
  busy,
  run,
}: {
  module: ModuleManifest;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const quickAdd = module.quickAdd;
  const quickAddSkill = quickAdd
    ? module.skills.find((s) => s.name === quickAdd.skill)
    : undefined;

  return (
    <>
      {(module.forms ?? []).map((form) => {
        const skill = module.skills.find((s) => s.name === form.skill)!;
        const values = formValues[form.skill] ?? {};
        const set = (key: string, value: string) =>
          setFormValues((v) => ({ ...v, [form.skill]: { ...values, [key]: value } }));
        return (
          <form
            key={form.skill}
            className="module-form"
            onSubmit={(e) => {
              e.preventDefault();
              return run(async () => {
                await skill.run(values);
                setFormValues((v) => ({ ...v, [form.skill]: {} }));
              });
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
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : (
                <input
                  key={f.key}
                  type={f.type ?? "text"}
                  placeholder={f.label}
                  value={values[f.key] ?? ""}
                  disabled={busy}
                  onChange={(e) => set(f.key, e.target.value)}
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
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            return run(async () => {
              await quickAddSkill.run({ [quickAdd.argName]: draft });
              setDraft("");
            });
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
    </>
  );
}
