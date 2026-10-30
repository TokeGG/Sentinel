// Snippets: reusable text with tags; Copy puts it on the clipboard.
import { useState } from "react";
import { Chip, ErrorLine, Row } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { useStore } from "../../ui/useStore";
import { tagCounts, tagFilter } from "./noteLogic";
import { triggerOf } from "../../shell/extras/textTools";
import { addSnippet, deleteSnippet, listSnippets } from "./storeExtra";

export function SnippetsTab() {
  const s = useStore(listSnippets, []);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [tag, setTag] = useState("");
  const tagsOf = tagCounts(s.data.map((x) => ({ id: x.id, body: "", tags: x.tags, filed_to: null, created_at: "" })));
  return (
    <div className="nt-snips">
      {s.error && <ErrorLine message={s.error} />}
      <form className="ui-controls" onSubmit={(e) => { e.preventDefault(); if (title.trim() && body) void s.act(async () => { await addSnippet(title.trim(), body, tags); setTitle(""); setBody(""); setTags(""); }); }}>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="Tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        <textarea placeholder="Snippet text" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
        <button type="submit" className="ui-btn primary" disabled={s.busy}>Add snippet</button>
      </form>
      <div className="ui-chips">{tagsOf.map(([t]) => <Chip key={t} on={tag === t} onClick={() => setTag(tag === t ? "" : t)}>#{t}</Chip>)}</div>
      {tagFilter(s.data, tag).map((x) => (
        <Row key={x.id} end={<>
          <button type="button" className="ui-btn ui-sm" onClick={() => void navigator.clipboard.writeText(x.body)}>Copy</button>
          <ConfirmButton label="Delete" className="ui-btn ui-sm" onConfirm={() => void s.act(() => deleteSnippet(x.id))} />
        </>}><strong>{x.title}</strong> <code className="ui-meta" title="Type this to expand (Settings > Productivity)">{triggerOf(x.title)}</code> <span className="ui-meta">{x.body.slice(0, 80)}</span></Row>
      ))}
    </div>
  );
}
