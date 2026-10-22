import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FADE, fadeSizes } from '../src/lib/edge-fade.js';

test('an end that has been reached has no fade, so its line shows whole', () => {
  assert.deepEqual(fadeSizes(0, 300), [0, FADE]);
  assert.deepEqual(fadeSizes(300, 0), [FADE, 0]);
  assert.deepEqual(fadeSizes(0, 0), [0, 0]);
});

test('near an end the fade shrinks with what is left, and never passes its most', () => {
  assert.deepEqual(fadeSizes(10, 5), [10, 5]);
  assert.deepEqual(fadeSizes(1000, 1000), [FADE, FADE]);
});

test('a box scrolled to its end but a fraction of a pixel short (150% screens) has no fade there', () => {
  assert.deepEqual(fadeSizes(500, 0.666748046875), [FADE, 0]);
  assert.deepEqual(fadeSizes(1, 0), [1, 0]);
});

test('overscroll past an end (negative, as Safari bounces) counts as none', () => {
  assert.deepEqual(fadeSizes(-12, 40), [0, FADE]);
  assert.deepEqual(fadeSizes(40, -3.5), [FADE, 0]);
});
