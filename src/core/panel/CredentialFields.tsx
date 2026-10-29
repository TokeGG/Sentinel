import { useState } from "react";
import type { ModuleManifest } from "../module";
import { setCredential } from "../credentials";

export function CredentialFields({ module, onSaved }: { module: ModuleManifest; onSaved?: () => void }) {
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);
  if ((module.credentialFields ?? []).length === 0) return null;
  return (
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
              onSaved?.();
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
  );
}
