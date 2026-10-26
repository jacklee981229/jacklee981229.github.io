import { test } from 'node:test';
import assert from 'node:assert/strict';
import { msOf } from '../src/lib/motion.js';

test('a CSS time is read with its unit, as written or as the minifier rewrites it', () => {
  assert.equal(msOf('800ms'), 800);
  assert.equal(msOf('.8s'), 800);
  assert.equal(msOf(' 0.32s'), 320);
  assert.equal(msOf('90ms'), 90);
  assert.equal(msOf('1.2s'), 1200);
});

test('no time, or a value without a unit, is the fallback', () => {
  assert.equal(msOf('', 800), 800);
  assert.equal(msOf('0.8', 800), 800);
  assert.equal(msOf('soon'), 0);
});
