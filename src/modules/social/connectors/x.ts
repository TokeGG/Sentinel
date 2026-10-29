import type { SocialConnector } from "./types";

// Stubbed on purpose: X's free API tier has no usable read endpoint, and the
// paid tiers need a developer account + billing. Listed so the architecture
// visibly supports it; fill in `fetchFeed` (and `post`) once you have access.
export const x: SocialConnector = {
  id: "x",
  label: "X (Twitter)",
  authType: "manual",
  connectedKey: null,
  credentials: [],
  async fetchFeed() {
    throw new Error("X's free API tier has no usable read endpoint — needs a paid developer account. Not built yet.");
  },
};
