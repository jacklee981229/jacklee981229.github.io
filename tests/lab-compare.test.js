import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareTexts, summaryOf, withContext } from '../src/lib/lab/compare.js';

/** A row as text: + or - or a space, then the line with its changed pieces in [brackets]. */
const show = (rows) => rows.map((r) => (r.kind === 'gap' ? `~${r.count}` : `${{ same: ' ', add: '+', remove: '-' }[r.kind]}${r.parts.map((p) => (p.marked ? `[${p.text}]` : p.text)).join('')}`));

test('the same text twice has no differences', () => {
  const result = compareTexts('one\ntwo\n', 'one\ntwo\n');
  assert.deepEqual([result.added, result.removed], [0, 0]);
  assert.deepEqual(show(result.rows), [' one', ' two']);
});

test('a changed word is marked in the line taken out and in the one put in', () => {
  const result = compareTexts('the old line\nkept', 'the new line\nkept');
  assert.deepEqual(show(result.rows), ['-the [old] line', '+the [new] line', ' kept']);
  assert.deepEqual([result.added, result.removed], [1, 1]);
});

test('Chinese is compared character by character', () => {
  assert.deepEqual(show(compareTexts('我喜欢猫', '我喜欢狗').rows), ['-我喜欢[猫]', '+我喜欢[狗]']);
});

test('lines added or taken out with no counterpart are whole lines, with their numbers', () => {
  const result = compareTexts('a\nb\nc', 'a\nc\nd\ne');
  assert.deepEqual(show(result.rows), [' a', '-b', ' c', '+d', '+e']);
  const numbers = result.rows.map((r) => [r.before ?? null, r.after ?? null]);
  assert.deepEqual(numbers, [[1, 1], [2, null], [3, 2], [null, 3], [null, 4]]);
  assert.deepEqual([result.added, result.removed], [2, 1]);
});

test('Windows line breaks and a missing last line break make no difference', () => {
  assert.deepEqual(compareTexts('one\r\ntwo\r\n', 'one\ntwo').rows.map((r) => r.kind), ['same', 'same']);
});

test('more lines changed than put back: pairs first, then the rest whole', () => {
  assert.deepEqual(show(compareTexts('x1\nx2\nx3', 'y1').rows), ['-[x1]', '-x2', '-x3', '+[y1]']);
});

test('long runs of unchanged lines fold away, keeping two each side of a change', () => {
  const before = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join('\n');
  const after = before.replace('line 6', 'line six');
  assert.deepEqual(show(withContext(compareTexts(before, after).rows)), ['~3', ' line 4', ' line 5', '-line [6]', '+line [six]', ' line 7', ' line 8', '~4']);
  // A short run between two changes stays whole.
  assert.deepEqual(show(withContext(compareTexts('a\nb\nc\nd', 'A\nb\nc\nD').rows)), ['-[a]', '+[A]', ' b', ' c', '-[d]', '+[D]']);
});

test('two long, utterly different texts give up in time instead of holding the page up', () => {
  const lines = (tag) => Array.from({ length: 20000 }, (_, i) => `${tag} ${i} ${(i * 7919) % 104729}`).join('\n');
  const started = Date.now();
  const result = compareTexts(lines('a'), lines('b'));
  assert.ok(Date.now() - started < 4000, `took ${Date.now() - started} ms`);
  assert.ok(result.slow || result.rows.length > 0);
});

test('the summary counts lines in plain words', () => {
  assert.equal(summaryOf({ added: 0, removed: 0 }), 'No differences.');
  assert.equal(summaryOf({ added: 1, removed: 0 }), '1 line added.');
  assert.equal(summaryOf({ added: 0, removed: 3 }), '3 lines removed.');
  assert.equal(summaryOf({ added: 2, removed: 1 }), '2 lines added, 1 removed.');
  assert.equal(summaryOf({ added: 1200, removed: 5 }), '1,200 lines added, 5 removed.');
});
