import { useEffect, useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { parseOtp, secondsLeft, totp } from "../../core/totp";
import { addCode, labels, removeCode, secretOf } from "../../core/totpStore";

/** 2FA code viewer: secrets in the OS keychain only; codes are computed here and never stored. */
export function TotpTab() {
  const [names, setNames] = useState<string[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [left, setLeft] = useState(30);
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [err, setErr] = useState("");
  const reload = () => labels().then(setNames, (e) => setErr(String(e)));
  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    const tick = async () => {
      const now = Date.now(), out: Record<string, string> = {};
      setLeft(secondsLeft(now));
      for (const n of names) { try { const s = await secretOf(n); out[n] = s ? await totp(s, now) : "missing"; } catch { out[n] = "error"; } }
      setCodes(out);
    };
    void tick();
    const t = setInterval(() => void tick(), 1000);
    return () => clearInterval(t);
  }, [names]);
  const add = async () => {
    setErr("");
    try { const p = parseOtp(secret, label); await addCode(p.label, p.secret); setLabel(""); setSecret(""); await reload(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <div className="nt-totp">
      {err && <div className="ui-error">{err}</div>}
      <p className="ui-meta">Codes refresh in {left} s. Secrets stay in the Windows Credential Manager.</p>
      {names.map((n) => (
        <div key={n} className="nt-code"><span>{n}</span><b className="nt-otp">{codes[n] ?? "…"}</b>
          <button type="button" className="ui-btn ui-sm" onClick={() => void navigator.clipboard?.writeText(codes[n] ?? "")}>Copy</button>
          <ConfirmButton label="Remove" className="ui-btn ui-sm" onConfirm={() => void removeCode(n).then(reload, (e) => setErr(String(e)))} /></div>
      ))}
      <form onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <input placeholder="Name (e.g. GitHub)" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Code name" />
        <input type="password" placeholder="Base32 secret or otpauth:// link" value={secret} onChange={(e) => setSecret(e.target.value)} aria-label="Secret" autoComplete="off" />
        <button className="ui-btn" disabled={!secret.trim()}>Add</button>
      </form>
    </div>
  );
}
