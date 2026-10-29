# Connecting accounts

Settings > Accounts has one Connect button per service. Sign-in happens in your
browser; Sentinel never sees a password. Refresh tokens (or non-expiring access
tokens) are kept only in the OS keychain (service `hub.accounts`); the
`accounts` table holds only the account name, label and last error.

Every provider is a **public client**: PKCE loopback (`http://127.0.0.1:<port>`,
state-checked, callback path only) or the device-code flow. A build can ship
client IDs in `src/core/connect/clients.ts` (empty by default). Otherwise paste
your own in Settings > Accounts > Client IDs (stored in `app_settings` as
`client_id:<group>`; not secret).

| Service | Flow | Redirect / port | Client ID needed |
|---|---|---|---|
| Mastodon | loopback PKCE | `http://127.0.0.1:53683` | no (the app registers itself with your instance) |
| Gmail, YouTube | loopback PKCE | `http://127.0.0.1:53690` | Google |
| Outlook / Microsoft 365 | loopback PKCE | `http://localhost:53691` | Microsoft |
| Twitch | device code | none | Twitch |
| GitHub | device code | none | GitHub |
| Reddit | loopback | `http://127.0.0.1:53684` | Reddit |

## Google (Gmail and YouTube)

1. Open https://console.cloud.google.com/ and create a project (top bar > New project).
2. APIs & Services > Library: enable **Gmail API** and **YouTube Data API v3**.
3. APIs & Services > OAuth consent screen: User type **External** > Create. Fill app name and your email. Scopes: add `https://mail.google.com/` and `.../auth/youtube.readonly`.
4. Publishing status: press **Publish app** (In production). In Testing, refresh tokens expire after 7 days. Google may ask for verification for the Gmail scope; until then you can still sign in yourself after the "unverified app" warning.
5. Credentials > Create credentials > OAuth client ID > Application type **Desktop app** > Create.
6. Copy the **Client ID** and **Client secret** into Settings > Accounts > Client IDs > Gmail, YouTube. (Google requires the secret even for desktop apps; it is not really secret, but Sentinel still keeps it in the keychain.)
7. Gmail: Settings > See all settings > Forwarding and POP/IMAP > IMAP enabled.

## Microsoft (Outlook.com, Microsoft 365)

1. Open https://entra.microsoft.com/ > Applications > App registrations > New registration.
2. Name: Sentinel. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
3. Redirect URI: platform **Public client/native (mobile & desktop)**, value `http://localhost:53691`. Register.
4. Authentication: **Allow public client flows** = Yes. Save.
5. API permissions > Add a permission > APIs my organization uses > search **Office 365 Exchange Online** (or Microsoft Graph for personal) > Delegated: `IMAP.AccessAsUser.All`, `SMTP.Send`; plus `offline_access`, `openid`, `email`.
6. Overview: copy **Application (client) ID** into Settings > Accounts > Client IDs > Outlook. No secret.
7. Work/school tenants: an admin may need to grant consent and enable SMTP AUTH for the mailbox.

## Twitch (chat send)

1. https://dev.twitch.tv/console > Applications > Register Your Application.
2. OAuth Redirect URL: `http://localhost` (unused by the device flow, but required). Category: Chat Bot. Client Type: **Public**. Create.
3. Manage > copy **Client ID** into Settings > Accounts > Client IDs > Twitch.
4. Connect shows a code; enter it at twitch.tv/activate. The pasted-token field in the Chat panel still works as a fallback.

## GitHub (device flow)

1. https://github.com/settings/developers > OAuth Apps > New OAuth App.
2. Homepage URL: anything (e.g. your repo). Callback URL: `http://127.0.0.1` (unused).
3. Register, then tick **Enable Device Flow** and save.
4. Copy the **Client ID** into Settings > Accounts > Client IDs > GitHub. No secret.
5. Connect shows a code; enter it at github.com/login/device. A pasted PAT still works as a fallback.

## Reddit

1. https://www.reddit.com/prefs/apps > **create another app…**.
2. Type: **installed app**. Redirect uri: `http://127.0.0.1:53684`. Create app.
3. The client ID is the string under the app name. Paste it into Settings > Accounts > Client IDs > Reddit (or the Social panel's field).
4. Following & Likes needs the `mysubreddits` and `history` permissions: sign-ins made before they were added must press Connect again.

## Troubleshooting

Every failed Connect shows the cause and the next step. Press **Test** next to a service to check its client ID format and endpoints without signing in. "Port N is busy" = an earlier sign-in is still waiting (press Cancel) or another program uses the port.

## Mastodon

Nothing to register: enter your instance (e.g. `mastodon.social`) and press Connect.
The app registers itself with the instance (dynamic client registration) and caches
the client per instance.

## Bluesky

No public-client OAuth that works here; it keeps its app-password sign-in in the Social panel.
