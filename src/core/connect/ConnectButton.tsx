// One generic Connect button for any provider: handles the missing-client-ID step,
// the device-code prompt (user code + link), Mastodon's instance input and errors.
import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ErrorLine } from "../../ui/kit";
import { ClientIdStep } from "./ClientIdStep.tsx";
import { connect, MissingClientId, cancelConnect, type AccountRow, type DevicePrompt } from "./index.ts";
import { getProvider } from "./providers.ts";

export function ConnectButton({ providerId, label, onConnected, className = "ui-btn primary" }: {
  providerId: string; label?: string; onConnected?(row: AccountRow): void; className?: string;
}) {
  const p = getProvider(providerId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [need, setNeed] = useState<string | null>(null);
  const [code, setCode] = useState<DevicePrompt | null>(null);
  const [instance, setInstance] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null); setNeed(null);
    try {
      onConnected?.(await connect(providerId, { instance, onPrompt: setCode, onLink: setLink }));
    } catch (e) {
      if (e instanceof MissingClientId) setNeed(e.group);
      else setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); setCode(null); setLink(null); }
  };
  return (
    <div className="st-connect">
      {p.dynamicInstance && <input placeholder="Instance, e.g. mastodon.social" value={instance} onChange={(e) => setInstance(e.target.value)} spellCheck={false} />}
      <button type="button" className={className} disabled={busy} onClick={() => void go()}>{busy ? "Waiting for sign-in…" : label ?? `Connect ${p.label}`}</button>
      {busy && <button type="button" className="ui-btn" onClick={() => cancelConnect(providerId)}>Cancel</button>}
      {code && (
        <div className="st-code">
          Enter <strong>{code.userCode}</strong> at{" "}
          <a href={code.verificationUri} onClick={(e) => { e.preventDefault(); openUrl(code.verificationUri).catch((x) => setErr(`Could not open the browser (${String(x)}). Copy the link instead.`)); }}>{code.verificationUri}</a>
        </div>
      )}
      {link && (
        <div className="st-code ui-meta">
          No browser tab? Copy this link into your browser:{" "}
          <button type="button" className="ui-btn" onClick={() => void navigator.clipboard?.writeText(link).catch(() => {})}>Copy sign-in link</button>
        </div>
      )}
      {need && (
        <div className="ui-meta st-acct-err">{p.label} needs a client ID before it can sign in (free app registration, about 5 minutes). Paste it below; steps are in docs/ACCOUNTS.md.</div>
      )}
      {need && <ClientIdStep group={need} wantsSecret={Boolean(p.clientSecret)} onSaved={() => { setNeed(null); void go(); }} onError={(e) => setErr(String(e))} />}
      {err && <ErrorLine message={err} onDismiss={() => setErr(null)} />}
    </div>
  );
}
