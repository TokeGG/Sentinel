// Preset social sites for the Social panel's editable tabs (pure data). `hosts` = the
// site's allow-list for its embedded webview (known CDN/login hosts included).
export type SitePreset = { key: string; label: string; url: string; hosts: string[] };

const h = (...d: string[]) => d.flatMap((x) => (x.startsWith("*.") ? [x] : [x, `*.${x}`]));

export const SITE_PRESETS: SitePreset[] = [
  { key: "x", label: "X", url: "https://x.com/home", hosts: [...h("x.com", "twitter.com"), "*.twimg.com"] },
  { key: "facebook", label: "Facebook", url: "https://www.facebook.com", hosts: [...h("facebook.com"), "fb.com", "*.fbcdn.net"] },
  { key: "instagram", label: "Instagram", url: "https://www.instagram.com", hosts: [...h("instagram.com"), "*.cdninstagram.com", "*.fbcdn.net"] },
  { key: "threads", label: "Threads", url: "https://www.threads.net", hosts: [...h("threads.net", "threads.com", "instagram.com"), "*.cdninstagram.com", "*.fbcdn.net"] },
  { key: "tiktok", label: "TikTok", url: "https://www.tiktok.com", hosts: [...h("tiktok.com", "tiktokcdn.com", "tiktokv.com"), "*.ttwstatic.com", "*.byteoversea.com"] },
  { key: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/feed/", hosts: [...h("linkedin.com", "licdn.com")] },
  { key: "tumblr", label: "Tumblr", url: "https://www.tumblr.com/dashboard", hosts: [...h("tumblr.com"), "*.srvcs.tumblr.com"] },
  { key: "pinterest", label: "Pinterest", url: "https://www.pinterest.com", hosts: [...h("pinterest.com", "pinimg.com")] },
  { key: "reddit", label: "Reddit", url: "https://www.reddit.com", hosts: [...h("reddit.com", "redd.it", "redditmedia.com", "redditstatic.com")] },
  { key: "bluesky", label: "Bluesky", url: "https://bsky.app", hosts: [...h("bsky.app", "bsky.social", "bsky.network"), "*.cdn.bsky.app"] },
  { key: "mastodon", label: "Mastodon", url: "https://mastodon.social", hosts: [...h("mastodon.social")] },
  { key: "twitch", label: "Twitch", url: "https://www.twitch.tv", hosts: [...h("twitch.tv", "ttvnw.net", "jtvnw.net")] },
  { key: "kick", label: "Kick", url: "https://kick.com", hosts: [...h("kick.com")] },
  { key: "youtube", label: "YouTube", url: "https://www.youtube.com", hosts: [...h("youtube.com", "ytimg.com", "googlevideo.com", "ggpht.com"), "accounts.google.com"] },
  { key: "snapchat", label: "Snapchat", url: "https://web.snapchat.com", hosts: [...h("snapchat.com", "sc-cdn.net")] },
  { key: "vk", label: "VK", url: "https://vk.com", hosts: [...h("vk.com", "userapi.com", "vk.me")] },
  { key: "weibo", label: "Weibo", url: "https://weibo.com", hosts: [...h("weibo.com", "weibo.cn", "sinaimg.cn")] },
  { key: "telegram", label: "Telegram Web", url: "https://web.telegram.org", hosts: [...h("telegram.org", "t.me")] },
  { key: "whatsapp", label: "WhatsApp Web", url: "https://web.whatsapp.com", hosts: [...h("whatsapp.com", "whatsapp.net")] },
  { key: "discord", label: "Discord", url: "https://discord.com/app", hosts: [...h("discord.com", "discordapp.com", "discordapp.net", "discord.gg")] },
];

export const presetOf = (key: string): SitePreset | undefined => SITE_PRESETS.find((p) => p.key === key);
