import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tabularLayout } from '../src/lib/tabular.js';

// A font whose 1 is narrow and whose other digits differ, as in a proportional face.
const widths = { 0: 10, 1: 5, 2: 9, 3: 9, 4: 10, 5: 9, 6: 9, 7: 8, 8: 9, 9: 9, ',': 3, '+': 8, k: 7, '%': 12 };
const measure = (s) => [...s].reduce((sum, ch) => sum + (widths[ch] ?? 6), 0);

test('every digit takes the widest digit\'s width, so numbers of one length are one width', () => {
  assert.equal(tabularLayout('111', measure).width, 30);
  assert.equal(tabularLayout('808', measure).width, 30);
  assert.equal(tabularLayout('1,204', measure).width, tabularLayout('8,888', measure).width);
});

test('a digit sits in the middle of its slot, and what follows a changed digit stays put', () => {
  const a = tabularLayout('19%', measure).parts;
  const b = tabularLayout('29%', measure).parts;
  assert.deepEqual(a.map((p) => p.x), [5, 15, 26]);
  assert.deepEqual(a.map((p) => p.x), b.map((p) => p.x));
});

test('signs and letters keep their own width', () => {
  assert.equal(tabularLayout('+1k', measure).width, 8 + 10 + 7);
});
