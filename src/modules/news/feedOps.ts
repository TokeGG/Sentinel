// Remove-a-feed / clear-old-items skills shared by News and Deals (same table shape).
import { getDb, logActivity } from "../../core/db";
import type { SkillDef } from "../../core/module";
import { daysArg, numericId } from "../../ui/rowId";

export function feedOps(act: string, sources: "news_sources" | "deal_sources", items: "news_items" | "deal_offers"): SkillDef[] {
  return [
    {
      name: "list_sources",
      run: async () => {
        const d = await getDb();
        return d.select<{ id: number; url: string; label: string | null }[]>(`SELECT id, url, label FROM ${sources} ORDER BY id`);
      },
    },
    {
      name: "remove_source",
      run: async (args) => {
        const id = numericId(args?.id);
        const d = await getDb();
        await d.execute(`DELETE FROM ${items} WHERE source_id = $1`, [id]);
        await d.execute(`DELETE FROM ${sources} WHERE id = $1`, [id]);
        await logActivity(act, "remove_source", `removed feed #${id} and its items`, "ok");
        return { ok: true };
      },
    },
    {
      name: "clear_items",
      run: async (args) => {
        const days = daysArg(args?.days);
        const d = await getDb();
        const r = await d.execute(
          `DELETE FROM ${items} WHERE datetime(COALESCE(published_at, fetched_at)) <= datetime('now', $1)`,
          [`-${days} days`]
        );
        await logActivity(act, "clear_items", days ? `older than ${days} days` : "all items", `${r.rowsAffected} removed`);
        return { ok: true, removed: r.rowsAffected };
      },
    },
  ];
}
