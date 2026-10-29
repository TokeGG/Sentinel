// Mastodon instance input + account key helpers (pure).
const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** "https://Mastodon.Social/@me" or "mastodon.social" -> "mastodon.social"; null when not a hostname. */
export function normalizeInstance(input: string): string | null {
  const t = input.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/^@?[^@]*@/, "");
  return HOST.test(t) ? t : null;
}

/** Account key `user@host` (Mastodon `acct` has no host for local users). */
export const mastodonAccount = (acct: string, host: string): string => {
  const a = acct.replace(/^@/, "");
  return a.includes("@") ? a : `${a}@${host}`;
};
export const hostOfAccount = (account: string): string => account.slice(account.lastIndexOf("@") + 1);

/** Registration signature: when scopes or redirect change, the app must be registered again. */
export const registrationSig = (redirect: string, scopes: string[]): string => `${redirect}|${scopes.join(" ")}`;
