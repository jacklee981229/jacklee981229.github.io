import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkThese, homePageUrl, lastUpdated, listed, neighbours, paginate, pinned, published, recent, related, tagCounts, topicCounts } from '../src/lib/posts.js';

const post = (id, date, extra = {}) => ({ id, data: { title: id, date: new Date(date), topic: 'hexo', tags: [], ...extra } });

const posts = [
  post('old', '2023-03-02T09:00:00+08:00', { tags: ['hexo', 'next'] }),
  post('draft', '2023-11-01T09:00:00+08:00', { draft: true, tags: ['secret'] }),
  post('game', '2023-03-02T22:00:00+08:00', { hidden: true, topic: 'games', tags: ['game'] }),
  post('new', '2023-10-16T11:46:00+08:00', { topic: 'flutter', tags: ['flutter'] }),
  post('mid', '2023-10-04T23:47:00+08:00', { tags: ['hexo'], pinned: true }),
];

test('published sorts newest first and leaves drafts out unless asked', () => {
  assert.deepEqual(published(posts).map((p) => p.id), ['new', 'mid', 'game', 'old']);
  assert.deepEqual(published(posts, { includeDrafts: true }).map((p) => p.id), ['draft', 'new', 'mid', 'game', 'old']);
});

test('listed also leaves hidden posts out', () => {
  assert.deepEqual(listed(posts).map((p) => p.id), ['new', 'mid', 'old']);
  assert.deepEqual(listed(posts, { includeDrafts: true }).map((p) => p.id), ['draft', 'new', 'mid', 'old']);
});

test('posts at the same moment keep a stable order', () => {
  const same = [post('b', '2023-01-01T00:00:00Z'), post('a', '2023-01-01T00:00:00Z')];
  assert.deepEqual(published(same).map((p) => p.id), ['a', 'b']);
});

test('pinned picks only pinned posts', () => {
  assert.deepEqual(pinned(listed(posts)).map((p) => p.id), ['mid']);
});

test('paginate splits 14 posts into pages of 10 and 4', () => {
  const pages = paginate(Array.from({ length: 14 }, (_, i) => i), 10);
  assert.equal(pages.length, 2);
  assert.deepEqual(pages.map((p) => [p.page, p.pages, p.start, p.items.length]), [[1, 2, 0, 10], [2, 2, 10, 4]]);
  assert.deepEqual(paginate([], 10), [{ page: 1, pages: 1, start: 0, items: [] }]);
});

test('home pages keep the old Hexo addresses', () => {
  assert.equal(homePageUrl(1), '/');
  assert.equal(homePageUrl(2), '/page/2/');
});

test('neighbours are the next newer and older listed posts', () => {
  const list = listed(posts);
  assert.deepEqual(Object.values(neighbours(list, list[1])).map((p) => p?.id), ['new', 'old']);
  assert.deepEqual(Object.values(neighbours(list, list[0])).map((p) => p?.id), [undefined, 'mid']);
  const hiddenPost = posts.find((p) => p.id === 'game');
  assert.deepEqual(neighbours(list, hiddenPost), { newer: null, older: null });
});

test('related means same topic, never the post itself, at most 3', () => {
  const list = listed(posts);
  assert.deepEqual(related(list, list[1]).map((p) => p.id), ['old']);
  assert.deepEqual(related(list, list[0]).map((p) => p.id), []);
  const many = Array.from({ length: 6 }, (_, i) => post(`p${i}`, `2023-01-0${i + 1}T00:00:00Z`));
  assert.equal(related(many, many[0]).length, 3);
});

test('recent skips the current post', () => {
  const list = listed(posts);
  assert.deepEqual(recent(list, list[0]).map((p) => p.id), ['mid', 'old']);
});

test('"check these too" puts the same topic first, then the newest, each once, at most 4', () => {
  const list = [
    post('a', '2023-06-01T00:00:00Z', { topic: 'games' }),
    post('b', '2023-05-01T00:00:00Z', { topic: 'flutter' }),
    post('c', '2023-04-01T00:00:00Z', { topic: 'games' }),
    post('d', '2023-03-01T00:00:00Z', { topic: 'hexo' }),
    post('e', '2023-02-01T00:00:00Z', { topic: 'games' }),
    post('f', '2023-01-01T00:00:00Z', { topic: 'hexo' }),
  ];
  assert.deepEqual(checkThese(list, list[2]).map((p) => p.id), ['a', 'e', 'b', 'd']);
  assert.deepEqual(checkThese(list, list[5]).map((p) => p.id), ['d', 'a', 'b', 'c']);
  assert.deepEqual(checkThese(list.slice(0, 2), list[0]).map((p) => p.id), ['b']);
});

test('tag and topic counts only count listed posts', () => {
  const list = listed(posts);
  assert.deepEqual(tagCounts(list), [{ tag: 'flutter', count: 1 }, { tag: 'hexo', count: 2 }, { tag: 'next', count: 1 }]);
  assert.deepEqual(topicCounts(list, [{ id: 'hexo' }, { id: 'games' }, { id: 'flutter' }]).map((t) => t.count), [2, 0, 1]);
});

test('lastUpdated takes the latest publish or update date', () => {
  const list = listed(posts);
  assert.equal(lastUpdated(list)?.toISOString(), new Date('2023-10-16T11:46:00+08:00').toISOString());
  const updatedLater = [post('x', '2023-01-01T00:00:00Z', { updated: new Date('2024-05-01T00:00:00Z') })];
  assert.equal(lastUpdated(updatedLater)?.toISOString(), '2024-05-01T00:00:00.000Z');
  assert.equal(lastUpdated([]), undefined);
});
