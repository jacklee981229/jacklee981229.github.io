import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KINDS, byDay, byYear, isDay, readChangelog } from '../src/lib/changelog.js';

test('changes come out newest first, a day keeping its order in the file', () => {
  const changes = readChangelog('<!-- note -->\n- 2026-09-26 new: Rebuilt\n- 2026-10-02 new: First that day\n- 2023-02-23 new: Started\n- 2026-10-02 fix: Second that day');
  assert.deepEqual(changes.map((c) => c.text), ['First that day', 'Second that day', 'Rebuilt', 'Started']);
});

test('each change has its kind; the text may hold colons and links', () => {
  assert.deepEqual(readChangelog('- 2026-10-02 design: Added Effects: toys [here](/lab/)'), [{ day: '2026-10-02', kind: 'design', text: 'Added Effects: toys [here](/lab/)' }]);
  assert.deepEqual(Object.keys(KINDS), ['new', 'improved', 'design', 'fix']);
});

test('a bad date, a missing or unknown kind, or no text stops the build, naming the line', () => {
  for (const line of ['- 26-09-2026 new: Wrong way round', '- 2026-02-30 new: No such day', '- 2026-9-26 new: Short month', '- 2026-09-26: No kind', '- 2026-09-26 tweak: Unknown kind', '- 2026-09-26 toString: Not a kind', '- 2026-09-26 new fix: Two kinds', '- Just text', '- 2026-09-26 new:']) {
    assert.throws(() => readChangelog(`- 2026-09-26 new: Fine\n${line}`), (e) => e.message.includes('line 2') && e.message.includes(line.slice(2)), line);
  }
});

test('an empty file is no changes', () => {
  assert.deepEqual(readChangelog(''), []);
  assert.deepEqual(readChangelog('<!-- only a comment -->'), []);
});

test('real days only', () => {
  assert.equal(isDay('2024-02-29'), true);
  assert.equal(isDay('2026-02-29'), false);
  assert.equal(isDay('2026-13-01'), false);
  assert.equal(isDay('2026-1-01'), false);
});

test('grouped by day, and by year then day, newest first', () => {
  const changes = readChangelog('- 2023-02-23 new: A\n- 2026-09-26 new: B\n- 2026-10-01 new: C\n- 2026-10-01 fix: D');
  assert.deepEqual(byDay(changes).map((d) => [d.day, d.changes.map((c) => c.text)]), [['2026-10-01', ['C', 'D']], ['2026-09-26', ['B']], ['2023-02-23', ['A']]]);
  assert.deepEqual(byYear(changes).map((y) => [y.year, y.days.map((d) => d.day)]), [['2026', ['2026-10-01', '2026-09-26']], ['2023', ['2023-02-23']]]);
});

test("the site's own changelog reads, and its lines stay short", () => {
  const changes = readChangelog(readFileSync(new URL('../src/content/changelog.md', import.meta.url), 'utf8'));
  assert.ok(changes.length > 0);
  for (const c of changes) assert.ok(c.text.replace(/\]\([^)]*\)/g, ']').length <= 72, `Too long for the Changelog: "${c.text}"`);
});
