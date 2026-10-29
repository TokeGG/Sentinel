// One repo card: owner/name, stars, description, language + cloned chips, clone button.
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Ranked } from "../../core/taste/model";
import type { Taste } from "../../core/taste/useTaste";
import { TasteButtons } from "../../ui/TasteButtons";
import { WhyBadge } from "../../ui/WhyBadge";
import { repoView } from "./panelLogic";
import { repoTaste } from "./taste";

type Row = Record<string, unknown>;

export function RepoCard({ r, label, busy, onClone, onDismiss, taste, ranked }: { r: Row; label: string; busy: boolean; onClone(): void; onDismiss(): void; taste: Taste; ranked?: Pick<Ranked<unknown>, "why" | "explored"> }) {
  const v = repoView(r);
  const [owner, repo] = v.name.includes("/") ? v.name.split("/", 2) : ["", v.name];
  const name = (
    <>
      {owner && <span className="gh-owner">{owner}/</span>}
      {repo}
    </>
  );
  return (
    <li className="gh-card">
      <div className="gh-top">
        <span className="gh-mono" aria-hidden="true">{(owner || repo).slice(0, 1).toUpperCase()}</span>
        {v.link ? (
          <button type="button" className="ui-link gh-name" title={v.name} onClick={() => { void taste.record(repoTaste(r), "open"); void openUrl(v.link!); }}>{name}</button>
        ) : (
          <span className="gh-name" title={v.name}>{name}</span>
        )}
        <span className="gh-stars">★ {v.stars}</span>
      </div>
      {v.description && <p className="gh-desc">{v.description}</p>}
      <div className="gh-foot">
        {v.language && (
          <span className="gh-chip">
            <i style={{ background: v.color ?? undefined }} />
            {v.language}
          </span>
        )}
        {ranked && <WhyBadge ranked={ranked} />}
        <TasteButtons taste={taste} item={repoTaste(r)} />
        {v.cloned && <span className="gh-chip ok">Cloned ✓</span>}
        <button type="button" className="ui-btn sm" disabled={busy} onClick={onClone}>
          {v.cloned ? "Clone again…" : label}
        </button>
        <button type="button" className="ui-btn sm" disabled={busy} title="Hide from this list (nothing is deleted)" onClick={onDismiss}>Dismiss</button>
      </div>
    </li>
  );
}
