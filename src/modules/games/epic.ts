// Pure: Epic launcher .item manifests and launch URIs for both stores.
export interface EpicApp { appName: string; name: string; ns: string; itemId: string; installLocation: string }

/** One .item JSON text -> app, or null (bad JSON, missing ids, or DLC/incomplete installs). */
export function parseEpicItem(text: string): EpicApp | null {
  let j: Record<string, unknown>;
  try { j = JSON.parse(text) as Record<string, unknown>; } catch { return null; }
  const s = (k: string) => (typeof j?.[k] === "string" ? (j[k] as string) : "");
  const appName = s("AppName");
  if (!appName || !s("CatalogNamespace") || !s("CatalogItemId")) return null;
  if (j.bIsIncompleteInstall === true) return null;
  if (s("MainGameAppName") && s("MainGameAppName") !== appName) return null; // DLC
  return { appName, name: s("DisplayName") || appName, ns: s("CatalogNamespace"), itemId: s("CatalogItemId"), installLocation: s("InstallLocation") };
}

export const steamLaunchUri = (appid: string): string | null => (/^\d+$/.test(appid) ? `steam://rungameid/${appid}` : null);

export const epicLaunchUri = (a: Pick<EpicApp, "ns" | "itemId" | "appName">): string =>
  `com.epicgames.launcher://apps/${encodeURIComponent(a.ns)}%3A${encodeURIComponent(a.itemId)}%3A${encodeURIComponent(a.appName)}?action=launch&silent=true`;

export const steamNewsUrl = (appid: string): string => `https://store.steampowered.com/feeds/news/app/${appid}/`;
