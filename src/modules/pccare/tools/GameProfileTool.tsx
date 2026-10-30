// Per-game profiles: which apps to close when a game runs. Preview the plan, then confirm each close.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ConfirmButton } from "../../../ui/ConfirmButton";
import { getSetting, setSetting } from "../../../ui/appSetting";
import { closePlan, parseProfiles, PROFILES_KEY, runningProfile, splitNames, type GameProfile } from "../gameProfiles";
import type { Proc } from "../alerts";

export function GameProfileTool() {
  const [list, setList] = useState<GameProfile[]>([]);
  const [game, setGame] = useState("");
  const [close, setClose] = useState("");
  const [plan, setPlan] = useState<{ p: GameProfile; procs: Proc[] } | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { getSetting(PROFILES_KEY).then((t) => setList(parseProfiles(t))).catch((e) => setMsg(String(e))); }, []);
  const store = async (next: GameProfile[]) => { await setSetting(PROFILES_KEY, JSON.stringify(next)); setList(parseProfiles(JSON.stringify(next))); };
  const add = () => store([...list.filter((p) => p.game !== game.trim().toLowerCase()), { game, close: splitNames(close), pauseSentinel: true }])
    .then(() => { setGame(""); setClose(""); }).catch((e) => setMsg(String(e)));
  const preview = async (p?: GameProfile) => {
    const procs = await invoke<Proc[]>("list_processes");
    const prof = p ?? runningProfile(list, procs);
    if (!prof) return setMsg("No profiled game is running.");
    setPlan({ p: prof, procs: closePlan(prof, procs) });
  };
  const kill = async (x: Proc) => {
    await invoke("kill_process", { pid: x.pid, name: x.name }).catch((e) => setMsg(String(e)));
    setPlan((cur) => cur && { ...cur, procs: cur.procs.filter((y) => y.pid !== x.pid) });
  };
  return (
    <div className="pc-tool">
      <div className="ui-meta">Nothing closes on its own. Sentinel's own background work already pauses in game mode.</div>
      <div><input className="ui-input" placeholder="game.exe" aria-label="Game exe" value={game} onChange={(e) => setGame(e.target.value)} />
        <input className="ui-input" placeholder="apps to close: chrome.exe, discord.exe" aria-label="Apps to close" value={close} onChange={(e) => setClose(e.target.value)} />
        <button className="ui-btn" disabled={!game.trim()} onClick={() => void add()}>Save profile</button></div>
      {list.map((p) => (
        <div key={p.game}><b>{p.game}</b> <span className="ui-meta">closes {p.close.join(", ") || "nothing"}</span>
          <button className="ui-btn ui-sm" onClick={() => void preview(p).catch((e) => setMsg(String(e)))}>Preview</button>
          <ConfirmButton className="ui-btn ui-sm" label="Remove" onConfirm={() => void store(list.filter((x) => x !== p))} /></div>
      ))}
      <button className="ui-btn" onClick={() => void preview().catch((e) => setMsg(String(e)))}>Check running game</button>
      {plan && (
        <div className="ui-banner">
          <b>{plan.p.game}</b>: {plan.procs.length ? "these are running:" : "nothing to close."}
          {plan.procs.map((x) => <div key={x.pid}>{x.name} ({x.pid}) <ConfirmButton className="ui-btn ui-sm" label="Close" onConfirm={() => void kill(x)} /></div>)}
        </div>
      )}
      {msg && <div className="ui-meta" role="status">{msg}</div>}
    </div>
  );
}
