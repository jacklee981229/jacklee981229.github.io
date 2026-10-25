import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawnCover } from '../src/lib/covers.js';

test('a drawn cover is the same for a post every time, different between posts, and stays in its bounds', () => {
  assert.deepEqual(drawnCover('7'), drawnCover('7'));
  const ids = ['1', '2', '3', '4', '5', '6', '7', 'c2', 'g1'];
  const covers = ids.map(drawnCover);
  assert.equal(new Set(covers.map((c) => `${c.x},${c.y},${c.turn}`)).size, ids.length);
  for (const c of covers) {
    assert.ok(c.angle >= 120 && c.angle <= 220 && c.x >= 52 && c.x <= 78 && c.y >= 34 && c.y <= 62);
    assert.ok(c.size >= 46 && c.size <= 72 && c.turn >= -24 && c.turn <= 24 && c.light >= 10 && c.light <= 90);
  }
});
