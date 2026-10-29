import type { Connector } from "../types";
import { dgg } from "./dgg";
import { embed } from "./embed";
import { kick } from "./kick";
import { twitch } from "./twitch";
import { youtube } from "./youtube";

// One object per site; adding a site = write one connector, list it here.
// `embed` stays last: it matches any https URL.
export const connectors: Connector[] = [twitch, kick, dgg, youtube, embed];

export const connectorOf = (site: string): Connector => connectors.find((c) => c.id === site) ?? embed;
export { detectRoom } from "./rooms";
