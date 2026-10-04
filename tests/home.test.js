import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayNumber, interleave, latestChanges, splitEmoji, todaysToy, writingPicks } from '../src/lib/home.js';

const toys = Array.from({ length: 17 }, (_, i) => `toy${i}`);
const day = (iso, hour = 12) => new Date(`${iso}T${String(hour).padStart(2, '0')}:00:00`);

test("today's toy stays the same all day", () => {
  assert.equal(todaysToy(toys, day('2026-10-05', 0)), todaysToy(toys, day('2026-10-05', 23)));
});

test("today's toy is never the same two days running, over two years", () => {
  let date = day('2026-01-01');
  for (let i = 0; i < 730; i++) {
    const next = new Date(date.getTime() + 86400000);
    assert.notEqual(todaysToy(toys, date), todaysToy(toys, next), date.toDateString());
    date = next;
  }
});

test("today's toy reaches every toy, whatever the list's length", () => {
  for (const n of [2, 3, 4, 6, 12, 17, 18]) {
    const list = Array.from({ length: n }, (_, i) => i);
    const seen = new Set(Array.from({ length: n }, (_, i) => todaysToy(list, new Date(Date.UTC(2026, 0, 1 + i)))));
    assert.equal(seen.size, n, `${n} toys`);
  }
  assert.equal(todaysToy([], new Date()), undefined);
  assert.equal(todaysToy(['only'], new Date()), 'only');
});

test('the day follows the visitor\'s calendar', () => {
  assert.equal(dayNumber(day('2026-10-05', 0)), dayNumber(day('2026-10-05', 23)));
  assert.equal(dayNumber(day('2026-10-06', 0)) - dayNumber(day('2026-10-05', 23)), 1);
});

test('the Collection tile takes from each collection in turn', () => {
  assert.deepEqual(interleave([['m1', 'm2', 'm3'], ['g1', 'g2']], 5), ['m1', 'g1', 'm2', 'g2', 'm3']);
  assert.deepEqual(interleave([['m1'], ['g1', 'g2', 'g3']], 5), ['m1', 'g1', 'g2', 'g3']);
  assert.deepEqual(interleave([[], []], 5), []);
});

test('Writing shows the Start here posts, else the newest off legacy topics', () => {
  const post = (id, topic, featured = false) => ({ id, data: { topic, featured } });
  const legacy = (topic) => topic === 'hexo';
  const posts = [post('h1', 'hexo'), post('f1', 'flutter'), post('g1', 'git', true), post('t1', 'games', true), post('c1', 'chatgpt')];
  assert.deepEqual(writingPicks(posts, legacy, 3).map((p) => p.id), ['g1', 't1']);
  const none = posts.map((p) => ({ ...p, data: { ...p.data, featured: false } }));
  assert.deepEqual(writingPicks(none, legacy, 3).map((p) => p.id), ['f1', 'g1', 't1']);
});

test('the four newest changes, under their days', () => {
  const changes = [{ day: '2026-10-05', text: 'a' }, { day: '2026-10-05', text: 'b' }, { day: '2026-10-04', text: 'c' }, { day: '2026-10-03', text: 'd' }, { day: '2026-10-03', text: 'e' }];
  assert.deepEqual(latestChanges(changes, 4).map((d) => [d.day, d.changes.map((c) => c.text)]), [['2026-10-05', ['a', 'b']], ['2026-10-04', ['c']], ['2026-10-03', ['d']]]);
});

test("a Now label's leading emoji is split from its words", () => {
  assert.deepEqual(splitEmoji('🎮 Playing'), { emoji: '🎮', text: 'Playing' });
  assert.deepEqual(splitEmoji('💻 Building'), { emoji: '💻', text: 'Building' });
  assert.deepEqual(splitEmoji('❤️ Loving'), { emoji: '❤️', text: 'Loving' });
  assert.deepEqual(splitEmoji('👩‍💻 Coding'), { emoji: '👩‍💻', text: 'Coding' });
  assert.deepEqual(splitEmoji('Reading'), { text: 'Reading' });
  assert.deepEqual(splitEmoji(''), { text: '' });
});
