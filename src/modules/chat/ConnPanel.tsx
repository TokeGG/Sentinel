import type { ConnLog } from "./connLog";
import type { Status } from "./types";

type Props = {
  status: Status;
  detail?: string;
  log: ConnLog;
  canEmbed: boolean;
  onRetry(): void;
  onEmbed(): void;
};

// Status line (with Retry / "Use embed instead") and the collapsible, copyable Connection log.
export function ConnPanel({ status, detail, log, canEmbed, onRetry, onEmbed }: Props) {
  const bad = status === "error" || status === "closed";
  return (
    <>
      {status !== "open" && (
        <div className={`chat-note${status === "error" ? " chat-err" : ""}`}>
          {status === "connecting" ? "Connecting…" : (detail ?? (status === "closed" ? "Disconnected" : "Error"))}{" "}
          {bad && <button type="button" className="ui-btn" onClick={onRetry}>Retry</button>}{" "}
          {bad && canEmbed && <button type="button" className="ui-btn" onClick={onEmbed}>Use embed instead</button>}
        </div>
      )}
      <details className="chat-conn">
        <summary>Connection</summary>
        <pre className="chat-log">{log.text() || "(nothing yet)"}</pre>
        <button type="button" className="ui-btn" onClick={() => void navigator.clipboard?.writeText(log.text()).catch(() => {})}>Copy log</button>
      </details>
    </>
  );
}
