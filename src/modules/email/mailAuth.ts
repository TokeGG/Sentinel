// Which sign-in an email account uses. Pure. OAuth accounts store preset
// "<base>:oauth" (no schema change); their token comes from core/connect per call.
export const OAUTH_PROVIDERS: Record<string, string> = { gmail: "google-mail", outlook: "microsoft-mail" };

export interface MailAuth { base: string; provider: string | null }

export function authOf(preset: string): MailAuth {
  const [base, kind] = preset.split(":");
  const provider = kind === "oauth" ? OAUTH_PROVIDERS[base] ?? null : null;
  return { base, provider };
}

export const oauthPreset = (base: string): string => {
  if (!OAUTH_PROVIDERS[base]) throw new Error(`no OAuth sign-in for ${base}`);
  return `${base}:oauth`;
};

/** Base preset id whose OAuth provider is `providerId`, or null. */
export const baseForProvider = (providerId: string): string | null =>
  Object.keys(OAUTH_PROVIDERS).find((k) => OAUTH_PROVIDERS[k] === providerId) ?? null;
