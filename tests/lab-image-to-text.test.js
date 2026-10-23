import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinRow, readingOrder, toText } from '../src/lib/lab/image-to-text.js';

/** A found box from its left, top, width and height. */
const box = (text, x, y, w = 100, h = 20) => ({ text, poly: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] });

test('boxes come back in reading order: rows top to bottom, each left to right', () => {
  const items = [box('world', 200, 10), box('second', 10, 50), box('Hello', 10, 12), box('line', 200, 52)];
  assert.deepEqual(readingOrder(items), [['Hello', 'world'], ['second', 'line']]);
});

test('a slightly tilted line stays one row; a line clearly below starts a new one', () => {
  assert.deepEqual(readingOrder([box('a', 0, 100), box('b', 120, 108), box('c', 0, 125)]), [['a', 'b'], ['c']]);
});

test('empty finds and boxes without a shape are left out', () => {
  assert.deepEqual(readingOrder([box('  ', 0, 0), { text: 'x', poly: [] }, box('ok', 0, 40)]), [['ok']]);
});

test('pieces of a row get a space, except between Chinese characters', () => {
  assert.equal(joinRow(['Mr.', 'Tan']), 'Mr. Tan');
  assert.equal(joinRow(['今天的', '待办']), '今天的待办');
  assert.equal(joinRow(['待办', 'To-do']), '待办 To-do');
  assert.equal(joinRow(['价格：', 'RM 38.50']), '价格： RM 38.50');
  assert.equal(joinRow([]), '');
});

test('the text to copy is one line a row', () => {
  assert.equal(toText([box('第二行', 0, 40), box('第一行', 0, 0), box('B', 200, 2)]), '第一行 B\n第二行');
  assert.equal(toText([]), '');
});
