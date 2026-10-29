// Sanitised markdown preview (renderMarkdown escapes all HTML). Wikilinks open a note; links open via safeLink.
import { openUrl } from "@tauri-apps/plugin-opener";
import { safeLink } from "../../ui/safeLink";
import { renderMarkdown } from "./markdown";

export function Preview({ body, onWiki }: { body: string; onWiki(name: string): void }) {
  return (
    <div
      className="nt-preview"
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (!a) return;
        e.preventDefault();
        const w = a.getAttribute("data-note");
        const href = safeLink(a.getAttribute("href"));
        if (w) onWiki(w);
        else if (href) void openUrl(href);
      }}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
    />
  );
}
