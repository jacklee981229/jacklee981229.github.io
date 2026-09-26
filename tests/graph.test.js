import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breakLabel, laneSpans, timelineRows } from '../src/lib/graph.js';

const topics = [{ id: 'hexo' }, { id: 'git' }, { id: 'games' }];
const post = (id, date, topic) => ({ id, data: { title: id, date: new Date(date), topic, tags: [] } });

// Newest first, like the home page.
const list = [
  post('a', '2023-10-16T11:46:00+08:00', 'games'),
  post('b', '2023-10-04T23:47:00+08:00', 'hexo'),
  post('c', '2023-10-04T19:26:20+08:00', 'games'),
  post('d', '2023-03-25T12:21:17+08:00', 'hexo'),
  post('e', '2022-12-30T10:00:00+08:00', 'git'),
];

test('each lane spans from its newest post to its oldest', () => {
  assert.deepEqual(laneSpans(list, topics), { hexo: { newest: 1, oldest: 3 }, git: { newest: 4, oldest: 4 }, games: { newest: 0, oldest: 2 } });
});

test('break labels use months under two years, then years', () => {
  assert.equal(breakLabel(193), '6-month break');
  assert.equal(breakLabel(60), '2-month break');
  assert.equal(breakLabel(1076), '3-year break');
});

test('rows: year first, month on the first post of each month, breaks for long gaps', () => {
  const rows = timelineRows(list, topics, 0, list.length);
  assert.deepEqual(rows.map((r) => (r.kind === 'post' ? `post:${list[r.index].id}:${r.month ?? ''}` : r.kind === 'year' ? `year:${r.year}` : `break:${r.label}`)), [
    'year:2023', 'post:a:Oct', 'post:b:', 'post:c:', 'break:6-month break', 'post:d:Mar', 'break:3-month break', 'year:2022', 'post:e:Dec',
  ]);
});

test('lanes run through the rows between a topic\'s posts, and only there', () => {
  const rows = timelineRows(list, topics, 0, list.length);
  const postRow = (id) => rows.find((r) => r.kind === 'post' && list[r.index].id === id);
  // Post a is the newest games post: its lane starts there and continues down.
  assert.deepEqual(postRow('a').lanes, [{ x: 2, topic: 'games', top: false, bottom: true, node: true }]);
  // Post b: the hexo lane starts here while the games lane passes by.
  assert.deepEqual(postRow('b').lanes, [
    { x: 0, topic: 'hexo', top: false, bottom: true, node: true },
    { x: 2, topic: 'games', top: true, bottom: true, node: false },
  ]);
  // The 6-month break between c and d only carries the hexo lane (games ended at c).
  assert.deepEqual(rows.find((r) => r.kind === 'break').lanes, [{ x: 0, topic: 'hexo' }]);
  // Post e is a lone git post: a node with no lane above or below.
  assert.deepEqual(postRow('e').lanes, [{ x: 1, topic: 'git', top: false, bottom: false, node: true }]);
});

test('a page in the middle still draws lanes that continue off the page', () => {
  const rows = timelineRows(list, topics, 1, 3);
  const last = rows.filter((r) => r.kind === 'post').at(-1);
  assert.equal(list[last.index].id, 'c');
  assert.ok(last.lanes.some((l) => l.topic === 'hexo' && l.top && l.bottom), 'the hexo lane passes c on its way to d on the next page');
  assert.equal(rows[0].kind, 'year', 'every page starts with its year');
});
