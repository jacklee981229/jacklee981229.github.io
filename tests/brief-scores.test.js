// Jack's Morning Brief scores as the Now editor checks them (workers/now/scores.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readScore } from '../workers/now/scores.js';

const good = { id: 'a1b2c3d4', day: '2026-10-26', title: '  IBM 总裁：开放权重模型  ', kind: 'ai', source: 'hn', score: 4 };

test('a good score is kept, its title tidied', () => {
  assert.deepEqual(readScore(good), { score: { ...good, title: 'IBM 总裁：开放权重模型' } });
});

test('0 takes a score back; anything outside 0 to 5, or not whole, is refused', () => {
  assert.equal(readScore({ ...good, score: 0 }).score.score, 0);
  for (const score of [6, -1, 2.5, '5', null]) assert.ok('error' in readScore({ ...good, score }), String(score));
});

test('an item that does not look like a brief item is refused', () => {
  for (const over of [{ id: 'xyz' }, { day: '26 Oct' }, { title: '' }, { kind: 'politics' }, { source: 'reddit' }]) {
    assert.ok('error' in readScore({ ...good, ...over }), JSON.stringify(over));
  }
  assert.ok('error' in readScore(null));
});

test('a very long title is cut, not refused', () => {
  assert.equal(readScore({ ...good, title: '长'.repeat(500) }).score.title.length, 200);
});
