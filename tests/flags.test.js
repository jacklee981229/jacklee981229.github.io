import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLAGS, FLAG_IDS, starPoints } from '../src/lib/flags.js';

test("China's flag: a red ground, one big star and four small ones, each small one pointing at the big one", () => {
  const china = FLAGS.china;
  assert.deepEqual([china.width, china.height, china.stars.length], [30, 20, 5]);
  assert.deepEqual(FLAG_IDS, ['china']);
  // A star's first point is the one aimed: the big star's straight up, a small one's towards (5, 5).
  assert.equal(starPoints(5, 5, 3, -Math.PI / 2).split(' ')[0], '5.000,2.000');
  const [x, y] = china.stars[1].points.split(' ')[0].split(',').map(Number);
  assert.ok(x < 10 && y > 2, 'the first small star (10, 2) points down-left, at the big star');
});
