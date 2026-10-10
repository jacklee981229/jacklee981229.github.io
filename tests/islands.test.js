import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { GRID, islandsOf, measure, partsOf, PARTS, scanBlocks, stampMaps } from '../src/lib/islands.js';
import { listed } from '../src/lib/posts.js';
import { TOPICS } from '../src/lib/topics.js';

const POSTS = new URL('../src/content/posts/', import.meta.url);

/** A post's Markdown without its front matter, and the fields islands-file.js takes from Astro. */
const read = (id) => {
  const text = readFileSync(new URL(`${id}/index.md`, POSTS), 'utf8').replace(/\r\n?/g, '\n');
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
  const field = (name) => new RegExp(`^${name}: (.*)$`, 'm').exec(front?.[1] ?? '')?.[1]?.trim().replace(/^"|"$/g, '');
  return {
    id,
    data: { title: field('title') ?? id, date: new Date(field('date') ?? 0), topic: field('topic') ?? '', tags: [], featured: field('featured') === 'true', hidden: field('hidden') === 'true', draft: field('draft') === 'true' },
    body: text.slice(front ? front[0].length : 0),
  };
};
const all = readdirSync(POSTS).filter((id) => existsSync(new URL(`${id}/index.md`, POSTS))).map(read);
const posts = listed(all).map((p) => ({ id: p.id, title: p.data.title, date: p.data.date, topic: p.data.topic, featured: p.data.featured, body: p.body, url: `/${p.id}/` }));
const counted = (id) => measure(scanBlocks(read(id).body));
/** Runs the maps' work to the end, as the page does a little each frame. */
const mapsOf = (data) => {
  const work = stampMaps(data);
  let step = work.next();
  while (!step.done) step = work.next();
  return step.value;
};

test("each post's parts are counted as they are written", () => {
  const seven = counted('7');
  assert.equal(seven.codeBlocks, 19);
  assert.equal(seven.codeLines, 2354);
  assert.equal(seven.headings, 19);
  assert.equal(seven.paragraphs, 16);
  const ten = counted('10');
  assert.equal(ten.paragraphs, 25);
  assert.equal(ten.pictures, 4);
  const eleven = counted('11');
  assert.equal(eleven.pictures, 7);
  assert.equal(eleven.items, 17);
  const one = counted('1');
  assert.equal(one.headings, 10);
  assert.equal(one.items, 19);
  assert.deepEqual(scanBlocks(read('3').body), [{ type: 'code', lines: 110 }]);
});

test('reading Markdown: fences of either kind, HTML headings, lists over blank lines, pictures inside text', () => {
  const blocks = scanBlocks([
    '<h1>Admin</h1>',
    '',
    'Some words here, with a [link](https://example.com) in them.',
    '',
    '- one',
    '',
    '- two',
    '1. three',
    '',
    '~~~',
    'a',
    '```',
    'b',
    '~~~',
    'Words ![pic](a.png) and more words.',
    '<img src="b.png">',
    '```js',
    'never closed',
  ].join('\n'));
  assert.deepEqual(blocks, [
    { type: 'heading', level: 1, words: 1 },
    { type: 'paragraph', words: 8 },
    { type: 'list', items: 3, words: 3 },
    { type: 'code', lines: 3 },
    { type: 'paragraph', words: 4 },
    { type: 'picture' },
    { type: 'picture' },
    { type: 'code', lines: 1 },
  ]);
});

test('a post is shaped into a few large parts: one long code block makes one butte, each picture a hollow', () => {
  const three = partsOf(scanBlocks(read('3').body));
  assert.deepEqual(three.parts.map((p) => p.type), ['code']);
  assert.deepEqual(three.pictures, []);
  const seven = partsOf(scanBlocks(read('7').body));
  assert.ok(seven.parts.length > 1 && seven.parts.every((p) => p.type === 'code'), 'post 7 is a range of buttes');
  const ten = partsOf(scanBlocks(read('10').body));
  assert.ok(ten.parts.every((p) => p.type === 'paragraph'), 'post 10 is soft hills');
  assert.equal(ten.pictures.length, 4);
  assert.equal(partsOf(scanBlocks(read('11').body)).pictures.length, 7);
  for (const post of posts) assert.ok(partsOf(scanBlocks(post.body)).parts.length <= PARTS, post.id);
});

const today = '2026-10-10';
const data = islandsOf({ posts, topics: TOPICS, visits: null, today });

test('the islands come out the same every time from the same posts', () => {
  assert.equal(JSON.stringify(islandsOf({ posts, topics: TOPICS, visits: null, today })), JSON.stringify(data));
  assert.equal(JSON.stringify(islandsOf({ posts: [...posts].reverse(), topics: TOPICS, visits: null, today })), JSON.stringify(data));
});

test('one island for each topic with posts, one ridge for each post, the legacy island farthest back', () => {
  const topics = new Set(posts.map((p) => p.topic));
  assert.equal(data.islands.length, topics.size);
  assert.equal(data.ridges.length, posts.length);
  assert.equal(data.counts.posts, posts.length);
  // Today: 14 posts on 5 islands, 8 of them on the legacy topic's island.
  assert.ok(posts.length >= 14 && topics.size >= 5);
  const legacy = data.islands.filter((i) => i.legacy);
  assert.ok(legacy.length >= 1);
  for (const old of legacy) for (const island of data.islands.filter((i) => !i.legacy)) assert.ok(old.z < island.z, `${old.topic} is behind ${island.topic}`);
  assert.equal(data.ridges.filter((r) => r.featured).length, posts.filter((p) => p.featured).length);
});

test('the replay runs from the first post to the day of the build, each ridge rising on its own day', () => {
  assert.equal(data.from, '2023-03-02');
  assert.equal(data.to, today);
  assert.equal(data.days, 1318);
  for (const ridge of data.ridges) {
    const post = posts.find((p) => p.id === ridge.id);
    assert.ok(Math.abs(ridge.day - (post.date.getTime() - Date.parse('2023-03-02T00:00:00+08:00')) / 86400000) < 0.001, ridge.id);
    assert.ok(data.islands[ridge.island].rise <= ridge.day, `${ridge.id}'s island is up before it`);
  }
});

test('visits make forest: none known gives every post the same; known, the most read is greenest', () => {
  assert.ok(data.ridges.every((r) => r.green === -1));
  assert.equal(data.visits, false);
  const visits = new Map(posts.map((p, i) => [p.url, i === 0 ? 9 : i === 1 ? 1 : 0]));
  const read = islandsOf({ posts, topics: TOPICS, visits, today });
  const green = (id) => read.ridges.find((r) => r.id === id).green;
  assert.equal(green(posts[0].id), 1);
  assert.ok(Math.abs(green(posts[1].id) - Math.log(2) / Math.log(10)) < 0.001);
  assert.equal(green(posts[2].id), 0);
  assert.equal(read.counts.read, 2);
  // Nobody has read anything yet: all bare, not an error.
  const none = islandsOf({ posts, topics: TOPICS, visits: new Map(), today });
  assert.ok(none.ridges.every((r) => r.green === 0));
});

/** Every point along a ridge, with how far out its coast reaches. */
const outline = (d) => d.ridges.flatMap((r) => Array.from({ length: 21 }, (_, k) => {
  const t = k / 20;
  const a = (1 - t) ** 2;
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return { island: r.island, x: a * r.curve[0] + b * r.curve[2] + c * r.curve[4], z: a * r.curve[1] + b * r.curve[3] + c * r.curve[5], reach: r.width };
}));

test('every ridge is long enough for its parts, and the islands keep apart and inside the land', () => {
  for (const ridge of data.ridges) {
    const length = Math.hypot(ridge.curve[4] - ridge.curve[0], ridge.curve[5] - ridge.curve[1]) * GRID;
    assert.ok(length >= 43 && length <= 81, `${ridge.id}: ${length.toFixed(1)} cells`);
    for (const [type, , , , , steps] of ridge.parts) if (type === 'list') assert.ok(steps >= 2 && steps <= 3, `${ridge.id}: ${steps} terraces`);
  }
  const points = outline(data);
  for (const p of points) assert.ok(p.x - p.reach > 0.04 && p.x + p.reach < 0.96 && p.z - p.reach > 0.04 && p.z + p.reach < 0.96, `ridge of island ${p.island} near the edge`);
  for (const p of points) for (const q of points) {
    if (p.island >= q.island) continue;
    assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > p.reach + q.reach + 0.03, `islands ${p.island} and ${q.island} touch`);
  }
});

test('many more posts still make islands inside the land', () => {
  const more = Array.from({ length: 60 }, (_, i) => ({ ...posts[i % posts.length], id: `p${i}`, url: `/p${i}/`, topic: TOPICS[i % TOPICS.length].id, date: new Date(Date.UTC(2023, 2, 2 + i * 20)) }));
  const many = islandsOf({ posts: more, topics: TOPICS, visits: null, today });
  assert.equal(many.ridges.length, 60);
  for (const p of outline(many)) assert.ok(p.x > 0 && p.x < 1 && p.z > 0 && p.z < 1);
});

test('the land rises from its maps: each picture a closed hollow above the sea, code harder than prose', () => {
  const maps = mapsOf(data);
  const N = data.grid;
  const height = (c) => maps.seaFloor + maps.lift[c * 4] + maps.lift[c * 4 + 1] + maps.lift[c * 4 + 2];
  // Each lake: its cells, its lowest one, and how deep it fills before it spills (a flood from its lowest cell).
  const seen = new Uint8Array(N * N);
  const lakes = [];
  for (let c0 = 0; c0 < N * N; c0++) {
    if (seen[c0] || maps.ground[c0 * 4 + 2] < 128) continue;
    const cells = [c0];
    seen[c0] = 1;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      for (const n of [c - 1, c + 1, c - N, c + N]) if (!seen[n] && maps.ground[n * 4 + 2] >= 128) { seen[n] = 1; cells.push(n); }
    }
    const low = cells.reduce((a, c) => (height(c) < height(a) ? c : a), cells[0]);
    const done = new Uint8Array(N * N);
    let front = [low];
    done[low] = 1;
    let level = height(low);
    let spill = Infinity;
    for (let round = 0; round < 4000 && front.length; round++) {
      front.sort((a, b) => height(b) - height(a));
      const c = front.pop();
      if (height(c) < level - 1e-9) { spill = level; break; }
      level = Math.max(level, height(c));
      for (const n of [c - 1, c + 1, c - N, c + N]) if (!done[n]) { done[n] = 1; front.push(n); }
    }
    lakes.push({ post: maps.ground[low * 4 + 1] - 1, depth: spill - height(low), floor: height(low) });
  }
  const pictures = data.ridges.reduce((n, r) => n + r.hollows.length, 0);
  assert.equal(lakes.length, pictures);
  for (const lake of lakes) {
    assert.ok(lake.depth > 0.008, `${data.ridges[lake.post]?.id}'s lake holds ${lake.depth.toFixed(4)}`);
    assert.ok(lake.floor > 0, `${data.ridges[lake.post]?.id}'s lake is above the sea`);
  }
  const ten = data.ridges.findIndex((r) => r.id === '10');
  assert.equal(lakes.filter((l) => l.post === ten).length, 4, "post 10's four lakes");
  // Code's rock is harder than prose's, so the rain leaves it standing.
  const hardness = (id) => {
    const post = data.ridges.findIndex((r) => r.id === id);
    let sum = 0;
    let n = 0;
    for (let c = 0; c < N * N; c++) if (maps.ground[c * 4 + 1] - 1 === post && maps.lift[c * 4 + 2] > 0.02) { sum += maps.ground[c * 4]; n++; }
    return sum / n / 255;
  };
  assert.ok(hardness('7') > 0.7 && hardness('10') < 0.35, `post 7 ${hardness('7').toFixed(2)}, post 10 ${hardness('10').toFixed(2)}`);
});
