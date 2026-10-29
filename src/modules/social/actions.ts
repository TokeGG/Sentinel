// Thin Tauri-coupled dispatcher for the `post_action` skill: picks the
// connector and calls the matching optional method (absent = unsupported).
import { connectors, type SocialConnector } from "./connectors";
import type { PostMeta } from "./connectors/types";

export type ActionArgs = { platform?: unknown; kind?: unknown; postId?: unknown; meta?: unknown; text?: unknown };

/** Resolves to the meta fields the action changed ({} for a reply). */
export async function runAction(a?: ActionArgs): Promise<PostMeta> {
  const c: SocialConnector | undefined = connectors.find((k) => k.id === a?.platform);
  const kind = String(a?.kind);
  const ref = { postId: String(a?.postId), meta: (a?.meta ?? {}) as PostMeta };
  if (kind === "reply") {
    if (!c?.reply) throw new Error("replies aren't supported here");
    await c.reply(ref, String(a?.text ?? "").trim());
    return {};
  }
  const fn = kind === "like" || kind === "unlike" || kind === "share" || kind === "unshare" ? c?.[kind] : undefined;
  if (!fn) throw new Error(`${kind} isn't supported here`);
  return fn.call(c, ref);
}
