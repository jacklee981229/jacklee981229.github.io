import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KINDS, byDay, byYear, calendarMonth, cardsOf, changesSince, dayToDate, fold, isDay, readChangelog, shortDay, spanOf, stepOf } from '../src/lib/changelog.js';
import { changelogFile, lastUpdate } from '../src/lib/changelog-file.js';
import { isoDay } from '../src/lib/dates.js';

test("changes come out newest first, a day's later lines first", () => {
  const changes = readChangelog('<!-- note -->\n- 2026-09-26 new: Rebuilt\n- 2026-10-02 new: First that day\n- 2023-02-23 new: Started\n- 2026-10-02 fix: Second that day');
  assert.deepEqual(changes.map((c) => c.text), ['Second that day', 'First that day', 'Rebuilt', 'Started']);
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
  assert.deepEqual(byDay(changes).map((d) => [d.day, d.changes.map((c) => c.text)]), [['2026-10-01', ['D', 'C']], ['2026-09-26', ['B']], ['2023-02-23', ['A']]]);
  assert.deepEqual(byYear(changes).map((y) => [y.year, y.days.map((d) => d.day)]), [['2026', ['2026-10-01', '2026-09-26']], ['2023', ['2023-02-23']]]);
});

test("the site's own changelog reads, and its lines stay short", () => {
  const changes = readChangelog(readFileSync(new URL('../src/content/changelog.md', import.meta.url), 'utf8'));
  assert.ok(changes.length > 0);
  for (const c of changes) assert.ok(c.text.replace(/\]\([^)]*\)/g, ']').length <= 72, `Too long for the Changelog: "${c.text}"`);
});

test('a day a card, but quiet days in a row (one change each) share one; a lone quiet day keeps its own', () => {
  const day = (d, n) => ({ day: d, changes: Array.from({ length: n }, (_, i) => ({ day: d, kind: 'new', text: `${d} ${i}` })) });
  const days = [day('2026-10-04', 3), day('2026-10-03', 1), day('2026-10-02', 2), day('2026-09-29', 1), day('2026-09-27', 1), day('2026-09-26', 1)];
  assert.deepEqual(cardsOf(days).map((card) => card.map((d) => d.day)), [['2026-10-04'], ['2026-10-03'], ['2026-10-02'], ['2026-09-29', '2026-09-27', '2026-09-26']]);
  // A busy day after quiet ones starts a card of its own.
  assert.deepEqual(cardsOf([day('2026-10-02', 1), day('2026-10-01', 1), day('2026-09-30', 4)]).map((card) => card.length), [2, 1]);
});

test('a shared card names the days it spans, oldest first', () => {
  assert.equal(shortDay('2026-09-29'), '29 Sep');
  assert.equal(spanOf([{ day: '2026-09-29' }, { day: '2026-09-27' }, { day: '2026-09-26' }]), '26–29 Sep 2026');
  assert.equal(spanOf([{ day: '2026-10-01' }, { day: '2026-09-30' }]), '30 Sep – 1 Oct 2026');
  assert.equal(spanOf([{ day: '2023-10-05' }, { day: '2023-02-23' }]), '23 Feb – 5 Oct 2023');
});

test('the newest cards show at once and the rest wait behind Expand, none lost; a year cut by the fold goes on under it', () => {
  const years = byYear(readChangelog('- 2023-02-23 new: A\n- 2026-09-26 new: B\n- 2026-10-01 new: C\n- 2026-10-01 fix: D\n- 2026-10-02 new: E\n- 2026-10-02 fix: F'));
  const { open, folded } = fold(years, 2);
  assert.deepEqual(open.map((y) => [y.year, y.cards.map((card) => card[0].day)]), [['2026', ['2026-10-02', '2026-10-01']]]);
  assert.deepEqual(folded.map((y) => [y.year, y.continued, y.cards.map((card) => card[0].day)]), [['2026', true, ['2026-09-26']], ['2023', false, ['2023-02-23']]]);
  // Fewer cards than the fold: everything shows, nothing waits.
  assert.equal(fold(years, 10).folded.length, 0);
});

test("a day's square gets lighter in steps: none, 1, 2–4, 5–9, 10 or more", () => {
  assert.deepEqual([0, 1, 2, 4, 5, 9, 10, 18].map(stepOf), [0, 1, 2, 2, 3, 3, 4, 4]);
});

test('the changes since the rebuild count that day and after, not the Hexo years', () => {
  const changes = readChangelog('- 2023-10-04 new: A\n- 2026-09-26 new: B\n- 2026-10-05 new: C\n- 2026-10-05 fix: D');
  assert.equal(changesSince(changes, '2026-09-26'), 3);
});

test("the calendar is today's month: each day's count and step, today and the days to come", () => {
  const changes = readChangelog('- 2026-09-30 new: A\n- 2026-10-05 new: B\n- 2026-10-05 fix: C\n- 2026-10-07 new: D');
  const month = calendarMonth(changes, '2026-10-07');
  assert.deepEqual([month.name, month.blank, month.days.length], ['Oct 2026', 3, 31]);
  const day = (d) => month.days.find((x) => x.day === d);
  assert.deepEqual(day('2026-10-01'), { day: '2026-10-01', changes: 0, step: 0, today: false, later: false });
  assert.deepEqual(day('2026-10-05'), { day: '2026-10-05', changes: 2, step: 2, today: false, later: false });
  assert.deepEqual(day('2026-10-07'), { day: '2026-10-07', changes: 1, step: 1, today: true, later: false });
  assert.deepEqual(day('2026-10-08'), { day: '2026-10-08', changes: 0, step: 0, today: false, later: true });
});

test("the calendar's weeks start on Monday, and its month has the right days", () => {
  // February 2026 starts on a Sunday, June 2026 on a Monday, January 2027 on a Friday; February 2028 has 29 days.
  assert.deepEqual(['2026-02-10', '2026-06-30', '2027-01-01', '2028-02-29'].map((d) => { const m = calendarMonth([], d); return [m.name, m.blank, m.days.length]; }), [['Feb 2026', 6, 28], ['Jun 2026', 0, 30], ['Jan 2027', 4, 31], ['Feb 2028', 1, 29]]);
});

test('the site was last updated on the newer of its newest post and its newest change, the same day in the sitemap', () => {
  const newest = changelogFile()[0].day;
  const changed = dayToDate(newest);
  const later = new Date(changed.getTime() + 24 * 3600 * 1000);
  assert.equal(lastUpdate()?.getTime(), changed.getTime());
  assert.equal(lastUpdate(new Date(0))?.getTime(), changed.getTime());
  assert.equal(lastUpdate(later)?.getTime(), later.getTime());
  // A day's midnight in Malaysia is the evening before in UTC, where GitHub builds: the sitemap must keep the day.
  assert.equal(isoDay(changed), newest);
});
