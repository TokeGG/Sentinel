import { useEffect, useRef, useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { EmptyState, ErrorLine } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { Section, Sections, useSections } from "../../ui/useCustomize";
import { useDebounced } from "../../ui/useDebounced";
import { useModule } from "../../ui/useModule";
import "./filesearch.css";
import { DEBOUNCE_MS, SHOW_MAX, extOf, resultsOf, rootsOf, shortPath, shouldSearch, splitMatch } from "./panelLogic";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const ids = useSections();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, DEBOUNCE_MS);
  const searched = useRef("");
  const roots = rootsOf(rows);
  const results = resultsOf(rows);
  const ready = shouldSearch(debounced);

  // One search at a time: the skill keeps its results in a shared list, so a
  // newer query waits for the running one and then fires.
  useEffect(() => {
    const q = debounced.trim();
    if (busy || !shouldSearch(q) || q === searched.current) return;
    searched.current = q;
    void run("search", { query: q });
  }, [debounced, busy, run]);

  const addFolder = (
    <button
      type="button"
      className="fs-chip add"
      disabled={busy}
      onClick={async () => {
        await run("add_root");
        searched.current = ""; // re-run the current query over the new folder
      }}
    >
      + Add folder
    </button>
  );
  const hasSearch = ids.includes("search");
  const rootsHome = ids.includes("roots");
  const searchBox = (
    <div className="fs-bar">
      <span className="fs-glyph" aria-hidden="true">⌕</span>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search filenames (2+ characters)…"
        aria-label="Search filenames"
      />
      {!rootsHome && addFolder}
    </div>
  );
  // If both search and folders are hidden, results hosts the box so the panel is never control-less.
  const boxInResults = !hasSearch && !rootsHome;
  return (
    <div className="fs-root">
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{ready ? results.length : roots.length}</span>
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="search">
          {searchBox}
        </Section>
        <Section id="roots">
          <div className="fs-chips" aria-label="Search folders">
            {roots.map((r) => (
              <span key={r} className="fs-chip" title={r}>
                {shortPath(r, 32)}{" "}
                <ConfirmButton label="×" title="Stop searching this folder (files are untouched)" className="ui-btn ui-sm" disabled={busy} onConfirm={() => { searched.current = ""; void run("remove_root", { path: r }); }} />
              </span>
            ))}
            {addFolder}
          </div>
          <p className="fs-hint">× stops searching a folder; your files are never touched.</p>
        </Section>
        <Section id="results">
          {boxInResults && searchBox}
          {!ready ? (
            hasSearch || boxInResults ? (
              <EmptyState title="Type to search" hint={roots.length === 0 ? "Add a folder to search first." : "Type at least 2 characters."} />
            ) : (
              <EmptyState title="Search is hidden" hint="Show it in Customize (⚙) to search." />
            )
          ) : results.length === 0 ? (
            <EmptyState title={busy ? "Searching…" : "No matches"} hint={roots.length === 0 ? "Add a folder to search first." : undefined} />
          ) : (
            <ul className="fs-results">
              {results.slice(0, SHOW_MAX).map((r) => {
                const [pre, hit, post] = splitMatch(r.name, debounced);
                return (
                  <li key={r.id}>
                    <button type="button" className="fs-row" title={r.path} onClick={() => void run("open_result", { path: r.path })}>
                      <span className="fs-ext">{extOf(r.name) || "·"}</span>
                      <span className="fs-main">
                        <span className="fs-file">{pre}<mark>{hit}</mark>{post}</span>
                        <span className="fs-folder">{shortPath(r.folder, 48)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {results.length > SHOW_MAX && <li className="fs-hint">Showing the first {SHOW_MAX} of {results.length} matches.</li>}
            </ul>
          )}
        </Section>
      </Sections>
    </div>
  );
}
