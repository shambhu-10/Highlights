# Highlights

Highlight the web. Find it again.

Select text on any page and click **Highlight** (or press `Alt+H` on Windows/Linux, `Control+Shift+H` on Mac, or right-click → Highlight). Click a highlight to add a note; `#words` in a note are tags. The toolbar button holds a note for the whole page. The library page lists everything, with one search box (`#tag` filters) and Markdown/JSON export.

Works without an account. Sign in with Google to sync across devices.

## Install

You need Google Chrome (or another Chromium browser such as Brave, Edge or Arc) and [git](https://git-scm.com).

1. Clone the repo:

   ```bash
   git clone https://github.com/shambhu-10/Highlights.git
   ```

2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the `Highlights` folder you just cloned.
5. Pin it: click the puzzle-piece icon in the toolbar, then the pin next to **Highlights**.

That's it. Tabs that are already open work right away, with no refresh needed.

### Use it
- **Highlight:** select text, then click the black **Highlight** button that appears (or press `Alt+H` on Windows/Linux, `Control+Shift+H` on Mac).
  To change the shortcut, open `chrome://extensions/shortcuts`.
- **Add a note:** click any highlight. Add `#tags` in the note.
- **Note on the whole page:** click the toolbar icon.
- **See everything:** toolbar icon → **Library**. Search, filter by `#tag`, export.
- **Sync across devices:** Library → **Sign in to sync** with Google.

It doesn't run on `chrome://` pages, the new-tab page, the Chrome Web Store or PDFs.

### Update to the latest version

```bash
git pull
```

Then click the reload icon on **Highlights** in `chrome://extensions`.

Chrome keeps the existing keyboard shortcut when an extension updates. If a new shortcut doesn't work, set it at `chrome://extensions/shortcuts`.

## Run your own sync server (optional)

By default, sync uses the Highlights Supabase project. To use your own instead:

1. Create a project at [supabase.com](https://supabase.com). In the **SQL editor**, run `supabase.sql`.
2. In Google Cloud Console, create an OAuth client (type: Web application). Authorised redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`.
3. In Supabase: **Authentication → Providers → Google**. Turn it on and paste the client ID and secret.
4. In Supabase: **Authentication → URL Configuration → Redirect URLs**. Add `https://nhcdkolaeconojiencdboaoigeheakpn.chromiumapp.org/**`. The extension ID is fixed by the `key` in `manifest.json`.
5. Put your project URL (without `/rest/v1`) and anon key (**Settings → API**) in `config.js`, then reload the extension.

Row-level security keeps each user's highlights private.

## Test

```bash
node shared.test.js
```

## Not yet

A web dashboard, PDFs, email sign-up, colours, daily resurfacing. `build.sh` packages a zip for a future Chrome Web Store release.
