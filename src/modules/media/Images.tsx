import { useEffect, useState } from "react";
import { EmptyState, ErrorLine } from "../../ui/kit";
import { imagePage } from "./panelLogic";
import { useOnDemand } from "./Widgets";

type Run = (skill: string, args?: Record<string, unknown>) => Promise<unknown>;
interface Listing { folder: string | null; files: { name: string; modified: number }[] }

function Thumb({ run, name }: { run: Run; name: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { let live = true; void run("image_data", { name }).then((s) => live && setSrc(String(s)), () => {}); return () => void (live = false); }, [run, name]);
  return <figure className="md-thumb">{src ? <img src={src} alt={name} loading="lazy" /> : <span className="md-dim">…</span>}<figcaption>{name}</figcaption></figure>;
}

export function Images({ run }: { run: Run }) {
  const ls = useOnDemand<Listing>(run, "list_images");
  const [page, setPage] = useState(0);
  const pg = imagePage(ls.data?.files ?? [], page);
  return (
    <div className="md-card">
      <div className="ui-controls">
        <button type="button" className="ui-btn ui-sm" onClick={() => void run("pick_folder").then(() => ls.load())}>Pick folder…</button>
        <button type="button" className="ui-btn ui-sm" onClick={() => void ls.load()}>Show images</button>
        {pg.pages > 1 && <>
          <button type="button" className="ui-btn ui-sm" disabled={page <= 0} onClick={() => setPage(page - 1)}>‹</button>
          <span className="md-dim">{page + 1}/{pg.pages}</span>
          <button type="button" className="ui-btn ui-sm" disabled={page >= pg.pages - 1} onClick={() => setPage(page + 1)}>›</button>
        </>}
      </div>
      {ls.err && <ErrorLine message={ls.err} />}
      {ls.data && !pg.names.length && <EmptyState title="No images" hint={ls.data.folder ?? "Pick a folder first."} />}
      <div className="md-grid">{pg.names.map((n) => <Thumb key={n} run={run} name={n} />)}</div>
    </div>
  );
}
