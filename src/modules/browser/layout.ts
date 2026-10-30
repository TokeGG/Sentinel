// Toolbar band and sidebar sizes; the Rust page rect (geometry.rs browser_rect) uses the same numbers (tested).
export const BROWSER_TOP = 96; // tab strip 32 + toolbar 36 + bookmarks bar 28
export const BROWSER_LEFT = 44; // web-app sidebar
export const HISTORY_CAP = 2000;
export const DEFAULT_APPS: { name: string; url: string }[] = [
  { name: "Discord", url: "https://discord.com/app" },
  { name: "WhatsApp", url: "https://web.whatsapp.com/" },
  { name: "Telegram", url: "https://web.telegram.org/" },
  { name: "Messenger", url: "https://www.messenger.com/" },
  { name: "Instagram", url: "https://www.instagram.com/" },
  { name: "X", url: "https://x.com/" },
  { name: "Twitch", url: "https://www.twitch.tv/" },
  { name: "Spotify", url: "https://open.spotify.com/" },
];
import { numOption } from "../../ui/numOption.ts";
export const browserOptions = [numOption("speedDial", "Bookmarks on the new tab page", 12, 0, 48)];
