# Chrome Web Store listing

Copy each field into the developer dashboard. Images are in this folder.

## Package
Upload `dist/highlights.zip` (run `./build.sh` first). The **summary** comes from `manifest.json`:
> Highlight text on any web page, add notes and #tags, and find it all again in one searchable library.

## Store listing tab

**Description**
```
Highlights is a quiet place for the best lines you read on the web.

Select text on any page and click Highlight. That's it: no dialog, no folders. The line turns yellow and stays highlighted every time you come back to that page.

WHAT IT DOES
• Highlight with one click, a keyboard shortcut (Alt+H, or Control+Shift+H on Mac), or the right-click menu.
• Click any highlight to add a note. Type #words and they become tags.
• Write a note about a whole page from the toolbar button.
• Find anything again in your library: one search box over every highlight, note and page title. Search #design to see only that tag.
• Jump from the library straight back to the highlighted line on the original page.
• Export everything as Markdown or JSON whenever you like. Your words, in plain text.

WORKS WITHOUT AN ACCOUNT
Everything is saved in your browser. Sign in with Google only if you want your highlights on all your devices.

PRIVATE BY DESIGN
No ads, no tracking, no analytics. Only the text you choose to highlight is saved, never your browsing history. When you sign in, your highlights are visible to your account alone.

Built to stay out of the way: one color, one search box, nothing to set up.
```

**Category:** Productivity → Tools
**Language:** English

**Graphic assets**
- Store icon: `icons/icon128.png`
- Screenshots, in this order:
  1. `screenshot-1-highlight.png`
  2. `screenshot-2-select.png`
  3. `screenshot-3-library.png`
  4. `screenshot-4-search-dark.png`
- Small promo tile: `promo-small-440x280.png`
- Marquee promo tile: leave empty (optional)

**Additional fields**
- Homepage URL: `https://github.com/shambhu-10/Highlights`
- Support URL: `https://github.com/shambhu-10/Highlights/issues`

## Privacy tab

**Single purpose**
```
Highlight text on web pages and save those highlights, with optional notes, to a personal searchable library that can sync across the user's devices.
```

**Permission justifications**

| Permission | Justification |
|---|---|
| storage | Saves the user's highlights and notes in the browser. |
| unlimitedStorage | A library of highlights can grow past the default 10 MB storage limit. |
| contextMenus | Adds a "Highlight" item to the right-click menu when text is selected. |
| identity | Optional Google sign-in (via launchWebAuthFlow) so highlights can sync across the user's devices. |
| alarms | Runs a background sync every few minutes while the user is signed in. |
| activeTab | The toolbar popup reads the current tab's URL and title to show that page's note and highlight count. |
| scripting | When the extension is installed or updated, adds the highlighter to tabs that are already open, so users don't have to reload them. |
| Host permission (http/https) | The user can highlight text on any page they read, so the highlighter must run on every site. It only reads page text to place highlights the user made; it doesn't read or send anything else. |

**Remote code:** No, I am not using remote code.

**Data usage.** Tick:
- Personally identifiable information: the email address from Google sign-in, used only to identify the account.
- Web history: the URL and title of pages where the user made a highlight.
- Website content: the text the user highlighted and their notes.

Then tick all three certifications: not sold to third parties; not used for purposes unrelated to the single purpose; not used for creditworthiness or lending.

**Privacy policy URL:** `https://github.com/shambhu-10/Highlights/blob/main/PRIVACY.md`

## Distribution tab
Free · Public · All regions.

## Test instructions tab (for the reviewer)
```
No account is needed. Open any article, select text, and click the black "Highlight" button that appears (or right-click > Highlight). Click a highlighted line to add a note. Open the toolbar popup and click "Library" to see and search all highlights. Signing in with Google is optional and only enables sync across devices.
```

## Before you submit
1. **Add the store redirect URL.** The store assigns a new extension ID, shown at the top of the dashboard item. In Supabase → Authentication → URL Configuration → Redirect URLs, add `https://<that-id>.chromiumapp.org/**`. Without it, sign-in fails for store installs.
2. **Publish the Google sign-in app.** In Google Cloud → Google Auth Platform → Audience, click "Publish app". While it's in Testing mode, the reviewer and your users can't sign in.
