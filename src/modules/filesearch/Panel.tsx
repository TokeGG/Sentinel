import { useEffect, useRef, useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { Chip, EmptyState, ErrorLine, Row } from "../../ui/kit";
import { Section, Sections, useSections } from "../../ui/useCustomize";
import { useDebounced } from "../../ui/useDebounced";
import { useModule } from "../../ui/useModule";
import { DEBOUNCE_MS, SHOW_MAX, resultsOf, rootsOf, shortPath, shouldSearch } from "./panelLogic";

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
      className="ui-btn"
      disabled={busy}
      onClick={async () => {
        await run("add_root");
        searched.current = ""; // re-run the current query over the new folder
      }}
    >
      Add folder
    </button>
  );
  const hasSearch = ids.includes("search");
  const rootsHome = ids.includes("roots");
  const searchBox = (
    <div className="ui-quickadd">
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
    <>
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
          <div className="ui-chips" aria-label="Search folders">
            {roots.map((r) => (
              <Chip key={r}>{shortPath(r, 32)}</Chip>
            ))}
            {addFolder}
          </div>
          <p className="ui-meta">Folders can be added but not removed from this panel.</p>
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
            <div className="ui-list">
              {results.slice(0, SHOW_MAX).map((r) => (
                <Row key={r.id}>
                  <button type="button" className="ui-link" onClick={() => void run("open_result", { path: r.path })}>
                    {r.name}
                  </button>
                  <span className="ui-meta ui-path" title={r.path}>{shortPath(r.folder, 40)}</span>
                </Row>
              ))}
              {results.length > SHOW_MAX && <p className="ui-meta">Showing the first {SHOW_MAX} of {results.length} matches.</p>}
            </div>
          )}
        </Section>
      </Sections>
    </>
  );
}
