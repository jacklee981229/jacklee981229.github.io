import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstColon, inlineHtml, plainText, readList, readNow } from '../src/lib/now.js';
import { timeAgo } from '../src/lib/dates.js';

const SITE = 'https://example.github.io';

test('the file as written: two items, label before the first colon, emoji included', () => {
  const now = readNow('<!-- One line per item. -->\n- 🎮 Playing: Dream Quest\n- 💻 Building: Jack\'s Space\n');
  assert.deepEqual(now.items, [{ label: '🎮 Playing', value: 'Dream Quest' }, { label: '💻 Building', value: "Jack's Space" }]);
  assert.equal(now.note, '');
});

test('a value may hold colons of its own, and needs no quotes', () => {
  assert.deepEqual(readNow('- 🎮 Playing: Space Cats: Return').items, [{ label: '🎮 Playing', value: 'Space Cats: Return' }]);
  assert.deepEqual(readNow('- Watching: "The Long Night"').items, [{ label: 'Watching', value: '"The Long Night"' }]);
});

test('a line without a colon is a plain line; so is one with nothing on a side of it', () => {
  assert.deepEqual(readNow('- Taking it easy').items, [{ value: 'Taking it easy' }]);
  assert.deepEqual(readNow('- Reading:').items, [{ value: 'Reading:' }]);
  assert.deepEqual(readNow('- : nothing before').items, [{ value: ': nothing before' }]);
});

test("a link's address doesn't count as the label's colon", () => {
  assert.equal(firstColon('[my site](https://a.b): c'), 22);
  assert.deepEqual(readNow('- Reading: [a post](https://example.com/a)').items, [{ label: 'Reading', value: '[a post](https://example.com/a)' }]);
  assert.deepEqual(readNow('- [a post](https://example.com/a)').items, [{ value: '[a post](https://example.com/a)' }]);
});

test('text under the list is the note; comments, blank items and "*" items are handled', () => {
  const now = readNow('- One: 1\n* Two: 2\n-   \n<!-- a\nlong comment -->\n\nA note with **bold**.\n\nSecond paragraph.');
  assert.deepEqual(now.items.map((i) => i.value), ['1', '2']);
  assert.equal(now.note, 'A note with **bold**.\n\nSecond paragraph.');
});

test('an empty or missing file is no items and no note, never an error', () => {
  for (const text of ['', '   \n\n', '<!-- only a comment -->', undefined, null]) assert.deepEqual(readNow(text), { items: [], note: '' });
});

test('list lines keep their line numbers, comments counted', () => {
  assert.deepEqual(readList('<!-- a\nb -->\n- one\n\n- two').items, [{ text: 'one', line: 3 }, { text: 'two', line: 5 }]);
});

test('values become HTML: links work, outside links open a new tab, typed HTML stays text', () => {
  assert.equal(inlineHtml('Dream Quest', SITE), 'Dream Quest');
  assert.equal(inlineHtml('[my page](/lab/)', SITE), '<a href="/lab/">my page</a>');
  assert.equal(inlineHtml('[x](https://other.com/)', SITE), '<a href="https://other.com/" target="_blank" rel="noopener" aria-describedby="new-tab">x</a>');
  assert.equal(inlineHtml('<b>hi</b>', SITE), '&lt;b&gt;hi&lt;/b&gt;');
});

test('plain text drops link addresses and emphasis, for matching names', () => {
  assert.equal(plainText('[Dream Quest](https://store.example/dq)'), 'Dream Quest');
  assert.equal(plainText('**Moon Farm**'), 'Moon Farm');
});

const at = (iso) => new Date(`${iso}T12:00:00+08:00`);

test('how long ago, in Malaysia days', () => {
  const now = at('2026-10-04');
  assert.equal(timeAgo(at('2026-10-04'), now), 'today');
  assert.equal(timeAgo(at('2026-10-05'), now), 'today');
  assert.equal(timeAgo(at('2026-10-03'), now), 'yesterday');
  assert.equal(timeAgo(at('2026-10-01'), now), '3 days ago');
  assert.equal(timeAgo(at('2026-09-27'), now), '1 week ago');
  assert.equal(timeAgo(at('2026-09-13'), now), '3 weeks ago');
  assert.equal(timeAgo(at('2026-09-04'), now), '1 month ago');
  assert.equal(timeAgo(at('2026-04-04'), now), '6 months ago');
  assert.equal(timeAgo(at('2025-10-04'), now), '1 year ago');
  assert.equal(timeAgo(at('2023-02-23'), now), '3 years ago');
});

test('a day changes at midnight in Malaysia, not in UTC', () => {
  // 11 pm on the 3rd and 1 am on the 4th, Malaysia time: one day apart, though the same UTC day.
  assert.equal(timeAgo(new Date('2026-10-03T23:00:00+08:00'), new Date('2026-10-04T01:00:00+08:00')), 'yesterday');
});
