import { NAV, type View } from "./viewLogic";

// Left rail (YouTube-style). Collapses to icons when the panel is narrow (CSS container query).
export function Side({ view, counts, onGo }: { view: View; counts: Partial<Record<View, number>>; onGo(v: View): void }) {
  return (
    <nav className="yt-side" aria-label="YouTube">
      {NAV.map((n) => (
        <button key={n.view} type="button" className={`yt-nav${view === n.view ? " on" : ""}`} aria-current={view === n.view ? "page" : undefined} title={n.label} onClick={() => onGo(n.view)}>
          <span className="yt-nav-ico" aria-hidden="true">{n.icon}</span>
          <span className="yt-nav-label">{n.label}</span>
          {counts[n.view] ? <span className="yt-nav-n">{counts[n.view]}</span> : null}
        </button>
      ))}
    </nav>
  );
}
