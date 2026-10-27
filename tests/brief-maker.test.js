// The Morning Brief's maker (scripts/brief/): reading each source, and turning the model's answer into a day's file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXCERPT, excerptOf, mergeCandidates, postedSince, readHn, readLobsters, readTrending } from '../scripts/brief/sources.js';
import { FEWEST, briefFile, userMessage } from '../scripts/brief/prompt.js';
import { itemId } from '../src/lib/brief.js';

test('Hacker News: stories keep their link and count; one without a link points at its discussion', () => {
  const got = readHn([
    { id: 1, type: 'story', title: 'A  story', url: 'https://example.com/a', score: 125 },
    { id: 2, type: 'story', title: 'Ask HN: anything?', score: 40 },
    { id: 3, type: 'job', title: 'Hiring', url: 'https://example.com/job' },
    { id: 4, type: 'story', title: 'Gone', dead: true },
    null,
  ]);
  assert.deepEqual(got.map((c) => [c.title, c.url, c.signal]), [['A story', 'https://example.com/a', 125], ['Ask HN: anything?', 'https://news.ycombinator.com/item?id=2', 40]]);
  assert.equal(got[0].discuss, 'https://news.ycombinator.com/item?id=1');
  assert.equal(got[0].id, itemId('https://example.com/a'));
});

test('GitHub Trending: name, description and stars today from the page', () => {
  const row = (repo, about, today) => `<article class="Box-row">
    <h2 class="h3 lh-condensed">
      <a data-view-component="true" href="/${repo}" class="Link">
        <span class="text-normal">${repo.split('/')[0]} /</span> ${repo.split('/')[1]}</a>
    </h2>
    <p class="col-9 color-fg-muted my-1 tmp-pr-4">
      ${about}
    </p>
    <span class="d-inline-block float-sm-right">${today} stars today</span>
  </article>`;
  const html = `<div>${row('Nutlope/hallmark', 'Anti-AI-slop design skill for Claude Code &amp; friends', '1,317')}${row('a/b', '', '9')}</div>`;
  const got = readTrending(html);
  assert.deepEqual(got.map((c) => [c.title, c.url, c.signal, c.about]), [
    ['Nutlope/hallmark', 'https://github.com/Nutlope/hallmark', 1317, 'Anti-AI-slop design skill for Claude Code & friends'],
    ['a/b', 'https://github.com/a/b', 9, ''],
  ]);
});

test('Lobsters: tags say what a story is about; a text post links to its discussion', () => {
  const got = readLobsters([
    { title: 'POSIX wordexp(3) is dangerous', url: 'https://example.com/w', score: 55, tags: ['c', 'security'], comments_url: 'https://lobste.rs/s/abc' },
    { title: 'Ask: editors?', url: '', score: 5, tags: [], comments_url: 'https://lobste.rs/s/def' },
  ]);
  assert.deepEqual(got.map((c) => [c.url, c.about, c.discuss]), [['https://example.com/w', 'c, security', 'https://lobste.rs/s/abc'], ['https://lobste.rs/s/def', '', 'https://lobste.rs/s/def']]);
});

test('each story keeps when it went up: Hacker News in seconds, Lobsters as a date; Trending has none', () => {
  assert.equal(readHn([{ id: 1, type: 'story', title: 'A', url: 'https://a', time: 1793000000 }])[0].posted, 1793000000000);
  assert.equal(readLobsters([{ title: 'B', url: 'https://b', created_at: '2026-10-26T10:00:00.000-05:00' }])[0].posted, Date.parse('2026-10-26T15:00:00Z'));
  assert.equal(readLobsters([{ title: 'C', url: 'https://c' }])[0].posted, undefined);
});

test('only news since the last brief: older stories go, undated ones (Trending) stay', () => {
  const from = Date.parse('2026-10-27T05:30:00+08:00');
  const list = [
    { id: 'old', posted: from - 60000 },
    { id: 'edge', posted: from },
    { id: 'new', posted: from + 3600000 },
    { id: 'trending' },
  ];
  assert.deepEqual(postedSince(list, from).map((c) => c.id), ['edge', 'new', 'trending']);
});

test('each address once, and nothing from the last days again', () => {
  const a = { id: 'x', url: 'https://x' }, b = { id: 'y', url: 'https://y' }, c = { id: 'z', url: 'https://z' };
  assert.deepEqual(mergeCandidates([[a, b], [a, c]], new Set(['y'])).map((x) => x.id), ['x', 'z']);
});

test("a page's excerpt: its description, then real paragraphs, no scripts; a README without its markup", () => {
  const html = '<html><head><meta name="description" content="A tool that does X."><script>var no = 1;</script></head><body><nav><p>Home About Contact menu items here please</p></nav><p>short</p><p>This paragraph explains the thing in enough words to count as one.</p></body></html>';
  assert.equal(excerptOf(html), 'A tool that does X. This paragraph explains the thing in enough words to count as one.');
  assert.equal(excerptOf('# Hallmark\n\n![logo](x.png)\n\nA [design](https://x) skill.\n\n```sh\nnpm i\n```\n\n<p align="center"><img src="a.png"></p>', true), 'Hallmark A design skill.');
  assert.equal(excerptOf(`<p>${'word '.repeat(1000)}</p>`).length, EXCERPT);
});

const candidates = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({ id, source: i % 2 ? 'github' : 'hn', title: `Title ${id}`, url: `https://example.com/${id}`, discuss: '', signal: 10 * i, about: '', excerpt: '' }));
const pick = (id, over = {}) => ({ id, kind: 'dev', lead: false, title: `标题 ${id}`, line: '一句', desc: '说明', why: '为什么', ...over });

test("the answer is joined to its candidates: links and counts never come from the model", () => {
  const file = briefFile({ items: [pick('a', { lead: true, url: 'https://evil.example' }), pick('b'), pick('c'), pick('d'), pick('e')] }, candidates, '2026-10-26', '2026-10-26T07:04:00+08:00');
  assert.equal(file.items.length, 5);
  assert.equal(file.items[0].url, 'https://example.com/a');
  assert.equal(file.items[1].orig, 'Title b');
  assert.equal(file.items[1].signal, 10);
  assert.equal(file.model, 'claude-sonnet-5-5');
});

test('unknown ids and repeats are dropped; too few left means no file', () => {
  const file = briefFile({ items: [pick('a'), pick('a'), pick('nope'), pick('b'), pick('c'), pick('d'), pick('e')] }, candidates, '2026-10-26', '');
  assert.deepEqual(file.items.map((i) => i.id), ['a', 'b', 'c', 'd', 'e']);
  assert.throws(() => briefFile({ items: [pick('a'), pick('b')] }, candidates, '2026-10-26', ''), new RegExp(`need ${FEWEST}`));
  assert.throws(() => briefFile('not json', candidates, '2026-10-26', ''));
});

test("the message carries Jack's latest scores, newest first, and every candidate with its count", () => {
  const scores = Array.from({ length: 70 }, (_, i) => ({ title: `旧 ${i}`, kind: 'ai', score: (i % 5) + 1 }));
  const text = userMessage(candidates, scores, '2026-10-26');
  assert.match(text, /- 1\/5 \[ai\] 旧 0\n/);
  assert.ok(text.includes('旧 59'));
  assert.ok(!text.includes('旧 60'));
  assert.match(text, /<candidate id="b" source="GitHub Trending" count="10 stars today">/);
  assert.match(userMessage(candidates, [], '2026-10-26'), /has not scored any items yet/);
});
