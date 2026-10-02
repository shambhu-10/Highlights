// The only writer of storage. Also: context menu, shortcut, Google sign-in, Supabase sync.
importScripts('config.js', 'shared.js');

const FIELDS = ['id', 'url', 'title', 'quote', 'prefix', 'suffix', 'note', 'created_at', 'updated_at', 'deleted'];
const strip = r => Object.fromEntries(FIELDS.map(f => [f, r[f] ?? (f === 'deleted' ? false : null)]));
const newer = (a, b) => !b || Date.parse(a.updated_at) > Date.parse(b.updated_at);
const now = () => new Date().toISOString();

// Storage writes are read-modify-write, so run them one at a time.
let chain = Promise.resolve();
const serial = fn => (chain = chain.catch(() => {}).then(fn));

// Apply fn(page, row) to the page of every row, in one storage read and one write.
async function updatePages(rows, fn) {
  const byKey = Map.groupBy(rows, r => pageKey(r.url));
  const pages = await chrome.storage.local.get([...byKey.keys()]);
  for (const [key, list] of byKey) {
    pages[key] ||= {};
    for (const r of list) fn(pages[key], r);
  }
  await chrome.storage.local.set(pages);
}

async function save({ row }) {
  const r = { ...row, id: row.id || crypto.randomUUID(), created_at: row.created_at || now(), updated_at: now() };
  await serial(() => updatePages([r], page => { page[r.id] = { ...strip(r), dirty: true }; }));
  schedulePush();
  return r.id;
}

// Soft delete, so the deletion reaches other devices.
const remove = ({ row }) => save({ row: { ...row, deleted: true } });

async function importRows({ rows }) {
  const valid = (Array.isArray(rows) ? rows : []).filter(r => r && typeof r.id === 'string'
    && typeof r.url === 'string' && /^https?:/.test(r.url)
    && (r.quote == null || typeof r.quote === 'string') && (r.note == null || typeof r.note === 'string'));
  await serial(() => updatePages(valid, (page, raw) => {
    const r = strip({ created_at: now(), updated_at: now(), ...raw });
    if (newer(r, page[r.id])) page[r.id] = { ...r, dirty: true };
  }));
  schedulePush();
  return valid.length;
}

// --- Auth: Google via Supabase, tokens kept in storage under "auth". ---

const claims = jwt => JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));

async function setSession({ access_token, refresh_token, expires_in }) {
  const { sub, email } = claims(access_token);
  const auth = { access_token, refresh_token, expires_at: Date.now() + expires_in * 1000, sub, email };
  await chrome.storage.local.set({ auth });
  return auth;
}

async function signIn() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Add your Supabase URL and anon key to config.js first.');
  const redirect = chrome.identity.getRedirectURL();
  const back = await chrome.identity.launchWebAuthFlow({
    interactive: true,
    url: `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`,
  });
  const p = new URLSearchParams(new URL(back).hash.slice(1));
  if (!p.get('access_token')) throw new Error(p.get('error_description') || 'Sign-in failed.');
  const { auth: previous } = await chrome.storage.local.get('auth');
  if (previous && previous.sub !== claims(p.get('access_token')).sub) {
    throw new Error(`This browser holds ${previous.email}'s highlights. Sign out of that account first.`);
  }
  await setSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: +p.get('expires_in') });
  if (!previous) {
    // Highlights made while signed out now belong to this account.
    await serial(async () => updatePages(await allRows(), (page, r) => { page[r.id].dirty = true; }));
    await chrome.storage.local.remove('lastPulledAt');
  }
  await sync();
  return session();
}

// Leaves nothing behind for the next person on this browser; the account keeps everything.
async function signOut({ force } = {}) {
  await sync().catch(() => {});
  const unsynced = (await allRows()).filter(r => r.dirty).length;
  if (unsynced && !force) return { unsynced };
  await chrome.storage.local.clear();
  return { unsynced: 0 };
}

async function session() {
  const { auth } = await chrome.storage.local.get('auth');
  return auth ? { email: auth.email, expired: !!auth.expired } : null;
}

let refreshing;
async function token() {
  const { auth } = await chrome.storage.local.get('auth');
  if (Date.now() < auth.expires_at - 60_000) return auth.access_token;
  refreshing ||= refresh(auth).finally(() => (refreshing = null));
  return refreshing;
}

async function refresh(auth) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: auth.refresh_token }),
  });
  if (res.status === 400 || res.status === 401) {
    // Session revoked. Keep the data (it may hold unsynced edits) and ask for sign-in again.
    await chrome.storage.local.set({ auth: { ...auth, expired: true } });
    throw new Error('Session expired. Sign in again.');
  }
  if (!res.ok) throw new Error(`Couldn't refresh session (${res.status}).`);
  return (await setSession(await res.json())).access_token;
}

// --- Sync: local-first, last write wins. ---
// ponytail: whole-row last-write-wins; merge per field if two devices often edit the same note.
// ponytail: everything lives in chrome.storage and is searched in memory; IndexedDB past ~50k highlights.

async function api(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${await token()}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`Sync failed (${res.status}): ${await res.text()}`);
  return res;
}

const PAGE = 1000;

async function doSync() {
  const { auth } = await chrome.storage.local.get('auth');
  if (!auth || auth.expired) return;

  // Pull first, so a newer edit from another device beats an older local one.
  // synced_at is stamped by the server, so device clocks don't matter here.
  let { lastPulledAt } = await chrome.storage.local.get('lastPulledAt');
  for (;;) {
    const since = lastPulledAt ? `&synced_at=gt.${encodeURIComponent(lastPulledAt)}` : '';
    const rows = await (await api(`highlights?select=*&order=synced_at.asc&limit=${PAGE}${since}`)).json();
    if (!rows.length) break;
    await serial(() => updatePages(rows, (page, r) => {
      if (newer(r, page[r.id])) page[r.id] = { ...strip(r), dirty: false };
    }));
    lastPulledAt = rows.at(-1).synced_at;
    await chrome.storage.local.set({ lastPulledAt });
    if (rows.length < PAGE) break;
  }

  const dirty = (await allRows()).filter(r => r.dirty);
  for (let i = 0; i < dirty.length; i += 500) {
    const batch = dirty.slice(i, i + 500);
    await api('highlights?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch.map(strip)),
    });
    // Only clear rows not edited again while the request was in flight.
    await serial(() => updatePages(batch, (page, r) => {
      if (page[r.id]?.updated_at === r.updated_at) page[r.id].dirty = false;
    }));
  }
}

let syncing, again;
function sync() {
  if (syncing) { again = true; return syncing; }
  syncing = doSync().finally(() => {
    syncing = null;
    if (again) { again = false; sync().catch(console.warn); }
  });
  return syncing;
}

let pushTimer;
function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => sync().catch(console.warn), 2000);
}

// --- Wiring ---

const handlers = { save, remove, import: importRows, signIn, signOut, session, sync: () => sync() };

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  const handler = handlers[msg.type];
  if (!handler) return;
  handler(msg).then(result => reply({ result }), e => reply({ error: e.message }));
  return true;
});

const highlightIn = tab => tab?.id && chrome.tabs.sendMessage(tab.id, { type: 'highlight' }).catch(() => {});

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({ id: 'highlight', title: 'Highlight', contexts: ['selection'] });
  // Chrome only injects content scripts on page load; reach tabs that were already open.
  for (const tab of await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })) {
    const target = { tabId: tab.id };
    chrome.scripting.insertCSS({ target, files: ['content.css'] }).catch(() => {});
    chrome.scripting.executeScript({ target, files: ['shared.js', 'content.js'] }).catch(() => {});
  }
});
chrome.contextMenus.onClicked.addListener((_info, tab) => highlightIn(tab));
chrome.commands.onCommand.addListener((cmd, tab) => cmd === 'highlight' && highlightIn(tab));

chrome.alarms.get('sync').then(a => a || chrome.alarms.create('sync', { periodInMinutes: 5 }));
chrome.alarms.onAlarm.addListener(() => sync().catch(console.warn));
chrome.runtime.onStartup.addListener(() => sync().catch(console.warn));
