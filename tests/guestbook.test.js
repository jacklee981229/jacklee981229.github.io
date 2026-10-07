import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrange, countLine, initialOf, lookOf, WALL } from '../src/lib/guestbook.js';

const note = (id, pinned = 0) => ({ id, name: `N${id}`, website: null, message: 'Hi', created_at: '2026-10-07T00:00:00Z', pinned, reply: null, reply_at: null });

test('the wall holds the pinned notes first, then the newest, up to nine; the list holds the rest, newest first', () => {
  const notes = Array.from({ length: 14 }, (_, i) => note(14 - i, [3, 12].includes(14 - i) ? 1 : 0));
  const { wall, list } = arrange(notes);
  assert.equal(wall.length, WALL);
  assert.deepEqual(wall.map((n) => n.id), [12, 3, 14, 13, 11, 10, 9, 8, 7]);
  assert.deepEqual(list.map((n) => n.id), [6, 5, 4, 2, 1]);
  // Fewer than a wall's worth: all on the wall, nothing in the list.
  assert.deepEqual(arrange([note(2), note(1)]), { wall: [note(2), note(1)], list: [] });
  assert.deepEqual(arrange([]), { wall: [], list: [] });
});

test("a note's colour and lean stay the same, and run through all six colours", () => {
  assert.deepEqual(lookOf(7), lookOf(7));
  assert.deepEqual(new Set([1, 2, 3, 4, 5, 6].map((id) => lookOf(id).colour)).size, 6);
  assert.ok([1, 2, 3, 4, 5, 6].every((id) => Math.abs(lookOf(id).tilt) <= 1.2));
});

test('the count and a name’s first character', () => {
  assert.equal(countLine(1), '1 note so far');
  assert.equal(countLine(12), '12 notes so far');
  assert.equal(initialOf(' mei '), 'M');
  assert.equal(initialOf('小明'), '小');
  assert.equal(initialOf('🐟 fan'), '🐟');
  assert.equal(initialOf('  '), '?');
});
