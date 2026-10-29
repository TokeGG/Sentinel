// Pure parser for Chromium/Opera "Bookmarks" JSON (roots.bookmark_bar / other / synced / custom_root...).
export type ImportedBookmark = { title: string; url: string; folder: string; bar: boolean };
type Node = { type?: string; name?: string; url?: string; children?: Node[] };

/** Flatten every http(s) url node; folder = "/"-joined path under its root; bar = under bookmark_bar. Capped. */
export function parseOperaBookmarks(json: string, max = 5000): ImportedBookmark[] {
  let root: { roots?: Record<string, Node> };
  try { root = JSON.parse(json); } catch { return []; }
  const out: ImportedBookmark[] = [];
  const walk = (n: Node, path: string[], bar: boolean) => {
    if (out.length >= max || !n || typeof n !== "object") return;
    if (n.type === "url" && typeof n.url === "string" && /^https?:\/\//i.test(n.url)) {
      out.push({ title: String(n.name ?? "").slice(0, 300) || n.url, url: n.url, folder: path.join("/"), bar });
      return;
    }
    if (Array.isArray(n.children)) {
      const next = n.type === "folder" && n.name ? [...path, String(n.name).slice(0, 80)] : path;
      for (const c of n.children) walk(c, next, bar);
    }
  };
  for (const [key, node] of Object.entries(root?.roots ?? {})) {
    if (!node || typeof node !== "object" || key === "sync_transaction_version") continue;
    const label = key === "bookmark_bar" ? "" : key === "other" ? "Other" : key === "synced" ? "Mobile" : String(node.name ?? key);
    walk({ ...node, type: "root" }, label ? [label] : [], key === "bookmark_bar");
  }
  return out;
}
