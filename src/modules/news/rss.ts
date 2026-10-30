// Minimal RSS 2.0 + Atom parser — just enough to pull (guid, title, link,
// published). Regex-based rather than DOMParser so it runs identically in
// the webview and in plain Node tests, with zero dependencies.

export interface FeedItem {
  guid: string;
  title: string;
  link: string;
  publishedAt: string | null;
  enclosure?: { url: string; type: string } | null; // podcast audio etc.
  summary?: string; // plain text, <= 400 chars
  image?: string | null; // https lead image (media:content/thumbnail, image enclosure, first <img>)
}

export function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  if (!m) return null;
  return m[1]
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function attr(block: string, name: string, attrName: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*\\b${attrName}=["']([^"']*)["']`, "i"));
  return m ? m[1] : null;
}

export function blocks(xml: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}[\\s>][\\s\\S]*?<\\/${tagName}>`, "gi");
  return xml.match(re) ?? [];
}

const plain = (h: string | null): string => (h ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);

function enclosureOf(item: string): { url: string; type: string } | null {
  const url = attr(item, "enclosure", "url");
  return url ? { url, type: attr(item, "enclosure", "type") ?? "" } : null;
}

/** First https image: media:content / media:thumbnail, an image enclosure, or the first <img> in the html. */
export function imageOf(block: string): string | null {
  const raw = block.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const enc = /image\//i.test(attr(block, "enclosure", "type") ?? "") ? attr(block, "enclosure", "url") : null;
  const c = [attr(block, "media:content", "url"), attr(block, "media:thumbnail", "url"), enc, raw.match(/<img[^>]*\bsrc=["']([^"']+)["']/i)?.[1] ?? null];
  return c.find((u): u is string => !!u && /^https:\/\/\S+$/i.test(u)) ?? null;
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
        enclosure: enclosureOf(item),
        summary: plain(tag(item, "description")),
        image: imageOf(item),
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
      summary: plain(tag(entry, "summary") ?? tag(entry, "content")),
      image: imageOf(entry),
    };
  });
}
