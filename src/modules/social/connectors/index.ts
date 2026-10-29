// One file per platform; adding platform #N is "write one connector, list it".
import { bluesky } from "./bluesky";
import { mastodon } from "./mastodon";
import { reddit } from "./reddit";
import { x } from "./x";
import type { SocialConnector } from "./types";

export type { SocialConnector, SocialPost } from "./types";
export const connectors: SocialConnector[] = [bluesky, mastodon, reddit, x];
