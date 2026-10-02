const $ = id => document.getElementById(id);
const status = text => { $('status').textContent = text; };
const fail = e => status(e.message);

function h(tag, props, ...kids) {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...kids.filter(k => k != null && k !== false));
  return el;
}

const time = s => Date.parse(s) || 0;
const date = s => new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const tagsOf = note => (note || '').toLowerCase().match(/#[\p{L}\p{N}_-]+/gu) || [];

let rows = [], shown = [], stale = false;

async function load() {
  rows = (await allRows()).filter(r => !r.deleted);
  render();
}

function matches(r, terms) {
  const hay = `${r.quote || ''} ${r.note || ''} ${r.title || ''} ${r.url}`.toLowerCase();
  return terms.every(t => (t.startsWith('#') ? tagsOf(r.note).includes(t) : hay.includes(t)));
}

// Pages newest first; within a page, the page note first, then highlights in the order they were made.
function grouped(list) {
  return [...Map.groupBy(list, r => r.url)]
    .map(([url, items]) => ({
      url,
      title: items.find(r => r.title)?.title || url,
      latest: Math.max(...items.map(r => time(r.created_at))),
      items: items.sort((a, b) => (a.quote != null) - (b.quote != null) || time(a.created_at) - time(b.created_at)),
    }))
    .sort((a, b) => b.latest - a.latest);
}

// Chrome's text fragments scroll the source page to the quote.
function jumpUrl(r) {
  const enc = s => encodeURIComponent(s).replace(/-/g, '%2D');
  const words = r.quote.trim().split(/\s+/);
  const text = words.length > 10
    ? `${enc(words.slice(0, 4).join(' '))},${enc(words.slice(-4).join(' '))}`
    : enc(words.join(' '));
  return `${r.url}#:~:text=${text}`;
}

function item(r) {
  const note = h('textarea', { className: 'note', rows: 1, value: r.note || '', placeholder: r.quote ? 'Add a note' : 'Page note' });
  note.onchange = () => send('save', { row: { ...r, note: note.value.trim() } }).catch(fail);
  const del = h('button', { className: 'del', title: 'Delete', textContent: '×' });
  del.onclick = () => confirm(r.quote ? 'Delete this highlight?' : 'Delete this page note?')
    && send('remove', { row: r }).catch(fail);
  return h('article', {}, r.quote && h('a', { className: 'quote', href: jumpUrl(r), target: '_blank' }, r.quote), note, del);
}

function render() {
  // Re-rendering would steal focus from a note being typed; catch up on blur.
  if (document.activeElement?.matches('textarea')) { stale = true; return; }
  stale = false;
  const terms = $('q').value.toLowerCase().split(/\s+/).filter(Boolean);
  shown = rows.filter(r => matches(r, terms));
  // ponytail: renders every match at once; window the list if it grows past a few thousand.
  $('list').replaceChildren(...grouped(shown).map(p => h('section', {},
    h('h2', {}, h('a', { href: p.url, target: '_blank' }, p.title)),
    h('p', { className: 'meta' }, `${new URL(p.url).hostname.replace(/^www\./, '')} · ${date(p.latest)}`),
    ...p.items.map(item),
  )));
  $('empty').hidden = shown.length > 0;
  $('empty').textContent = rows.length
    ? 'Nothing matches.'
    : `Nothing here yet. Select text on any page and press ${SHORTCUT}, or click Highlight.`;
}

function download(name, text, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click();
  URL.revokeObjectURL(a.href);
}

function markdown(list) {
  return '# Highlights\n\n' + grouped(list).map(p => [
    `## [${p.title}](${p.url})`,
    ...p.items.map(r => (r.quote ? `> ${r.quote.replace(/\s*\n\s*/g, ' ')}` : '') + (r.note ? `${r.quote ? '\n\n' : ''}${r.note}` : '')),
  ].join('\n\n')).join('\n\n') + '\n';
}

const stamp = () => new Date().toISOString().slice(0, 10);
$('md').onclick = () => download(`highlights-${stamp()}.md`, markdown(shown), 'text/markdown');
$('json').onclick = () => download(`highlights-${stamp()}.json`,
  JSON.stringify(rows.map(({ dirty, ...r }) => r), null, 2), 'application/json');
$('import').onclick = () => $('file').click();
$('file').onchange = async () => {
  try {
    const n = await send('import', { rows: JSON.parse(await $('file').files[0].text()) });
    status(`Imported ${n}.`);
  } catch (e) { fail(e); }
  $('file').value = '';
};

async function showAccount() {
  const s = await send('session');
  const signIn = h('button', { textContent: s?.expired ? 'Sign in again' : 'Sign in to sync' });
  signIn.onclick = () => send('signIn').catch(fail);
  const signOut = h('button', { textContent: 'Sign out', title: 'Removes highlights from this browser. They stay in your account.' });
  signOut.onclick = async () => {
    try {
      const { unsynced } = await send('signOut');
      if (unsynced && confirm(`${unsynced} highlight${unsynced > 1 ? 's haven’t' : ' hasn’t'} synced yet and will be lost. Sign out anyway?`)) {
        await send('signOut', { force: true });
      }
    } catch (e) { fail(e); }
  };
  $('account').replaceChildren(...(s ? [s.email, s.expired ? signIn : signOut] : [signIn]));
}

$('q').oninput = render;
document.addEventListener('focusout', () => setTimeout(() => stale && render()));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (Object.keys(changes).some(k => k.startsWith('p:'))) load();
  if (changes.auth) showAccount();
});

load();
showAccount();
send('sync').catch(fail);
