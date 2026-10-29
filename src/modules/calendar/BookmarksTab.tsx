// Bookmarks / read-later: save a link, mark read, filter, open via safeLink.
import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import { ErrorLine, Row } from "../../ui/kit";
import { safeLink } from "../../ui/safeLink";
import { useStore } from "../../ui/useStore";
import { filterBookmarks, normalizeUrl, titleFromUrl } from "./bookmarks";
import { addBookmark, deleteBookmark, listBookmarks, setRead } from "./extraStore";

export function BookmarksTab() {
  const s = useStore(listBookmarks, []);
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [q, setQ] = useState("");
  const [unread, setUnread] = useState(true);
  const add = () => void s.act(async () => { const u = normalizeUrl(url); await addBookmark(u, titleFromUrl(u), tags.trim()); setUrl(""); setTags(""); });
  return (
    <div className="cal-form">
      <form className="cal-fields" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input placeholder="https://… save for later" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input placeholder="Tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        <button type="submit" className="ui-btn primary" disabled={s.busy}>Save</button>
      </form>
      <div className="ui-controls">
        <input type="search" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="ui-meta"><input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} /> Unread only</label>
      </div>
      {s.error && <ErrorLine message={s.error} />}
      {filterBookmarks(s.data, { unreadOnly: unread, q }).map((b) => (
        <Row key={b.id} end={<>
          <button type="button" className="ui-btn ui-sm" onClick={() => void s.act(() => setRead(b.id, !b.read))}>{b.read ? "Unread" : "Read"}</button>
          <button type="button" className="ui-btn ui-sm" onClick={() => void s.act(() => deleteBookmark(b.id))}>Remove</button>
        </>}>
          <button type="button" className="ui-link" onClick={() => { const h = safeLink(b.url); if (h) void openUrl(h); }}>{b.title}</button>
          {b.tags && <span className="ui-meta"> {b.tags}</span>}
        </Row>
      ))}
    </div>
  );
}
