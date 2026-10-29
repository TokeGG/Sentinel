// All built-in data sources. Off by default: a source is queried only when the user enabled it
// (Settings > Data sources) or pressed its Test button.
import type { Category } from "../categories.ts";
import type { DataSource } from "./types.ts";
import { LAB_SOURCES } from "./lab.ts";
import { FINANCE_SOURCES } from "./finance.ts";
import { DEALS_SOURCES } from "./deals.ts";
import { MEDIA_SOURCES } from "./media.ts";
import { NEWS_SOURCES } from "./news.ts";
import { MISC_SOURCES } from "./misc.ts";

export const DATA_SOURCES: DataSource[] = [...NEWS_SOURCES, ...DEALS_SOURCES, ...FINANCE_SOURCES, ...MEDIA_SOURCES, ...MISC_SOURCES, ...LAB_SOURCES];
export const sourcesFor = (c: Category): DataSource[] => DATA_SOURCES.filter((s) => s.category === c);
export const sourceById = (id: string): DataSource | undefined => DATA_SOURCES.find((s) => s.id === id);
export const enabledKey = (id: string) => `ds_on:${id}`;
