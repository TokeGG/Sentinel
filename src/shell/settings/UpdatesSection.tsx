import { useState } from "react";
import { Row } from "../../ui/kit";
import { errorText } from "../../ui/moduleRun";
import { checkForUpdate, installUpdate, type UpdateInfo } from "../updater";
import { Head } from "./Switch";

type State = "idle" | "checking" | "installing";

export function UpdatesSection({ onError }: { onError(e: unknown): void }) {
  const [state, setState] = useState<State>("idle");
  const [found, setFound] = useState<UpdateInfo | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (next: State, fn: () => Promise<void>) => {
    setState(next);
    try { await fn(); } catch (e) { onError(e); setMsg(errorText(e)); } finally { setState("idle"); }
  };
  const onCheck = () => run("checking", async () => {
    const u = await checkForUpdate();
    setFound(u);
    setMsg(u ? null : "You're on the latest version.");
  });
  return (
    <section className="st-section" aria-label="Updates">
      <Head>Updates</Head>
      <Row end={<button type="button" disabled={state !== "idle"} onClick={onCheck}>
        {state === "checking" ? "Checking…" : "Check for updates"}</button>}>
        Checks GitHub releases only when you press this</Row>
      {found && (
        <Row end={<button type="button" disabled={state !== "idle"} onClick={() => run("installing", installUpdate)}>
          {state === "installing" ? "Installing…" : "Install and restart"}</button>}>
          Version {found.version} is available{found.notes && <small className="ui-meta"> {found.notes}</small>}</Row>
      )}
      {msg && <p className="ui-meta">{msg}</p>}
    </section>
  );
}
