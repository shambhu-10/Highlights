const $ = id => document.getElementById(id);
const fail = e => { $('error').textContent = e.message; $('error').hidden = false; };

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
if (/^https?:/.test(tab?.url || '')) {
  const url = normalizeUrl(tab.url);
  const key = pageKey(url);
  const live = Object.values((await chrome.storage.local.get(key))[key] || {}).filter(r => !r.deleted);
  const n = live.filter(r => r.quote).length;
  $('count').textContent = n ? `${n} highlight${n > 1 ? 's' : ''} on this page` : 'Select text on the page, then Highlight (or Alt+H).';
  let pageNote = live.find(r => !r.quote)
    || { id: crypto.randomUUID(), url, title: tab.title, quote: null, created_at: new Date().toISOString() };
  $('note').value = pageNote.note || '';
  $('note').oninput = () => {
    const note = $('note').value;
    pageNote = { ...pageNote, note, deleted: !note.trim() };
    send('save', { row: pageNote }).catch(fail);
  };
  $('note').focus();
} else {
  $('count').textContent = 'Highlights works on web pages.';
  $('note').hidden = true;
}

$('library').onclick = () => chrome.tabs.create({ url: 'library.html' });

const s = await send('session');
$('account').hidden = !!s && !s.expired;
$('account').textContent = s?.expired ? 'Sign in again' : 'Sign in to sync';
$('account').onclick = () => send('signIn').then(() => window.close(), fail);
