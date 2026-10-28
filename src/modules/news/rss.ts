// Minimal RSS 2.0 + Atom parser — just enough to pull (guid, title, link,
// published). Regex-based rather than DOMParser so it runs identically in
// the webview and in plain Node tests, with zero dependencies.

export interface FeedItem {
  guid: string;
  title: string;
  link: string;
  publishedAt: string | null;
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  if (!m) return null;
  return m[1]
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function attr(block: string, name: string, attrName: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*\\b${attrName}=["']([^"']*)["']`, "i"));
  return m ? m[1] : null;
}

function blocks(xml: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}[\\s>][\\s\\S]*?<\\/${tagName}>`, "gi");
  return xml.match(re) ?? [];
}

export function parseFeed(xml: string): FeedItem[] {
  const rssItems = blocks(xml, "item");
  if (rssItems.length > 0) {
    return rssItems.map((item) => {
      const link = tag(item, "link") ?? "";
      const guid = tag(item, "guid") || link;
      return {
        guid,
        title: tag(item, "title") || "(untitled)",
        link,
        publishedAt: tag(item, "pubDate"),
      };
    });
  }

  // Atom fallback
  return blocks(xml, "entry").map((entry) => {
    const link = attr(entry, "link", "href") ?? "";
    const guid = tag(entry, "id") || link;
    return {
      guid,
      title: tag(entry, "title") || "(untitled)",
      link,
      publishedAt: tag(entry, "updated"),
    };
  });
}
