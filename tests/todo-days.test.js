// The days on Jack's to-dos (src/lib/todo-days.js). Test to-dos only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayWords, dueFirst, isDay, lateWords, malaysiaToday, todoGroups } from '../src/lib/todo-days.js';

test('a day is a real YYYY-MM-DD', () => {
  for (const day of ['2026-11-06', '2028-02-29', '2026-12-31']) assert.ok(isDay(day), day);
  // The same cases as the laptop's test (todo-widget tests/test_todos.py), so it never sends a day refused here.
  for (const bad of ['2026-02-29', '2026-13-01', '2026-11-31', '20261106', '2026-W45-5', '2026-11-6', ' 2026-11-06', '2026-11-06T00:00', '', null, 20261106]) {
    assert.equal(isDay(bad), false, String(bad));
  }
});

test("today is Malaysia's day, whatever the browser's time zone", () => {
  // 23:30 in London on 5 Nov is 07:30 on 6 Nov in Kuala Lumpur.
  assert.equal(malaysiaToday(new Date(Date.UTC(2026, 10, 5, 23, 30))), '2026-11-06');
  assert.equal(malaysiaToday(new Date(Date.UTC(2026, 10, 5, 15, 59))), '2026-11-05');
  assert.equal(malaysiaToday(new Date(Date.UTC(2026, 10, 5, 16, 0))), '2026-11-06');
});

const todo = (text, project, on = '') => ({ id: text, project, text, notes: '', on });
const items = [
  todo('Test: port', 'lan-drop'),
  todo('Test: trip', 'jacks-space', '2026-11-05'),
  todo('Test: clips', 'media', '2026-11-06'),
  todo('Test: font', 'jacks-space', '2026-11-20'),
  todo('Test: errand', 'General', '2026-11-04'),
  todo('Test: also today', 'lan-drop', '2026-11-06'),
];

test('due to-dos come first, the earliest day first, ties in the order added', () => {
  assert.deepEqual(dueFirst(items, '2026-11-06').map((i) => i.text), ['Test: errand', 'Test: trip', 'Test: clips', 'Test: also today']);
  assert.deepEqual(dueFirst(items, '2026-11-03'), []);
  // A list pushed before days has none due.
  assert.deepEqual(dueFirst([{ project: 'General', text: 'Test' }], '2026-11-06'), []);
});

test("/todo's groups: Today first, then the projects without their due to-dos", () => {
  const groups = todoGroups(['jacks-space', 'lan-drop', 'media', 'General'], items, '2026-11-06');
  assert.deepEqual(groups.map((g) => [g.name, g.items.map((i) => i.text)]), [
    ['Today', ['Test: errand', 'Test: trip', 'Test: clips', 'Test: also today']],
    ['jacks-space', ['Test: font']],
    ['lan-drop', ['Test: port']],
  ]);
  assert.deepEqual(groups.map((g) => g.today), [true, false, false]);
  // On the 20th the font's day comes; nothing is left outside Today but the port.
  assert.deepEqual(todoGroups(['jacks-space', 'lan-drop', 'media', 'General'], items, '2026-11-20').map((g) => g.name), ['Today', 'lan-drop']);
  assert.deepEqual(todoGroups([], [], '2026-11-06'), []);
});

test("a day in the widget's words, and late ones in /brief/'s", () => {
  const today = '2026-11-06';
  assert.deepEqual(
    ['2026-11-06', '2026-11-05', '2026-11-03', '2026-11-07', '2026-11-09', '2027-01-01'].map((on) => dayWords(on, today)),
    [
      { text: 'Today', kind: 'today' },
      { text: 'Yesterday', kind: 'late' },
      { text: '3 days ago', kind: 'late' },
      { text: 'Tomorrow', kind: 'later' },
      { text: 'Mon 9 Nov', kind: 'later' },
      { text: 'Fri 1 Jan', kind: 'later' },
    ],
  );
  assert.deepEqual(['2026-11-06', '2026-11-05', '2026-10-30'].map((on) => lateWords(on, today)), ['', '昨天', '7 天前']);
  // Across the turn of a month and a year.
  assert.equal(dayWords('2026-12-31', '2027-01-01').text, 'Yesterday');
});
