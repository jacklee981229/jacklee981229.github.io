// Jack's to-dos as the Now editor checks a push from his laptop (workers/now/todos.js). Test to-dos only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOCK_SLACK_MS, LONGEST_NOTES, LONGEST_TEXT, MOST_TODOS, readTodos } from '../workers/now/todos.js';

const NOW = Date.UTC(2026, 10, 6, 4);
const id = (n) => n.toString(16).padStart(32, '0');
const good = {
  pushedAt: NOW - 1000,
  projects: ['alpha', 'General'],
  items: [
    { id: id(1), project: 'General', text: ' Test: water the plants ', notes: '' },
    { id: id(2), project: 'alpha', text: 'Test: 写测试', notes: 'Test note', on: '2026-11-07' },
  ],
};

test('a good push is kept in its order, its words trimmed', () => {
  const { list } = readTodos(good, NOW);
  assert.deepEqual(list.projects, ['alpha', 'General']);
  assert.deepEqual(list.items.map((i) => i.text), ['Test: water the plants', 'Test: 写测试']);
  assert.equal(list.pushedAt, good.pushedAt);
  // A to-do sent without a day, as from a laptop before days, gets none.
  assert.deepEqual(list.items.map((i) => i.on), ['', '2026-11-07']);
});

test('a day must be a real YYYY-MM-DD or nothing', () => {
  for (const on of ['2026-02-29', '20261107', '2026-W45-5', 'tomorrow', 5, null]) {
    assert.ok('error' in readTodos({ ...good, items: [good.items[0], { ...good.items[1], on }] }, NOW), String(on));
  }
  assert.equal(readTodos({ ...good, items: [good.items[0], { ...good.items[1], on: '' }] }, NOW).list.items[1].on, '');
});

test('an empty list is a good push: everything is done', () => {
  assert.deepEqual(readTodos({ pushedAt: NOW, projects: [], items: [] }, NOW).list.items, []);
});

test('long words are cut, not refused', () => {
  const long = { ...good, items: [{ ...good.items[0], text: 'x'.repeat(LONGEST_TEXT + 50), notes: 'y'.repeat(LONGEST_NOTES + 50) }], projects: ['General'] };
  const { list } = readTodos(long, NOW);
  assert.equal(list.items[0].text.length, LONGEST_TEXT);
  assert.equal(list.items[0].notes.length, LONGEST_NOTES);
});

test('a time that is not a time, or too far ahead of the clock, is refused', () => {
  for (const pushedAt of [0, -5, 1.5, '1', null, NOW + CLOCK_SLACK_MS + 1]) assert.ok('error' in readTodos({ ...good, pushedAt }, NOW), String(pushedAt));
  assert.ok('list' in readTodos({ ...good, pushedAt: NOW + CLOCK_SLACK_MS }, NOW));
});

test('a push that does not look like the list is refused', () => {
  const item = good.items[1];
  for (const over of [
    { items: 'no' },
    { projects: null },
    { projects: ['alpha', 'alpha', 'General'] },
    { projects: ['alpha', 'General', 'empty'] },
    { projects: ['alpha'] },
    { items: [...good.items, { ...item, id: 'abc' }] },
    { items: [...good.items, { ...item, text: '   ' }] },
    { items: [...good.items, { ...item, notes: 5 }] },
    { items: [...good.items, { ...item, project: '' }] },
  ]) {
    assert.ok('error' in readTodos({ ...good, ...over }, NOW), JSON.stringify(over));
  }
});

test('too many to-dos are refused; the most, all at full length in Chinese, stay under 1 MB', () => {
  const many = (count, text, notes) => Array.from({ length: count }, (_, n) => ({ id: id(n + 1), project: 'General', text, notes, on: '2026-11-07' }));
  assert.ok('error' in readTodos({ pushedAt: NOW, projects: ['General'], items: many(MOST_TODOS + 1, 'Test', '') }, NOW));
  const { list } = readTodos({ pushedAt: NOW, projects: ['General'], items: many(MOST_TODOS, '字'.repeat(LONGEST_TEXT), '字'.repeat(LONGEST_NOTES)) }, NOW);
  assert.ok(new TextEncoder().encode(JSON.stringify(list)).length < 1_000_000);
});
