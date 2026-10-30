// Settings > App lock: PIN (PBKDF2 hash in the OS keychain), lock on start, PIN before Settings, breach check.
import { useEffect, useState } from "react";
import { Row } from "../../ui/kit";
import { Head, Switch } from "./Switch";
import { useSys } from "../privacy/fields";
import { checkPin, hasPin, removePin, setPin } from "../privacy/lockStore";
import { validPin } from "../privacy/pin";
import { checkPwned } from "../../modules/pccare/pwned";

export function LockSection({ onError }: { onError(e: unknown): void }) {
  const [p, set] = useSys(onError);
  const [has, setHas] = useState<boolean | null>(null);
  const [pin, setPinText] = useState("");
  const [cur, setCur] = useState("");
  const [msg, setMsg] = useState("");
  const [pw, setPw] = useState("");
  const [breach, setBreach] = useState("");
  useEffect(() => { hasPin().then(setHas).catch(onError); }, []);
  const save = async () => {
    if (has && !(await checkPin(cur).catch(() => false))) { setCur(""); return setMsg("Wrong current PIN"); }
    try { await setPin(pin); setCur(""); setPinText(""); setHas(true); setMsg("PIN saved in the Windows Credential Manager (hash only)."); } catch (e) { onError(e); }
  };
  const remove = async () => {
    const ok = await removePin(cur).catch(() => false);
    setCur("");
    if (!ok) return setMsg("Wrong PIN");
    setHas(false); setMsg("PIN removed");
    await set({ lockOnStart: false, lockSettings: false });
  };
  const check = async () => {
    try { const n = await checkPwned(pw); setPw(""); setBreach(n ? `Found in ${n.toLocaleString()} breaches: do not use it.` : "Not found in known breaches."); }
    catch (e) { setBreach(String(e)); }
  };
  const digits = (s: string) => s.replace(/\D/g, "").slice(0, 12);
  return (
    <section className="st-section" aria-label="App lock">
      <Head>App lock</Head>
      <Row><input className="ui-input" type="password" inputMode="numeric" placeholder={has ? "New PIN" : "Choose a PIN (4-12 digits)"}
        aria-label="New PIN" value={pin} onChange={(e) => setPinText(digits(e.target.value))} />
        <button className="ui-btn" disabled={!validPin(pin) || (has === true && !cur)} onClick={() => void save()}>{has ? "Change PIN" : "Set PIN"}</button></Row>
      {has && <Row><input className="ui-input" type="password" inputMode="numeric" placeholder="Current PIN" aria-label="Current PIN"
        value={cur} onChange={(e) => setCur(digits(e.target.value))} />
        <button className="ui-btn" disabled={!cur} onClick={() => void remove()}>Remove PIN</button></Row>}
      {msg && <Row><span className="ui-meta" role="status">{msg}</span></Row>}
      {p && <>
        <Row><Switch checked={p.lockOnStart} disabled={!has} onChange={(v) => set({ lockOnStart: v })}>Lock when Sentinel starts</Switch></Row>
        <Row><Switch checked={p.lockSettings} disabled={!has} onChange={(v) => set({ lockSettings: v })}>Ask for the PIN before opening Settings</Switch></Row>
      </>}
      <Row><small className="ui-meta">Windows Hello is not available: Sentinel ships no biometric plugin, so the lock uses the PIN only.</small></Row>
      <Head>Breach check</Head>
      <Row><input className="ui-input" type="password" placeholder="Password to check" aria-label="Password to check" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="ui-btn" disabled={!pw} onClick={() => void check()}>Check</button></Row>
      <Row><small className="ui-meta">{breach || "Only the first 5 characters of its SHA-1 hash go to api.pwnedpasswords.com; nothing is stored."}</small></Row>
    </section>
  );
}
