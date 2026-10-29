// Starter list of suggested channels: @handles only (no guessed UC ids); each is resolved to its channel id
// by add_channel when you press Add. Unverified: a renamed handle just fails to add with a clear error.
export const SUGGESTED: { handle: string; topic: string }[] = [
  { handle: "@mkbhd", topic: "Tech" }, { handle: "@LinusTechTips", topic: "Tech" }, { handle: "@GamersNexus", topic: "PC hardware" },
  { handle: "@HardwareUnboxed", topic: "PC hardware" }, { handle: "@JayzTwoCents", topic: "PC hardware" }, { handle: "@DigitalFoundry", topic: "Games" },
  { handle: "@Fireship", topic: "Programming" }, { handle: "@Computerphile", topic: "Computing" }, { handle: "@TwoMinutePapers", topic: "AI research" },
  { handle: "@veritasium", topic: "Science" }, { handle: "@kurzgesagt", topic: "Science" }, { handle: "@3blue1brown", topic: "Math" },
  { handle: "@numberphile", topic: "Math" }, { handle: "@minutephysics", topic: "Physics" }, { handle: "@Vsauce", topic: "Science" },
  { handle: "@smartereveryday", topic: "Science" }, { handle: "@NileRed", topic: "Chemistry" }, { handle: "@markrober", topic: "Engineering" },
  { handle: "@StuffMadeHere", topic: "Engineering" }, { handle: "@PracticalEngineeringChannel", topic: "Engineering" }, { handle: "@RealEngineering", topic: "Engineering" },
  { handle: "@TomScottGo", topic: "Explainers" }, { handle: "@CGPGrey", topic: "Explainers" }, { handle: "@Wendoverproductions", topic: "Explainers" },
  { handle: "@PolyMatter", topic: "Explainers" }, { handle: "@crashcourse", topic: "Education" }, { handle: "@SciShow", topic: "Science" },
  { handle: "@TED", topic: "Talks" }, { handle: "@Vox", topic: "News & explainers" },
];

/** Suggestions not already followed (case-insensitive handle match). */
export const notFollowed = (handles: (string | null | undefined)[]) => {
  const have = new Set(handles.filter(Boolean).map((h) => h!.toLowerCase()));
  return SUGGESTED.filter((s) => !have.has(s.handle.toLowerCase()));
};
