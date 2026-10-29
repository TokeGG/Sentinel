// "Cloned repos": list from cloned_projects, quick open, remove-from-list, and
// delete-files behind an explicit preview/confirm step showing the exact path.
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorLine } from "../../ui/kit";
import { deletePreview, projectTypes, shortDate, type ProjectInfo } from "./clonedLogic";
import { deleteCloneFiles, forgetClone, listClones, openClone, projectInfo, type Clone } from "./clones";

export function ClonedSection({ refresh }: { refresh: unknown }) {
  const [items, setItems] = useState<Clone[]>([]);
  const [info, setInfo] = useState<Record<number, ProjectInfo>>({});
  const [confirm, setConfirm] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const list = await listClones();
        if (!live) return;
        setItems(list);
        // Re-check every folder on load: a missing one is marked, not hidden.
        const found = await Promise.all(list.map((c) => projectInfo(c.local_path).catch(() => null)));
        if (!live) return;
        setInfo(Object.fromEntries(list.flatMap((c, i) => (found[i] ? [[c.id, found[i]!]] : []))));
      } catch (e) {
        if (live) setErr(String(e));
      }
    })();
    return () => void (live = false);
  }, [refresh, tick]);

  const act = async (fn: () => Promise<void>) => {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(String(e));
    }
    setConfirm(null);
    reload();
  };

  const head = <h3 className="gh-sub">Cloned<span>{items.length}</span></h3>;
  if (!items.length && !err) return <>{head}<EmptyState title="No cloned repos yet" hint="Clone a repository and it shows up here." /></>;
  return (
    <>
      {head}
      {err && <ErrorLine message={err} />}
      <ul className="gh-clones">
        {items.map((c) => {
          const i = info[c.id];
          const missing = i ? !i.exists : false;
          const types = i && !missing ? projectTypes(i) : [];
          return (
            <li key={c.id} className={`gh-clone${missing ? " missing" : ""}`}>
              <div className="gh-top">
                <span className="gh-mono" aria-hidden="true">▣</span>
                <span className="gh-name" title={c.local_path}>{c.full_name}</span>
                {missing && <span className="gh-chip warn">Folder missing</span>}
                {types.map((t) => <span key={t} className="gh-chip">{t}</span>)}
              </div>
              <p className="gh-path" title={c.local_path}>{c.local_path}</p>
              <p className="gh-desc">Cloned {shortDate(c.cloned_at)} · last opened {shortDate(c.last_opened)}</p>
              {confirm === c.id ? (
                <div className="gh-confirm">
                  <p className="gh-desc">{deletePreview(c.local_path, i)}</p>
                  <div className="gh-acts">
                    <button type="button" className="ui-btn sm danger" onClick={() => void act(() => deleteCloneFiles(c))}>Delete these files</button>
                    <button type="button" className="ui-btn sm" onClick={() => setConfirm(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="gh-acts">
                  <button type="button" className="ui-btn sm" disabled={missing} onClick={() => void act(() => openClone(c, "folder"))}>Open folder</button>
                  <button type="button" className="ui-btn sm" disabled={missing} onClick={() => void act(() => openClone(c, "editor"))}>VS Code</button>
                  <button type="button" className="ui-btn sm" onClick={() => void act(() => forgetClone(c.id))}>Remove from list</button>
                  <button type="button" className="ui-btn sm danger" disabled={missing} onClick={() => setConfirm(c.id)}>Delete files…</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
