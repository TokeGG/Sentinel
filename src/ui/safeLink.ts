/** Only http(s) links may reach the opener plugin; anything else -> null. */
export function safeLink(l: unknown): string | null {
  return typeof l === "string" && /^https?:\/\//i.test(l) ? l : null;
}
