import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectQueue, shuffled } from '../src/lib/lab/effect-queue.js';
import { EFFECTS } from '../src/lib/lab/tools.js';

const SLUGS = EFFECTS.map((e) => e.slug);
/** The same "random" numbers every run. */
const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('a shuffle keeps every item, once', () => {
  const out = shuffled(SLUGS, seeded(3));
  assert.deepEqual([...out].sort(), [...SLUGS].sort());
  assert.notDeepEqual(out, SLUGS, 'in a new order');
});

test('from an effect on show: all the others once each before it comes back', () => {
  const queue = effectQueue(SLUGS, 'dot-grid', seeded(7));
  const round = Array.from({ length: SLUGS.length - 1 }, () => queue.next());
  assert.equal(new Set(round).size, SLUGS.length - 1, 'no repeats in the round');
  assert.ok(!round.includes('dot-grid'), 'the one on show waits for the next round');
});

test('with none on show yet: the first round has them all', () => {
  const queue = effectQueue(SLUGS, null, seeded(11));
  assert.equal(new Set(Array.from({ length: SLUGS.length }, () => queue.next())).size, SLUGS.length);
});

test('over many presses: at least six others before any effect comes back, and all shown about as often', () => {
  for (const seed of [1, 2, 3, 42, 99, 1234]) {
    const queue = effectQueue(SLUGS, SLUGS[0], seeded(seed));
    const lastSeen = new Map([[SLUGS[0], -1]]);
    const counts = new Map();
    let closest = Infinity;
    for (let i = 0; i < SLUGS.length * 40; i++) {
      const slug = queue.next();
      if (lastSeen.has(slug)) closest = Math.min(closest, i - lastSeen.get(slug));
      lastSeen.set(slug, i);
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
    assert.ok(closest >= 7, `seed ${seed}: an effect came back after only ${closest - 1} others`);
    assert.equal(counts.size, SLUGS.length);
    // None is left out for long: each comes up at least 80% as often as an even share.
    assert.ok(Math.min(...counts.values()) >= 40 * 0.8, `seed ${seed}: ${[...counts.values()]}`);
  }
});

test('with only a few effects, it still takes turns', () => {
  const two = effectQueue(['a', 'b'], 'a', seeded(5));
  assert.deepEqual([two.next(), two.next(), two.next()], ['b', 'a', 'b']);
  const one = effectQueue(['a'], 'a', seeded(5));
  assert.equal(one.next(), 'a');
});
