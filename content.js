// Paints saved highlights and turns a selection into a new one.
// Reads storage directly; writes go through background.js.

let url, key, rows = {}, ranges = new Map(); // id -> Range
const painted = new Highlight();
CSS.highlights.set('highlights-ext', painted);

async function load() {
  url = normalizeUrl(location.href);
  key = pageKey(url);
  rows = (await chrome.storage.local.get(key))[key] || {};
  paint();
}

function paint() {
  painted.clear();
  ranges = new Map();
  const live = Object.values(rows).filter(r => r.quote && !r.deleted);
  if (!live.length) return;
  const index = textIndex(document.body);
  for (const r of live) {
    const start = locate(index.text, r.quote, r.prefix, r.suffix);
    if (start < 0) continue; // the page changed; the highlight still lives in the library
    const range = toRange(index, start, start + r.quote.length);
    painted.add(range);
    ranges.set(r.id, range);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[key]) {
    rows = changes[key].newValue || {};
    paint();
  }
});

// Late-loading content and single-page-app navigation.
let pending;
new MutationObserver(() => {
  pending ||= setTimeout(() => {
    pending = null;
    normalizeUrl(location.href) === url ? paint() : load();
  }, 500);
}).observe(document.body, { childList: true, subtree: true, characterData: true });

// --- UI, in a closed shadow root so page styles can't reach it ---

const host = document.createElement('highlights-ext');
host.style.cssText = 'position:absolute;top:0;left:0;z-index:2147483647';
const ui = host.attachShadow({ mode: 'closed' });
ui.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; font: 13px/1.4 -apple-system, system-ui, sans-serif; }
  [hidden] { display: none !important; }
  #btn { position: absolute; border: 0; border-radius: 999px; padding: 5px 11px; cursor: pointer;
         background: #1d1d1b; color: #fffefa; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
  #pop { position: absolute; width: 280px; padding: 8px; border-radius: 8px; background: #fffefa;
         color: #1d1d1b; border: 1px solid #e3e0d8; box-shadow: 0 6px 24px rgba(0,0,0,.18); }
  textarea { display: block; width: 100%; min-height: 56px; border: 0; outline: 0; resize: none;
             background: transparent; color: inherit; }
  #del { border: 0; background: none; padding: 0; color: #8a877f; cursor: pointer; }
  #del:hover { color: #b3261e; }
</style>
<button id="btn" title="Alt+H" hidden>Highlight</button>
<div id="pop" hidden><textarea placeholder="Note  (#tags work)"></textarea><button id="del">Delete</button></div>`;
const [btn, pop, note, del] = ['#btn', '#pop', 'textarea', '#del'].map(s => ui.querySelector(s));
document.querySelector('highlights-ext')?.remove(); // left by a copy from before the extension reloaded
document.documentElement.append(host);
// Keep page keyboard shortcuts from firing while typing a note.
for (const t of ['keydown', 'keyup', 'keypress']) host.addEventListener(t, e => e.stopPropagation());

// Position at viewport point (x, y), kept on screen.
function place(el, x, y) {
  el.hidden = false;
  const maxX = document.documentElement.clientWidth - el.offsetWidth - 8;
  el.style.left = `${Math.max(8, Math.min(x, maxX)) + scrollX}px`;
  el.style.top = `${y + scrollY}px`;
}

async function create() {
  btn.hidden = true;
  const sel = getSelection();
  if (sel.isCollapsed) return;
  const d = describe(sel.getRangeAt(0));
  if (!d) return;
  sel.removeAllRanges();
  await send('save', { row: { url, title: document.title, ...d, note: '' } });
}

let editing; // the row whose note is open
function openNote(id, x, y) {
  editing = rows[id];
  note.value = editing.note || '';
  place(pop, x, y + 10);
  note.focus();
}

function closeNote() {
  if (!editing) return;
  const value = note.value.trim();
  if (value !== (editing.note || '')) send('save', { row: { ...editing, note: value } });
  editing = null;
  pop.hidden = true;
}

function hitTest(x, y) {
  const p = document.caretRangeFromPoint(x, y);
  if (p) for (const [id, r] of ranges) if (r.isPointInRange(p.startContainer, p.startOffset)) return id;
}

btn.addEventListener('mousedown', e => e.preventDefault()); // keep the selection
btn.addEventListener('click', create);
del.addEventListener('click', () => {
  send('remove', { row: editing });
  editing = null;
  pop.hidden = true;
});
note.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); closeNote(); }
  if (e.key === 'Escape') { note.value = editing.note || ''; closeNote(); }
});

document.addEventListener('mousedown', e => {
  if (e.composedPath().includes(host)) return;
  closeNote();
  btn.hidden = true;
});

document.addEventListener('mouseup', e => {
  if (e.composedPath().includes(host)) return;
  setTimeout(() => { // let the selection settle
    const sel = getSelection();
    if (!sel.isCollapsed && sel.toString().trim()) {
      const rects = sel.getRangeAt(0).getClientRects();
      const last = rects[rects.length - 1];
      if (last) place(btn, last.right + 4, last.bottom + 4);
      return;
    }
    const id = hitTest(e.clientX, e.clientY);
    if (id) openNote(id, e.clientX, e.clientY);
  });
});

chrome.runtime.onMessage.addListener(msg => { if (msg.type === 'highlight') create(); });

load();
