// One generic Connect button for any provider: handles the missing-client-ID step,
// the device-code prompt (user code + link), Mastodon's instance input and errors.
import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ErrorLine } from "../../ui/kit";
import { ClientIdStep } from "./ClientIdStep.tsx";
import { connect, MissingClientId, cancelConnect, listAccounts, type AccountRow, type DevicePrompt } from "./index.ts";
import { getProvider } from "./providers.ts";
import { clientIdFor } from "./clientStore.ts";
import { debugInfo, type ConnectTrace } from "./diagnose.ts";

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
  const [step, setStep] = useState<string | null>(null);
  const [trace, setTrace] = useState<ConnectTrace>({ provider: p.id, flow: p.flow, hasClientId: false, step: null, error: null, at: 0 });
  const [copied, setCopied] = useState(false);
  const note = (s: string) => { setStep(s); setTrace((t) => ({ ...t, step: s, at: Date.now() })); };
  const fail = (m: string) => { setErr(m); setTrace((t) => ({ ...t, error: m, at: Date.now() })); };
  const go = async () => {
    setBusy(true); setErr(null); setNeed(null); note("Starting…");
    const has = p.clientGroup ? await clientIdFor(p.clientGroup).then(Boolean, () => false) : true;
    setTrace((t) => ({ ...t, hasClientId: has, error: null, saved: undefined, ms: undefined }));
    const t0 = Date.now();
    const after = () => listAccounts(providerId).then((r) => setTrace((t) => ({ ...t, saved: r.map((x) => x.account), ms: Date.now() - t0 })), () => {});
    try {
      onConnected?.(await connect(providerId, { instance, onPrompt: setCode, onLink: setLink, onStep: note }));
      note("Connected.");
      void after();
    } catch (e) {
      if (e instanceof MissingClientId) { setNeed(e.group); fail(e.message); }
      else fail(e instanceof Error ? e.message : String(e));
      void after();
    } finally { setBusy(false); setCode(null); setLink(null); }
  };
  const copyDebug = () => {
    setCopied(false);
    navigator.clipboard?.writeText(debugInfo(trace)).then(() => setCopied(true), () => fail("Could not copy; the debug text is shown below."));
  };
  return (
    <div className="st-connect">
      {p.dynamicInstance && <input placeholder="Instance, e.g. mastodon.social" value={instance} onChange={(e) => setInstance(e.target.value)} spellCheck={false} />}
      <button type="button" className={className} disabled={busy} onClick={() => void go()}>{busy ? "Waiting for sign-in…" : label ?? `Connect ${p.label}`}</button>
      {busy && <button type="button" className="ui-btn" onClick={() => cancelConnect(providerId)}>Cancel</button>}
      {step && <span className="ui-meta" role="status">{busy ? step : `Last step: ${step}`}</span>}
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
      {need && <ClientIdStep group={need} wantsSecret={Boolean(p.clientSecret)} onSaved={() => { setNeed(null); void go(); }} onError={(e) => fail(e instanceof Error ? e.message : String(e))} />}
      {err && <ErrorLine message={err} onDismiss={() => setErr(null)} />}
      {trace.at > 0 && <button type="button" className="ui-btn" onClick={copyDebug}>{copied ? "Copied debug info" : "Copy debug info"}</button>}
      {trace.at > 0 && !copied && err && <pre className="ui-meta">{debugInfo(trace)}</pre>}
    </div>
  );
}
