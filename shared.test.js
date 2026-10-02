// node shared.test.js
const assert = require('node:assert');
const { locate, normalizeUrl } = require('./shared.js');

const text = 'Taste is not subjective. Good design is simple. Good design is hard. The end.';

assert.equal(locate(text, 'Good design is simple'), 25);
assert.equal(locate(text, 'missing'), -1);
assert.equal(locate(text, ''), -1);
// Same words twice: the surrounding text decides which copy.
assert.equal(locate(text, 'Good design is', 'simple. ', ' hard'), 48);
assert.equal(locate(text, 'Good design is', 'subjective. ', ' simple'), 25);
// Context that only partly matches still picks the closer copy.
assert.equal(locate(text, 'Good design is', 'XXmple. ', ''), 48);

assert.equal(normalizeUrl('https://a.com/p?id=1&utm_source=x&fbclid=y#top'), 'https://a.com/p?id=1');
assert.equal(normalizeUrl('https://a.com/p'), 'https://a.com/p');

console.log('ok');
