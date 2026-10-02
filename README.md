# Highlights

Highlight the web. Find it again.

Select text on any page and click **Highlight** (or press `Alt+H`, or right-click → Highlight). Click a highlight to add a note; `#words` in a note are tags. The toolbar button holds a note for the whole page. The library page lists everything, with one search box (`#tag` filters) and Markdown/JSON export.

Works without an account. Sign in with Google to sync across devices.

## Install (unpacked)

1. `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → pick this folder.
2. The extension ID will be `nhcdkolaeconojiencdboaoigeheakpn` (fixed by the `key` in `manifest.json`).

## Turn on sync (one time)

1. Create a project at [supabase.com](https://supabase.com). In the **SQL editor**, run `supabase.sql`.
2. In Google Cloud Console, create an OAuth client (type: Web application). Authorised redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`.
3. In Supabase: **Authentication → Providers → Google**. Turn it on and paste the client ID and secret.
4. In Supabase: **Authentication → URL Configuration → Redirect URLs**. Add `https://nhcdkolaeconojiencdboaoigeheakpn.chromiumapp.org/**`.
5. Put your project URL and anon key (**Settings → API**) in `config.js`, then reload the extension.

Anyone with a Google account can sign up. Row-level security keeps each user's highlights private.

## Publish to the Chrome Web Store

1. Run `./build.sh` to create `dist/highlights.zip`, without the dev-only `key`.
2. Upload the zip at the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole). Use `PRIVACY.md` (its GitHub URL) as the privacy policy.
3. The store gives the extension a new ID. Add `https://<store-id>.chromiumapp.org/**` to Supabase **Redirect URLs**, or sign-in won't work for store installs.

## Test

```bash
node shared.test.js
```

## Not yet

PDFs, email sign-up, colours, daily resurfacing.
