// Shared by the content script, the extension pages and background.js.

// Anchoring, after the W3C TextQuoteSelector that Hypothesis uses: a highlight
// is its exact text plus a little context on each side, so it survives
// re-renders and can be told apart from other copies of the same words.
const CONTEXT = 32;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA']);

// All visible text under root as one string, plus where each text node starts in it.
function textIndex(root) {
  const nodes = [];
  let text = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.nodeType === Node.TEXT_NODE ? NodeFilter.FILTER_ACCEPT
      : SKIP_TAGS.has(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP,
  });
  for (let n; (n = walker.nextNode());) {
    nodes.push({ node: n, start: text.length });
    text += n.data;
  }
  return { text, nodes };
}

function offsetOf(index, container, offset) {
  if (container.nodeType === Node.TEXT_NODE) {
    const e = index.nodes.find(e => e.node === container);
    return e ? e.start + offset : -1;
  }
  const point = document.createRange();
  point.setStart(container, offset);
  const e = index.nodes.find(e => point.comparePoint(e.node, 0) >= 0); // first text node after the point
  return e ? e.start : index.text.length;
}

// Range -> {quote, prefix, suffix}, with surrounding whitespace trimmed off. Null if unusable.
function describe(range, index = textIndex(document.body)) {
  const { text } = index;
  let start = offsetOf(index, range.startContainer, range.startOffset);
  let end = offsetOf(index, range.endContainer, range.endOffset);
  if (start < 0 || end < 0) return null;
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  if (start === end) return null;
  return {
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
  };
}

// Where the quote starts in text, choosing the copy whose surroundings fit best. -1 if absent.
function locate(text, quote, prefix = '', suffix = '') {
  if (!quote) return -1;
  let best = -1, bestScore = -1;
  for (let i = text.indexOf(quote); i !== -1; i = text.indexOf(quote, i + 1)) {
    const end = i + quote.length;
    const score = sharedRun(text.slice(Math.max(0, i - prefix.length), i), prefix, true)
      + sharedRun(text.slice(end, end + suffix.length), suffix, false);
    if (score > bestScore) [best, bestScore] = [i, score];
  }
  return best;
}

// How many characters a and b share, counting from their ends or their starts.
function sharedRun(a, b, fromEnd) {
  let n = 0;
  while (n < a.length && n < b.length
    && (fromEnd ? a[a.length - 1 - n] === b[b.length - 1 - n] : a[n] === b[n])) n++;
  return n;
}

// Text offsets -> DOM Range. ponytail: linear scan per highlight; binary search if pages get huge.
function toRange({ nodes }, start, end) {
  const s = nodes.find(e => start < e.start + e.node.length);
  const t = nodes.find(e => end <= e.start + e.node.length);
  const range = document.createRange();
  range.setStart(s.node, start - s.start);
  range.setEnd(t.node, end - t.start);
  return range;
}

// The same page should match across visits: drop the #hash and tracking params.
function normalizeUrl(href) {
  const u = new URL(href);
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|mc_eid$)/.test(k)) u.searchParams.delete(k);
  }
  return u.href;
}

// Highlights are stored one key per page: "p:<url>" -> { [id]: row }.
const pageKey = url => 'p:' + url;

async function allRows() {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all).filter(([k]) => k.startsWith('p:')).flatMap(([, page]) => Object.values(page));
}

// Message background.js; rethrows its errors here.
async function send(type, payload = {}) {
  const res = await chrome.runtime.sendMessage({ type, ...payload });
  if (res?.error) throw new Error(res.error);
  return res?.result;
}

if (typeof module === 'object') module.exports = { locate, normalizeUrl };
