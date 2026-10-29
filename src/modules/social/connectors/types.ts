export interface SocialPost {
  postId: string;
  name: string; // display name
  handle: string;
  avatar: string | null;
  text: string;
  link: string | null;
  postedAt: string | null; // ISO
  media: string[]; // image thumbnail URLs
  likes: number | null;
  reposts: number | null;
  replies: number | null;
}

export interface CredentialSpec {
  key: string;
  label: string;
}

export interface SocialConnector {
  id: string;
  label: string;
  // "oauth": a `connect()` skill does a real sign-in (browser + loopback
  // redirect) — no password ever touches this app. "manual": the platform
  // has no usable public-client OAuth, so a couple of credential fields are
  // the only option.
  authType: "oauth" | "manual";
  credentials: CredentialSpec[]; // manual: entered by hand; oauth: pre-reqs only (e.g. instance URL)
  connect?: () => Promise<void>; // oauth connectors only
  /** The credential key whose presence means "connected". */
  connectedKey: string | null;
  fetchFeed(): Promise<SocialPost[]>;
  /** Present only where the connector can publish; the rest are read-only. */
  post?(text: string): Promise<void>;
}
