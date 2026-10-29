// Add-account form. The password goes straight to the keychain via the add_account skill
// and is cleared from state right after.
import { useState } from "react";
import { OAuthSignIn } from "./OAuthSignIn";
import { PRESETS, draftFromPreset, presetById, validateDraft, type AccountDraft } from "./presets";

export function AccountForm({ busy, onAdd, onCancel }: { busy: boolean; onAdd: (d: AccountDraft) => Promise<void>; onCancel?: () => void }) {
  const [d, setD] = useState<AccountDraft>(() => draftFromPreset("gmail"));
  const [errs, setErrs] = useState<string[]>([]);
  const set = <K extends keyof AccountDraft>(k: K, v: AccountDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const submit = async () => {
    const e = validateDraft(d);
    setErrs(e);
    if (e.length) return;
    await onAdd(d);
    setD((x) => ({ ...x, password: "" }));
  };
  const tls = (k: "imapTls" | "smtpTls") => (
    <select value={d[k]} onChange={(e) => set(k, e.target.value as "ssl" | "starttls")}><option value="ssl">SSL/TLS</option><option value="starttls">STARTTLS</option></select>
  );
  return (
    <form className="mail-form" onSubmit={(e) => { e.preventDefault(); void submit(); }} autoComplete="off">
      <h3>Add account</h3>
      <OAuthSignIn onAdd={onAdd} />
      <p className="mail-note">Or use a password / app password:</p>
      <select value={d.preset} onChange={(e) => setD(draftFromPreset(e.target.value, d.email))}>
        {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <p className="mail-note">{presetById(d.preset).note}</p>
      <input placeholder="Email address" value={d.email} onChange={(e) => setD((x) => ({ ...x, email: e.target.value, username: x.username === x.email ? e.target.value : x.username, label: x.label === x.email ? e.target.value : x.label }))} />
      <input placeholder="Username" value={d.username} onChange={(e) => set("username", e.target.value)} />
      <input type="password" placeholder="Password / app password (saved to the OS keychain)" value={d.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
      <div className="mail-row"><input placeholder="IMAP host" value={d.imapHost} onChange={(e) => set("imapHost", e.target.value)} /><input className="mail-port" type="number" value={d.imapPort} onChange={(e) => set("imapPort", Number(e.target.value))} />{tls("imapTls")}</div>
      <div className="mail-row"><input placeholder="SMTP host" value={d.smtpHost} onChange={(e) => set("smtpHost", e.target.value)} /><input className="mail-port" type="number" value={d.smtpPort} onChange={(e) => set("smtpPort", Number(e.target.value))} />{tls("smtpTls")}</div>
      {errs.map((e) => <div key={e} className="mail-err">{e}</div>)}
      <div className="mail-row"><button type="submit" className="ui-btn primary" disabled={busy}>{busy ? "Adding…" : "Add account"}</button>{onCancel && <button type="button" className="ui-btn" onClick={onCancel}>Cancel</button>}</div>
    </form>
  );
}
