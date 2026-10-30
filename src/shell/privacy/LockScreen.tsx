// Full-window lock overlay in the main window (app lock on start, Settings password).
import { useEffect, useState } from "react";
import { checkPin, finishUnlock, lockState, subscribeLock } from "./lockStore";
import { lockoutSecs } from "./pin";

export function LockScreen() {
  const [st, setSt] = useState(lockState);
  const [pin, setPin] = useState("");
  const [fails, setFails] = useState(0);
  const [until, setUntil] = useState(0);
  const [msg, setMsg] = useState("");
  useEffect(() => subscribeLock(() => setSt(lockState())), []);
  if (!st.locked) return null;
  const submit = async () => {
    if (Date.now() < until) return setMsg(`Wait ${Math.ceil((until - Date.now()) / 1000)} s`);
    const ok = await checkPin(pin).catch(() => false);
    setPin("");
    if (ok) { setFails(0); setMsg(""); finishUnlock(true); return; }
    const f = fails + 1;
    setFails(f);
    setUntil(Date.now() + lockoutSecs(f) * 1000);
    setMsg(lockoutSecs(f) ? `Wrong PIN. Wait ${lockoutSecs(f)} s` : "Wrong PIN");
  };
  return (
    <div className="lock-screen" role="dialog" aria-modal="true" aria-label="Sentinel is locked"
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "grid", placeItems: "center", background: "var(--layer-base, #0b0d12)" }}>
      <form className="ui-banner" onSubmit={(e) => { e.preventDefault(); void submit(); }} style={{ display: "grid", gap: 8, minWidth: 260 }}>
        <strong>Sentinel is locked</strong>
        <span className="ui-meta">{st.reason}</span>
        <input className="ui-input" type="password" inputMode="numeric" autoFocus aria-label="PIN" value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))} />
        <button className="ui-btn primary" type="submit" disabled={pin.length < 4}>Unlock</button>
        {st.reason !== "Sentinel was locked at startup" && (
          <button className="ui-btn" type="button" onClick={() => finishUnlock(false)}>Cancel</button>
        )}
        {msg && <span className="ui-meta" role="status">{msg}</span>}
      </form>
    </div>
  );
}
