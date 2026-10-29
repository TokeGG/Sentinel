// The "Add a client ID" step: shown when a provider has no client ID yet. The ID is
// public (app_settings); a client secret, where a provider insists on one, goes to the keychain.
import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { DOCS_URL, clientIdPrompt } from "./accountsLogic.ts";
import { setClientId, setClientSecret } from "./clientStore.ts";

export function ClientIdStep({ group, wantsSecret, onSaved, onError }: { group: string; wantsSecret: boolean; onSaved(): void; onError(e: unknown): void }) {
  const [id, setId] = useState("");
  const [secret, setSecret] = useState("");
  const save = async () => {
    try {
      await setClientId(group, id);
      if (wantsSecret && secret) await setClientSecret(group, secret);
      setSecret("");
      onSaved();
    } catch (e) { onError(e); }
  };
  return (
    <div className="st-clientid">
      <span className="ui-meta">Add a client ID. {clientIdPrompt(group, wantsSecret)}.{" "}
        <a href={DOCS_URL} onClick={(e) => { e.preventDefault(); void openUrl(DOCS_URL); }}>How to get one (docs/ACCOUNTS.md)</a></span>
      <input placeholder="Client ID" value={id} onChange={(e) => setId(e.target.value)} autoComplete="off" spellCheck={false} />
      {wantsSecret && <input type="password" placeholder="Client secret (optional if your client has none)" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="new-password" />}
      <button type="button" className="ui-btn" disabled={!id.trim()} onClick={() => void save()}>Save</button>
    </div>
  );
}
