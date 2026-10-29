import { openLink as openUrl } from "../../ui/openLink"; // in-app browser or system (links_open_in)
import { ErrorLine } from "../../ui/kit";
import { safeLink } from "../../ui/safeLink";
import { useTask } from "../pccare/useTask";
import type { Ci, InboxItem } from "./devLogic";
import { fetchCi, fetchInbox } from "./ghApi";

const open = (u: string) => { const l = safeLink(u); if (l) void openUrl(l); };

// PR/issue inbox and CI status of your recent repos; both only on button press.
export function InboxSection() {
  const ib = useTask<InboxItem[]>();
  const ci = useTask<Record<string, Ci>>();
  return (
    <div className="gh-dev">
      <div className="ui-actions">
        <button type="button" className="ui-btn primary" disabled={ib.busy} onClick={() => void ib.go(fetchInbox)}>Load inbox</button>
        <button type="button" className="ui-btn" disabled={ci.busy} onClick={() => void ci.go(fetchCi)}>Check CI</button>
      </div>
      {(ib.error || ci.error) && <ErrorLine message={String(ib.error ?? ci.error)} />}
      {ci.data && (
        <div className="ui-chips">
          {Object.entries(ci.data).map(([repo, v]) => <span key={repo} className={`gh-ci ${v}`} title={v}>{repo.split("/")[1]} · {v}</span>)}
        </div>
      )}
      <ul className="gh-inbox">
        {ib.data?.map((i) => (
          <li key={i.id}><b>{i.kind}</b> <button type="button" className="ui-link" onClick={() => open(i.url)}>{i.title}</button> <span className="ui-meta">{i.repo}#{i.number} · {i.updated.slice(0, 10)}</span></li>
        ))}
        {ib.data && !ib.data.length && <li className="ui-meta">Nothing open involves you.</li>}
      </ul>
    </div>
  );
}
