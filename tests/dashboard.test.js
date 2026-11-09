// Jack's dashboard page's rules (src/lib/dashboard.js): Malaysia's times and days, days left, the overdue backup, what
// needs him, Reminders, Today, the projects by kind, the calendar. Test snapshots only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attention, backupDue, expiryRows, calendar, calendarEvents, calendarGap, cardProjects, dayAway, dayName, dayTone, doneByDay, monthGrid, monthName, shiftMonth, daysLeft, doneCounts, doneLanes, doneModules, doneWeek, kindsOf, laneOrder, lede, nextBackup, pageLevel, projectShelves, reminderRings, splitTodos, todoRows, weekColours, whenWords, worst } from '../src/lib/dashboard.js';

const at = (iso) => Date.parse(iso);
const HOUR = 3600_000;
const DAY = 24 * HOUR;
// Sat 7 Nov 2026, 16:00 in Malaysia.
const NOW = at('2026-11-07T16:00:00+08:00');
const app = (over = {}) => ({ app: 'Expenses', signed_at: '2026-11-07T15:01:47+08:00', runs_out_at: '2026-11-14T15:01:47+08:00', failures: 0, last_error: '', last_failure_at: null, waiting_build_at: null, ...over });
const snap = (over = {}) => ({
  version: 1,
  made_at: '2026-11-07T15:55:00+08:00',
  sideload: { apps: [app()] },
  deploys: { runs: [{ repo: 'test-site', workflow: 'Test deploy', state: 'success', at: '2026-11-07T08:07:58+08:00', url: 'https://github.com/test/test/actions/runs/1' }] },
  backup: { last_success_at: '2026-11-01T22:04:00+08:00', last_error: '', last_error_at: null },
  repos: { repos: [{ name: 'test-a', uncommitted: 0, unpushed: 0 }, { name: 'test-b', uncommitted: 0, unpushed: 0 }] },
  done: { since: '2026-10-26', items: [] },
  ...over,
});

test('times read on Malaysia’s clock, whatever the browser’s zone', () => {
  assert.equal(whenWords(at('2026-11-07T13:02:00+08:00'), NOW), 'Today, 13:02');
  assert.equal(whenWords(at('2026-11-06T23:31:00+08:00'), NOW), 'Yesterday, 23:31');
  assert.equal(whenWords(at('2026-11-08T09:05:00+08:00'), NOW), 'Tomorrow, 09:05');
  assert.equal(whenWords(at('2026-11-01T22:04:00+08:00'), NOW), 'Sun 1 Nov, 22:04');
  // 16:30 UTC is already the next day in Malaysia.
  assert.equal(whenWords(at('2026-11-07T16:30:00Z'), NOW), 'Tomorrow, 00:30');
  assert.equal(dayName('2026-11-08'), 'Sun 8 Nov');
});

test('days left turn 2 exactly when the laptop adds its reminder, 48 hours before', () => {
  const out = at('2026-11-14T15:01:47+08:00');
  assert.equal(daysLeft(out, out - 48 * HOUR - 1000), 3);
  assert.equal(daysLeft(out, out - 48 * HOUR), 2);
  assert.equal(daysLeft(out, out - 24 * HOUR - 1000), 2);
  assert.equal(daysLeft(out, out - 24 * HOUR), 1);
  assert.equal(daysLeft(out, out - 1000), 1);
  assert.equal(daysLeft(out, out), 0);
});

test('a sideload with 3 days left is fine, 2 is amber, 1 or none is red', () => {
  const out = at('2026-11-14T15:01:47+08:00');
  const needs = (now) => attention(snap(), now).filter((n) => n.key.startsWith('sideload'));
  assert.deepEqual(needs(out - 49 * HOUR), []);
  assert.deepEqual(reminderRings(snap(), out - 49 * HOUR).map((r) => [r.left, r.lit, r.level]), [[3, 3, 'ok']]);
  assert.deepEqual(needs(out - 47 * HOUR).map((n) => [n.level, n.fig, n.unit, n.cells, n.lines[0]]), [['soon', 2, 'days left', 2, 'Runs out Sat 14 Nov, 15:01']]);
  assert.deepEqual(needs(out - 2 * HOUR).map((n) => [n.level, n.fig, n.unit, n.lines[0]]), [['act', 1, 'day left', 'Runs out today, 15:01']]);
  assert.deepEqual(needs(out + HOUR).map((n) => [n.level, n.fig, n.lines[0]]), [['act', 0, 'Ran out today, 15:01']]);
});

test('failed refreshes and a build waiting', () => {
  const needs = attention(snap({ sideload: { apps: [app({ failures: 3, last_error: 'Device not found', last_failure_at: '2026-11-07T03:00:00+08:00', waiting_build_at: '2026-11-07T08:41:00+08:00' })] } }), NOW);
  assert.deepEqual(needs.map((n) => [n.level, n.title, n.fig ?? n.icon, n.err]), [
    ['act', 'Auto-refresh is failing', 3, 'Device not found'],
    ['soon', 'New Expenses build waiting', 'phone', undefined],
  ]);
  assert.equal(needs[0].lines[0], 'Last try today, 03:00');
});

test('the KB backup is overdue an hour after a Sunday 22:00 run that hasn’t succeeded', () => {
  const last = '2026-11-01T22:04:00+08:00';
  const backup = (now) => attention(snap({ backup: { last_success_at: last, last_error: '', last_error_at: null } }), now).find((n) => n.key === 'backup');
  assert.equal(backup(at('2026-11-08T22:59:00+08:00')), undefined);
  const late = backup(at('2026-11-08T23:00:00+08:00'));
  assert.deepEqual([late.level, late.title, late.fig, late.unit, late.lines[0]], ['act', 'KB backup is overdue', 7, 'days since the last', 'Missed today, 22:00']);
  // While the laptop is off it keeps counting.
  assert.equal(backup(at('2026-11-12T09:00:00+08:00')).fig, 10);
  assert.equal(backupDue(at('2026-11-08T23:00:00+08:00')), at('2026-11-08T22:00:00+08:00'));
  assert.equal(backupDue(at('2026-11-08T22:30:00+08:00')), at('2026-11-01T22:00:00+08:00'));
});

test('a backup that ran late, at the next login, is fine until the following Sunday', () => {
  const s = snap({ backup: { last_success_at: '2026-11-09T08:00:00+08:00', last_error: '', last_error_at: null, project: 'test-kb' } });
  const now = at('2026-11-09T09:00:00+08:00');
  assert.equal(attention(s, now).find((n) => n.key === 'backup'), undefined);
  // Its card is claude-kb's (here test-kb's): Other, as the repos don't name it.
  const card = projectShelves(s, [], now).find((shelf) => shelf.key === 'other')?.cards.find((c) => c.name === 'test-kb');
  assert.deepEqual(card?.checks, [{ name: 'KB backup', state: 'ok', word: 'Done', when: 'Next Sun 15 Nov, 22:00' }]);
  assert.equal(nextBackup(at('2026-11-01T22:04:00+08:00')), at('2026-11-08T22:00:00+08:00'));
});

test('a backup that failed, or never ran, needs Jack', () => {
  const failed = attention(snap({ backup: { last_success_at: '2026-11-01T22:04:00+08:00', last_error: 'python.exe not found', last_error_at: '2026-11-07T09:00:00+08:00' } }), NOW).find((n) => n.key === 'backup');
  assert.deepEqual([failed.title, failed.err, failed.lines[0]], ['KB backup failed', 'python.exe not found', 'Today, 09:00']);
  const never = attention(snap({ backup: { last_success_at: null, last_error: '', last_error_at: null } }), NOW).find((n) => n.key === 'backup');
  assert.equal(never.title, 'KB backup is overdue');
});

test('the line under the title, and the laptop counted off after an hour', () => {
  const made = at('2026-11-07T15:00:00+08:00');
  assert.deepEqual(lede(made, made + 20_000), { offline: false, text: 'Updated just now' });
  assert.deepEqual(lede(made, made + 60_000), { offline: false, text: 'Updated 1 minute ago' });
  assert.deepEqual(lede(made, made + 59 * 60_000), { offline: false, text: 'Updated 59 minutes ago' });
  assert.deepEqual(lede(made, made + HOUR), { offline: true, text: 'Last update today, 15:00' });
});

test('failed deploys and unread sources, most urgent first; repos and late to-dos are elsewhere now', () => {
  const s = snap({
    deploys: { runs: [{ repo: 'test-site', workflow: 'Test deploy', state: 'failure', at: '2026-11-07T08:55:00+08:00', url: 'https://github.com/test/test/actions/runs/2' }] },
    backup: { error: "Can't read the KB backup log: FileNotFoundError" },
    repos: { repos: [{ name: 'test-a', uncommitted: 5, unpushed: 0 }, { name: 'test-b', uncommitted: 1, unpushed: 2 }] },
  });
  const needs = attention(s, NOW);
  assert.deepEqual(needs.map((n) => [n.level, n.title, n.project]), [
    ['act', 'test-site: Test deploy failed', 'test-site'],
    ['soon', "Can't read the KB backup log", undefined],
  ]);
  assert.equal(worst(needs), 'act');
  assert.deepEqual(needs[0].link, { href: 'https://github.com/test/test/actions/runs/2', text: 'Open the run' });
  assert.equal(needs[1].err, 'FileNotFoundError');
  // A signing names its app's repo, for the kind's mark.
  const out = at('2026-11-14T15:01:47+08:00');
  assert.deepEqual(attention(snap({ sideload: { apps: [app({ project: 'test-app' })] } }), out - 2 * HOUR).filter((n) => n.key.startsWith('sideload')).map((n) => n.project), ['test-app']);
});

test('a quiet day: all clear, and the menu’s button amber only for a late to-do of Jack’s own', () => {
  assert.deepEqual(attention(snap(), NOW), []);
  assert.equal(worst([]), 'calm');
  const reminder = { app: 'Expenses', project: 'test-app', text: 'Test: re-sign' };
  const late = (text, project = 'test-site') => [{ id: '1', project, text, notes: '', on: '2026-11-05' }];
  assert.equal(pageLevel(snap(), [], NOW), 'calm');
  assert.equal(pageLevel(snap(), null, NOW), 'calm');
  assert.equal(pageLevel(snap(), late('Test: late'), NOW), 'soon');
  assert.equal(pageLevel(snap({ reminders: [reminder] }), late('Test: re-sign', 'test-app'), NOW), 'calm');
  const broken = snap({ deploys: { runs: [{ repo: 'test-site', workflow: 'Test deploy', state: 'failure', at: '2026-11-07T08:55:00+08:00', url: 'https://github.com/test/test/actions/runs/2' }] } });
  assert.equal(pageLevel(broken, late('Test: late'), NOW), 'act');
});

test('Today: late ones first, then today’s, with their notes; the laptop’s reminder to-dos in neither list', () => {
  const items = [
    { id: '1', project: 'test-a', text: 'Test: none', notes: '' },
    { id: '2', project: 'test-a', text: 'Test: later', notes: '', on: '2026-11-09' },
    { id: '3', project: 'test-b', text: 'Test: today', notes: 'Line one\nline two', on: '2026-11-07' },
    { id: '4', project: 'test-app', text: 'Test: re-sign', notes: '', on: '2026-11-06' },
    { id: '5', project: 'test-a', text: 'Test: late', notes: '', on: '2026-11-05' },
    // Same words under another project: Jack's own, not the reminder.
    { id: '6', project: 'test-b', text: 'Test: re-sign', notes: '', on: '' },
  ];
  const split = splitTodos(items, [{ app: 'Expenses', project: 'test-app', text: 'Test: re-sign' }], '2026-11-07');
  assert.deepEqual(split.today, [
    { text: 'Test: late', notes: '', project: 'test-a', day: { text: '2 days ago', kind: 'late' } },
    { text: 'Test: today', notes: 'Line one\nline two', project: 'test-b', day: { text: 'Today', kind: 'today' } },
  ]);
  assert.deepEqual(split.rest.map((t) => t.id), ['1', '2', '6']);
  assert.deepEqual(split.own.map((t) => t.id), ['1', '2', '3', '5', '6']);
  assert.deepEqual(splitTodos(items, [], '2026-11-07').today.map((t) => t.text), ['Test: late', 'Test: re-sign', 'Test: today']);
  assert.deepEqual(splitTodos([], [], '2026-11-07'), { today: [], rest: [], own: [] });
});

test('Reminders: one ring an app, soonest first, lit for the days left in the signing’s colour', () => {
  const second = app({ app: 'Other', signed_at: '2026-11-01T09:00:00+08:00', runs_out_at: '2026-11-08T09:00:00+08:00', project: 'test-other' });
  // A second install of Expenses that runs out later says nothing more.
  const rings = reminderRings(snap({ sideload: { apps: [app({ project: 'test-app' }), second, app({ runs_out_at: '2026-11-15T09:00:00+08:00' })] } }), NOW);
  assert.deepEqual(rings, [
    { app: 'Other', project: 'test-other', title: 'Re-sign Other', left: 1, lit: 1, level: 'act', runsOut: 'Runs out tomorrow, 09:00', signed: 'Signed Sun 1 Nov, 09:00' },
    { app: 'Expenses', project: 'test-app', title: 'Re-sign Expenses', left: 7, lit: 7, level: 'ok', runsOut: 'Runs out Sat 14 Nov, 15:01', signed: 'Signed today, 15:01' },
  ]);
  const gone = reminderRings(snap(), at('2026-11-15T09:00:00+08:00'))[0];
  assert.deepEqual([gone.left, gone.lit, gone.level, gone.runsOut, gone.project], [0, 0, 'act', 'Ran out yesterday, 15:01', '']);
  assert.equal(reminderRings(snap(), at('2026-11-12T16:00:00+08:00'))[0].level, 'soon');
  assert.deepEqual(reminderRings(snap({ sideload: { error: "Can't read Sideloadly: x" } }), NOW), []);
});

test('Reminders’ expiries: soonest first, a quiet row while far off, a ring of 30 days once amber at 30 and red at 7', () => {
  const key = { title: 'Renew the Now editor’s keys', expires_on: '2027-10-12', project: 'jacks-space', how: 'In jacks-space: npx wrangler secret put' };
  const s = snap({ expiries: { items: [key, { title: 'Test domain', expires_on: '2026-11-20' }] } });
  assert.deepEqual(expiryRows(s, at('2026-11-09T13:00:00+08:00')).map((r) => [r.title, r.left, r.level, r.ring, r.lit, r.when, r.project, r.how]), [
    ['Test domain', 11, 'soon', true, 11, 'Expires Fri 20 Nov', '', ''],
    ['Renew the Now editor’s keys', 337, 'ok', false, 30, 'Expires Tue 12 Oct 2027', 'jacks-space', 'In jacks-space: npx wrangler secret put'],
  ]);
  const one = snap({ expiries: { items: [key] } });
  // The day's 0:00 in Malaysia is when it runs out: 30 days left lights it from that moment, 7 turns it red.
  const out = at('2027-10-12T00:00:00+08:00');
  const state = (now) => expiryRows(one, now).map((r) => [r.left, r.level, r.ring])[0];
  assert.deepEqual(state(out - 30 * DAY - 1000), [31, 'ok', false]);
  assert.deepEqual(state(out - 30 * DAY), [30, 'soon', true]);
  assert.deepEqual(state(out - 7 * DAY - 1000), [8, 'soon', true]);
  assert.deepEqual(state(out - 7 * DAY), [7, 'act', true]);
  assert.deepEqual(state(out - 1000), [1, 'act', true]);
  assert.deepEqual(state(out), [0, 'act', true]);
  assert.equal(expiryRows(one, out + DAY)[0].when, 'Expired Tue 12 Oct');
  assert.deepEqual(expiryRows(snap(), NOW), []);
  assert.deepEqual(expiryRows(snap({ expiries: { error: "Can't read the expiry list: x" } }), NOW), []);
});

test('an expiry needs Jack once lit, with how to renew it; a list the laptop could not read says so', () => {
  const key = { title: 'Renew the Now editor’s keys', expires_on: '2027-10-12', project: 'jacks-space', how: 'In jacks-space: npx wrangler secret put' };
  const needs = (now) => attention(snap({ expiries: { items: [key] } }), now).filter((n) => n.key.startsWith('expiry'));
  assert.deepEqual(needs(at('2026-11-09T13:00:00+08:00')), []);
  assert.deepEqual(needs(at('2027-09-22T09:00:00+08:00')), [
    { level: 'soon', key: 'expiry-Renew the Now editor’s keys', title: 'Renew the Now editor’s keys', project: 'jacks-space', fig: 20, unit: 'days left', lines: ['Expires Tue 12 Oct', 'In jacks-space: npx wrangler secret put'] },
  ]);
  assert.deepEqual(needs(at('2027-10-11T09:00:00+08:00')).map((n) => [n.level, n.fig, n.unit]), [['act', 1, 'day left']]);
  assert.equal(pageLevel(snap({ sideload: { apps: [] }, backup: { last_success_at: '2027-09-19T22:04:00+08:00', last_error: '', last_error_at: null }, expiries: { items: [key] } }), [], at('2027-09-22T09:00:00+08:00')), 'soon');
  const unread = attention(snap({ expiries: { error: "Can't read the expiry list: row 2 in expiries.json needs a title" } }), NOW).find((n) => n.key === 'error-expiries');
  assert.equal(unread?.level, 'soon');
  // On the calendar on its day, green while far off.
  const day = calendarEvents(snap({ expiries: { items: [key] } }), [], at('2026-11-09T13:00:00+08:00')).find((e) => e.icon === 'key');
  assert.deepEqual(day, { day: '2027-10-12', at: at('2027-10-12T00:00:00+08:00'), icon: 'key', title: 'Renew the Now editor’s keys', project: 'jacks-space', tone: 'plan', word: '337 days left' });
});

test('Projects: a shelf a kind in order, a card each for the projects with something to say, the rest quiet', () => {
  const s = snap({
    sideload: { apps: [app({ project: 'test-app', failures: 2, last_failure_at: '2026-11-07T03:00:00+08:00' })] },
    deploys: { runs: [
      { repo: 'test-site', workflow: 'Test deploy', state: 'success', at: '2026-11-07T08:07:00+08:00', url: 'https://github.com/test/test/actions/runs/1' },
      { repo: 'test-site', workflow: 'Test brief', state: 'running', at: '2026-11-07T15:58:00+08:00', url: 'https://github.com/test/test/actions/runs/3' },
    ] },
    backup: { last_success_at: '2026-10-25T22:04:00+08:00', last_error: '', last_error_at: null, project: 'test-kb' },
    repos: { repos: [
      { name: 'test-app', uncommitted: 0, unpushed: 0, kind: 'mobile' },
      { name: 'test-kb', uncommitted: 0, unpushed: 0, kind: 'behind' },
      { name: 'test-quiet', uncommitted: 0, unpushed: 0, kind: 'behind' },
      { name: 'test-site', uncommitted: 5, unpushed: 2, kind: 'web' },
      { name: 'test-widget', uncommitted: 0, unpushed: 0, kind: 'pc' },
    ] },
    // Mon 2 to Sat 7 Nov is this week; Sun 1 Nov is last week's.
    done: { since: '2026-10-26', items: [
      { day: '2026-11-07', at: '2026-11-07T10:00:00+08:00', project: 'test-widget', kind: 'commit', text: 'Test' },
      { day: '2026-11-07', at: '2026-11-07T09:00:00+08:00', project: 'test-widget', kind: 'todo', text: 'Test' },
      { day: '2026-11-02', at: '2026-11-02T09:00:00+08:00', project: 'test-widget', kind: 'commit', text: 'Test' },
      { day: '2026-11-01', at: '2026-11-01T09:00:00+08:00', project: 'test-quiet', kind: 'commit', text: 'Test' },
    ] },
  });
  const shelves = projectShelves(s, [{ id: '1', project: 'test-app', text: 'Test', notes: '' }], NOW);
  assert.deepEqual(shelves.map((sh) => [sh.key, sh.name, sh.icon, sh.count, sh.cards.map((c) => [c.name, c.state]), sh.quiet]), [
    ['web', 'Websites', 'globe', 1, [['test-site', 'run']], []],
    ['mobile', 'Mobile App', 'phone', 1, [['test-app', 'act']], []],
    ['pc', 'PC app', 'monitor', 1, [['test-widget', 'ok']], []],
    ['behind', 'Behind the scenes', 'gear', 2, [['test-kb', 'act']], ['test-quiet']],
  ]);
  const card = (name) => shelves.flatMap((sh) => sh.cards).find((c) => c.name === name);
  assert.deepEqual(card('test-site').checks.map((c) => [c.name, c.state, c.word, c.when, c.href]), [
    ['Test deploy', 'ok', 'Passed', 'Today, 08:07', 'https://github.com/test/test/actions/runs/1'],
    ['Test brief', 'run', 'Running', 'Since today, 15:58', 'https://github.com/test/test/actions/runs/3'],
  ]);
  assert.deepEqual(card('test-site').repo, ['5 not committed', '2 not pushed']);
  assert.deepEqual(card('test-app').checks.map((c) => [c.name, c.state, c.word, c.when]), [
    ['Sideload', 'ok', '7 days left', 'Runs out Sat 14 Nov, 15:01'],
    ['Auto-refresh', 'act', '2 tries failed', 'Last try today, 03:00'],
  ]);
  assert.equal(card('test-app').todos, 1);
  assert.deepEqual(card('test-kb').checks, [{ name: 'KB backup', state: 'act', word: 'Overdue', when: 'Missed Sun 1 Nov, 22:00' }]);
  assert.deepEqual([card('test-widget').week, card('test-widget').done], [[1, 0, 0, 0, 0, 2, 0], 3]);
  // Work not committed or pushed alone is the card's quiet grey.
  const dirty = projectShelves(snap({ deploys: { runs: [] }, repos: { repos: [{ name: 'test-a', uncommitted: 1, unpushed: 0, kind: 'pc' }] } }), [], NOW);
  assert.deepEqual(dirty[0].cards.map((c) => [c.name, c.state]), [['test-a', 'fyi']]);
});

test('Projects from an older snapshot, or with the repos unread, still have a shelf', () => {
  // Before kinds: every repo is Other.
  assert.deepEqual(projectShelves(snap(), [], NOW).map((sh) => [sh.key, sh.count, sh.quiet]), [['other', 3, ['test-a', 'test-b']]]);
  assert.deepEqual([...kindsOf(snap({ repos: { repos: [{ name: 'test-a', uncommitted: 0, unpushed: 0, kind: 'mods' }, { name: 'test-b', uncommitted: 0, unpushed: 0, kind: 'robots' }] } }))], [['test-a', 'mods'], ['test-b', 'other']]);
  const unread = projectShelves(snap({ repos: { error: "Can't read the repos: test" } }), null, NOW);
  assert.deepEqual(unread.map((sh) => [sh.key, sh.cards.map((c) => c.name)]), [['other', ['test-site']]]);
  assert.deepEqual(projectShelves(snap({ sideload: { error: 'x' }, deploys: { error: 'x' }, backup: { error: 'x' }, repos: { error: 'x' } }), null, NOW), []);
});

test('to-do rows: due first, then days to come, then the rest as the laptop sent them', () => {
  const rows = todoRows([
    { id: '1', project: 'a', text: 'none 1', notes: '' },
    { id: '2', project: 'a', text: 'later', notes: '', on: '2026-11-09' },
    { id: '3', project: 'b', text: 'today', notes: '', on: '2026-11-07' },
    { id: '4', project: 'b', text: 'none 2', notes: '', on: '' },
    { id: '5', project: 'a', text: 'late', notes: '', on: '2026-11-05' },
  ], '2026-11-07');
  assert.deepEqual(rows.map((r) => [r.text, r.day?.text ?? '', r.day?.kind ?? '']), [
    ['late', '2 days ago', 'late'], ['today', 'Today', 'today'], ['later', 'Mon 9 Nov', 'later'], ['none 1', '', ''], ['none 2', '', ''],
  ]);
});

test('Done’s weeks run Monday to Sunday in Malaysia', () => {
  const items = [
    { day: '2026-11-02', at: '2026-11-02T10:00:00+08:00', project: 'b', kind: 'commit', text: 'Test - Monday' },
    { day: '2026-11-07', at: '2026-11-07T10:00:00+08:00', project: 'a', kind: 'todo', text: 'Test today' },
    { day: '2026-11-01', at: '2026-11-01T10:00:00+08:00', project: 'a', kind: 'commit', text: 'Test - last Sunday' },
  ];
  const week = doneWeek(items, 'this', NOW);
  assert.deepEqual(week.map((d) => d.label), ['Mon 2', 'Tue 3', 'Wed 4', 'Thu 5', 'Fri 6', 'Today', 'Sun 8']);
  assert.deepEqual(week.map((d) => d.items.length), [1, 0, 0, 0, 0, 1, 0]);
  assert.deepEqual([week[5].today, week[6].future], [true, true]);
  const last = doneWeek(items, 'last', NOW);
  assert.deepEqual([last[0].day, last[6].day, last[6].items[0].text], ['2026-10-26', '2026-11-01', 'Test - last Sunday']);
  // Sunday night, 23:30 in Malaysia, is still the same week.
  assert.equal(doneWeek(items, 'this', at('2026-11-08T23:30:00+08:00'))[6].label, 'Today');
});

test('Done’s colours: a project keeps its colour in both weeks, and no two lanes of a week share one', () => {
  const colours = weekColours(['jacks-space', 'expenses', 'kb'], ['kb', 'widget', 'jacks-space', 'agent']);
  // This week by name: expenses 1, jacks-space 2, kb 3; last week keeps those and gives the rest the unused ones.
  assert.deepEqual(Object.fromEntries(colours), { expenses: 1, 'jacks-space': 2, kb: 3, agent: 4, widget: 5 });
  // Full weeks: last week's new projects first take colours this week doesn't use, then this week's leftovers.
  const now = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const last = ['g', 'p', 'q', 'r', 's', 't', 'u'];
  const full = weekColours(now, last);
  assert.deepEqual(now.map((p) => full.get(p)), [1, 2, 3, 4, 5, 6, 7]);
  const lastColours = last.map((p) => full.get(p));
  assert.equal(new Set(lastColours).size, 7);
  assert.deepEqual(lastColours, [7, 8, 1, 2, 3, 4, 5]);
  // Either week alone: name order, as before.
  assert.deepEqual(Object.fromEntries(weekColours(['b', 'a'], [])), { a: 1, b: 2 });
  assert.deepEqual(Object.fromEntries(weekColours([], ['b', 'a'])), { a: 1, b: 2 });
});

test('Done’s lanes: a project each, the busiest first; past seven, the rest share one', () => {
  const thing = (day, project) => ({ day, at: `${day}T10:00:00+08:00`, project, kind: 'commit', text: 'Test - thing' });
  const items = [
    thing('2026-11-02', 'b'), thing('2026-11-06', 'b'), thing('2026-11-06', 'b'),
    thing('2026-11-06', 'a'), thing('2026-11-07', 'a'), thing('2026-11-07', 'c'),
    thing('2026-11-01', 'z'), // last week's: not this week's lanes
  ];
  const lanes = doneLanes(doneWeek(items, 'this', NOW));
  assert.deepEqual(lanes.map((l) => [l.key, l.name, l.total]), [['p:b', 'b', 3], ['p:a', 'a', 2], ['p:c', 'c', 1]]);
  assert.deepEqual(lanes[0].days.map((d) => d.length), [1, 0, 0, 0, 2, 0, 0]);
  assert.deepEqual(doneLanes(doneWeek(items, 'this', NOW).map((d) => ({ ...d, items: [] }))), []);

  const many = (n) => Array.from({ length: n }, (_, i) => thing('2026-11-05', `p${i}`));
  // Seven projects: seven lanes, no "1 more project".
  assert.equal(doneLanes(doneWeek(many(7), 'this', NOW)).length, 7);
  const nine = doneLanes(doneWeek([...many(9), thing('2026-11-06', 'p8'), thing('2026-11-06', 'p8')], 'this', NOW));
  assert.deepEqual(nine.map((l) => l.name), ['p8', 'p0', 'p1', 'p2', 'p3', 'p4', '3 more projects']);
  assert.deepEqual([nine[6].projects, nine[6].total, nine[6].days[3].length], [['p5', 'p6', 'p7'], 3, 3]);
});

test('Jack’s dragged order sorts the lanes, but the busiest still pick who gets one', () => {
  const thing = (day, project) => ({ day, at: `${day}T10:00:00+08:00`, project, kind: 'commit', text: 'Test - thing' });
  const items = [thing('2026-11-02', 'b'), thing('2026-11-06', 'b'), thing('2026-11-06', 'b'), thing('2026-11-06', 'a'), thing('2026-11-07', 'a'), thing('2026-11-07', 'c')];
  const names = (order) => doneLanes(doneWeek(items, 'this', NOW), order).map((l) => l.name);
  assert.deepEqual(names([]), ['b', 'a', 'c']);
  // Ordered ones first in their order (one not here this week skipped), the rest after them, busiest first.
  assert.deepEqual(names(['c', 'gone', 'a']), ['c', 'a', 'b']);
  assert.deepEqual(names(['c']), ['c', 'b', 'a']);

  // Nine projects: the six busiest keep their lanes whatever the order; p7, ordered first, stays in the shared one.
  const many = [...Array.from({ length: 9 }, (_, i) => thing('2026-11-05', `p${i}`)), thing('2026-11-06', 'p8'), thing('2026-11-06', 'p8')];
  const nine = doneLanes(doneWeek(many, 'this', NOW), ['p7', 'p3', 'p0']);
  assert.deepEqual(nine.map((l) => l.name), ['p3', 'p0', 'p8', 'p1', 'p2', 'p4', '3 more projects']);
  assert.deepEqual(nine[6].projects, ['p5', 'p6', 'p7']);
});

test('moving a lane: the new order, with the other week’s projects kept by their neighbours', () => {
  // Nothing ordered yet: the shown lanes as drawn, the moved one at its new place.
  assert.deepEqual(laneOrder([], ['b', 'a', 'c'], 'c', 0), ['c', 'b', 'a']);
  assert.deepEqual(laneOrder([], ['b', 'a', 'c'], 'b', 2), ['a', 'c', 'b']);
  assert.deepEqual(laneOrder([], ['b', 'a', 'c'], 'a', 1), ['b', 'a', 'c']);
  // x and y aren't shown this week: moving c above b leaves x after a and y first, as they were.
  assert.deepEqual(laneOrder(['y', 'b', 'a', 'x'], ['b', 'a', 'c'], 'c', 0), ['y', 'c', 'b', 'a', 'x']);
  // To the bottom: right after the last shown one, c, which joins the order at its end, as it was drawn last.
  assert.deepEqual(laneOrder(['y', 'b', 'a', 'x'], ['b', 'a', 'c'], 'b', 2), ['y', 'a', 'x', 'c', 'b']);
  assert.deepEqual(laneOrder(['b', 'a', 'x'], ['b', 'a'], 'b', 1), ['a', 'b', 'x']);
  // A place past either end lands at that end; a lone lane stays put.
  assert.deepEqual(laneOrder([], ['b', 'a'], 'a', 9), ['b', 'a']);
  assert.deepEqual(laneOrder([], ['b', 'a'], 'a', -3), ['a', 'b']);
  assert.deepEqual(laneOrder(['x'], ['b'], 'b', 0), ['b', 'x']);
});

test('what some done things hold, to-dos first, a missing kind left out', () => {
  const thing = (kind) => ({ day: '2026-11-07', at: '', project: 'a', kind, text: 'Test' });
  assert.deepEqual(doneCounts([thing('commit'), thing('todo'), thing('commit')]), ['1 to-do', '2 commits']);
  assert.deepEqual(doneCounts([thing('todo')]), ['1 to-do']);
  assert.deepEqual(doneCounts([]), []);
});

test('done things by module: the name taken off, a commit naming two in each, the rest last, unnamed', () => {
  const thing = (kind, text) => ({ day: '2026-11-06', at: '', project: 'a', kind, text });
  const groups = doneModules([
    thing('commit', 'Docs - close polish batch 4 plan'),
    thing('todo', 'Plan: Polish batch 4: a name, the folded card'),
    thing('commit', 'Analysis - change stickers, month-end pace; Ledger - remember folded card'),
    thing('commit', 'Scan - learn retyped kinds; drop shop arrow'),
    thing('todo', 'Measure the PageSpeed scores (28 Oct)'),
    thing('commit', 'Expenses - design polish: solid sheets'),
    thing('commit', 'Plan - week bars finished'),
    thing('commit', 'docs - tidy'),
    thing('commit', 'Trade journal - screenshot trade log'),
    thing('todo', 'Plan: Total card: week bars'),
    thing('commit', 'Scan - kinds - grouped'),
    thing('commit', 'A very long sentence with no module - in it at all'),
  ]);
  assert.deepEqual(groups.map((g) => [g.name, g.items.map((i) => `${i.kind}:${i.text}`)]), [
    ['Docs', ['commit:close polish batch 4 plan', 'commit:tidy']],
    // A to-do's label groups with the commits of the same name, the to-do first.
    ['Plan', ['todo:Polish batch 4: a name, the folded card', 'todo:Total card: week bars', 'commit:week bars finished']],
    ['Analysis', ['commit:change stickers, month-end pace']],
    ['Ledger', ['commit:remember folded card']],
    // "; " not followed by a module is part of the line.
    // The first " - " or ": " ends the module, not a later one.
    ['Scan', ['commit:learn retyped kinds; drop shop arrow', 'commit:kinds - grouped']],
    // " - " wins over a ": " later in the line.
    ['Expenses', ['commit:design polish: solid sheets']],
    ['Trade journal', ['commit:screenshot trade log']],
    ['', ['todo:Measure the PageSpeed scores (28 Oct)', 'commit:A very long sentence with no module - in it at all']],
  ]);
  assert.deepEqual(doneModules([]), []);
});

const cal = (snapshot, todos = [], now = NOW) => calendarEvents(snapshot, todos, now).map((e) => [e.day, e.title, e.tone, e.word]);

test('the calendar puts each thing on its Malaysian day, around midnight too', () => {
  const runs = [
    { repo: 'test-site', workflow: 'Before midnight', state: 'success', at: '2026-11-06T15:59:00Z', url: 'https://github.com/t/t/actions/runs/1' },
    { repo: 'test-site', workflow: 'After midnight', state: 'success', at: '2026-11-06T16:00:00Z', url: 'https://github.com/t/t/actions/runs/2' },
  ];
  const days = calendarEvents(snap({ sideload: { apps: [] }, deploys: { runs }, backup: { error: "Can't read the KB backup log: test" } }), [], NOW);
  assert.deepEqual(days.map((e) => [e.day, e.title]), [['2026-11-06', 'Before midnight'], ['2026-11-07', 'After midnight']]);
});

test('the calendar: signing, run-out, deploys, the backup and the next run, the to-dos with a day', () => {
  const todos = [
    { id: '1', project: 'test-a', text: 'Test late', notes: '', on: '2026-11-05' },
    { id: '2', project: 'test-a', text: 'Test today', notes: '', on: '2026-11-07' },
    { id: '3', project: 'test-b', text: 'Test later', notes: '', on: '2026-11-20' },
    { id: '4', project: 'test-b', text: 'Test no day', notes: '', on: '' },
  ];
  const runs = [
    { repo: 'test-site', workflow: 'Test deploy', state: 'failure', at: '2026-11-07T08:00:00+08:00', url: 'https://github.com/t/t/actions/runs/1' },
    { repo: 'test-site', workflow: 'Test brief', state: 'running', at: '2026-11-07T15:58:00+08:00', url: 'https://github.com/t/t/actions/runs/2' },
    { repo: 'test-app', workflow: 'Test build', state: 'success', at: '2026-11-06T23:00:00+08:00', url: 'https://github.com/t/t/actions/runs/3' },
  ];
  assert.deepEqual(cal(snap({ deploys: { runs } }), todos), [
    ['2026-11-01', 'KB backup', 'past', 'Done'],
    ['2026-11-05', 'Test late', 'bad', '2 days late'],
    ['2026-11-06', 'Test build', 'past', 'Passed'],
    ['2026-11-07', 'Test deploy', 'bad', 'Failed'],
    ['2026-11-07', 'Test today', 'plan', 'To-do'],
    ['2026-11-07', 'Signed Expenses', 'past', 'Signed'],
    ['2026-11-07', 'Test brief', 'past', 'Running'],
    ['2026-11-08', 'KB backup', 'plan', 'Next run'],
    ['2026-11-14', 'Expenses runs out', 'plan', '7 days left'],
    ['2026-11-20', 'Test later', 'plan', 'To-do'],
  ]);
});

test('the calendar’s red and amber are Needs you’s: run-out days, a failed refresh, a new build, a missed backup', () => {
  const soon = app({ runs_out_at: '2026-11-09T15:00:00+08:00', failures: 2, last_failure_at: '2026-11-07T09:00:00+08:00', waiting_build_at: '2026-11-06T20:00:00+08:00' });
  // The backup's last success was before last Sunday's run: missed, and the next is the Sunday after.
  const late = snap({ sideload: { apps: [soon] }, deploys: { runs: [] }, backup: { last_success_at: '2026-10-25T22:04:00+08:00', last_error: '', last_error_at: null } });
  assert.deepEqual(cal(late).filter((e) => e[2] !== 'past'), [
    ['2026-11-01', 'KB backup', 'bad', 'Missed'],
    ['2026-11-06', 'New Expenses build', 'soon', 'Waiting'],
    ['2026-11-07', 'Auto-refresh failed', 'bad', '2 tries failed'],
    ['2026-11-08', 'KB backup', 'plan', 'Next run'],
    ['2026-11-09', 'Expenses runs out', 'soon', '2 days left'],
  ]);
  assert.deepEqual(attention(late, NOW).map((n) => [n.key, n.level]), [['refresh-Expenses', 'act'], ['backup', 'act'], ['sideload-Expenses', 'soon'], ['build-Expenses', 'soon']]);
  const gone = snap({ sideload: { apps: [app({ runs_out_at: '2026-11-07T12:00:00+08:00' })] } });
  assert.deepEqual(cal(gone).find((e) => e[1] === 'Expenses runs out'), ['2026-11-07', 'Expenses runs out', 'bad', 'Ran out']);
  const one = snap({ sideload: { apps: [app({ runs_out_at: '2026-11-08T12:00:00+08:00' })] } });
  assert.deepEqual(cal(one).find((e) => e[1] === 'Expenses runs out'), ['2026-11-08', 'Expenses runs out', 'bad', '1 day left']);
  const failed = snap({ backup: { last_success_at: '2026-11-01T22:04:00+08:00', last_error: 'test', last_error_at: '2026-11-03T09:00:00+08:00' } });
  assert.deepEqual(cal(failed).filter((e) => e[1] === 'KB backup'), [['2026-11-01', 'KB backup', 'past', 'Done'], ['2026-11-03', 'KB backup', 'bad', 'Failed'], ['2026-11-08', 'KB backup', 'plan', 'Next run']]);
  // A failure with no time is red in Needs you, so it is on today here.
  const untimed = snap({ sideload: { apps: [app({ failures: 1 })] }, backup: { last_success_at: '2026-11-01T22:04:00+08:00', last_error: 'test', last_error_at: null } });
  assert.deepEqual(cal(untimed).filter((e) => e[2] === 'bad'), [['2026-11-07', 'Auto-refresh failed', 'bad', '1 try failed'], ['2026-11-07', 'KB backup', 'bad', 'Failed']]);
  assert.deepEqual(attention(untimed, NOW).map((n) => n.level), ['act', 'act']);
});

test('a day lists what Jack should see first, whatever its time, then the fine past; each part by time, to-dos last', () => {
  const failing = app({ failures: 1, last_failure_at: '2026-11-07T07:00:00+08:00', waiting_build_at: '2026-11-07T12:00:00+08:00' });
  const runs = [
    { repo: 'test-site', workflow: 'Test passed', state: 'success', at: '2026-11-07T08:00:00+08:00', url: 'https://github.com/t/t/actions/runs/1' },
    { repo: 'test-site', workflow: 'Test failed', state: 'failure', at: '2026-11-07T15:30:00+08:00', url: 'https://github.com/t/t/actions/runs/2' },
    { repo: 'test-site', workflow: 'Test running', state: 'running', at: '2026-11-07T15:58:00+08:00', url: 'https://github.com/t/t/actions/runs/3' },
  ];
  const todos = [{ id: '1', project: 'test-a', text: 'Test today', notes: '', on: '2026-11-07' }];
  const s = snap({ sideload: { apps: [failing] }, deploys: { runs } });
  const order = [
    ['Auto-refresh failed', 'bad'], ['New Expenses build', 'soon'], ['Test failed', 'bad'], ['Test today', 'plan'],
    ['Test passed', 'past'], ['Signed Expenses', 'past'], ['Test running', 'past'],
  ];
  assert.deepEqual(cal(s, todos).filter((e) => e[0] === '2026-11-07').map((e) => [e[1], e[2]]), order);
  // The day's list and its hover card read the calendar's days, so they get the same order.
  assert.deepEqual(calendar(s, todos, NOW).events.get('2026-11-07')?.map((e) => [e.title, e.tone]), order);
});

test('the re-sign to-do the laptop added isn’t listed again, and two installs of one app are one signing', () => {
  const reminder = { app: 'Expenses', project: 'expenses-tracker', text: '重新 sideload Expenses（11-14 15:01 到期）' };
  const todos = [{ id: '1', project: 'expenses-tracker', text: reminder.text, notes: '', on: '2026-11-13' }];
  const s = snap({ reminders: [reminder], sideload: { apps: [app(), app({ runs_out_at: '2026-11-16T15:01:47+08:00' })] } });
  const own = splitTodos(todos, s.reminders, '2026-11-07').own;
  assert.deepEqual(cal(s, own).filter((e) => e[1].includes('Expenses') || e[1].includes('sideload')).map((e) => e[0]), ['2026-11-07', '2026-11-14']);
});

test('a month is always six weeks from the Monday of its 1st, across years and a four-week February', () => {
  const nov = monthGrid('2026-11');
  assert.deepEqual([nov.length, nov[0], nov[41]], [42, '2026-10-26', '2026-12-06']);
  const jan = monthGrid('2027-01');
  assert.deepEqual([jan[0], jan[41]], ['2026-12-28', '2027-02-07']);
  // 1 Feb 2027 is a Monday and February has exactly 28 days: two weeks of March after it.
  const feb = monthGrid('2027-02');
  assert.deepEqual([feb.length, feb[0], feb[27], feb[41]], [42, '2027-02-01', '2027-02-28', '2027-03-14']);
  assert.deepEqual([shiftMonth('2026-12', 1), shiftMonth('2027-01', -1), shiftMonth('2026-11', -13)], ['2027-01', '2026-12', '2025-10']);
  assert.equal(monthName('2027-02'), 'February 2027');
  assert.deepEqual(['2026-11-07', '2026-11-08', '2026-11-06', '2026-11-12', '2026-10-31'].map((d) => dayAway(d, '2026-11-07')), ['Today', 'Tomorrow', 'Yesterday', 'In 5 days', '7 days ago']);
});

test('a day’s done things by project, the busiest first; a project that isn’t a repo is Other', () => {
  const thing = (day, project) => ({ day, at: `${day}T10:00:00+08:00`, project, kind: 'commit', text: 'Test - x' });
  const days = doneByDay([thing('2026-11-07', 'test-b'), thing('2026-11-07', 'Jack'), thing('2026-11-07', 'test-b'), thing('2026-11-07', 'test-a'), thing('2026-11-06', 'test-a')], new Map([['test-a', 'web'], ['test-b', 'pc']]));
  assert.deepEqual(days.get('2026-11-07')?.map((g) => [g.project, g.kind, g.items.length]), [['test-b', 'pc', 2], ['Jack', 'other', 1], ['test-a', 'web', 1]]);
  assert.deepEqual(days.get('2026-11-06')?.map((g) => g.project), ['test-a']);
});

test('a day’s dot is its worst thing, grey for only done things, none for nothing; nothing before Done’s first day', () => {
  const thing = { day: '2026-10-26', at: '2026-10-26T10:00:00+08:00', project: 'test-a', kind: 'commit', text: 'Test - x' };
  const c = calendar(snap({ done: { since: '2026-10-26', items: [thing] } }), [{ id: '1', project: 'test-a', text: 'Test late', notes: '', on: '2026-11-05' }], NOW);
  const tone = (day) => dayTone(c.events.get(day) ?? [], c.done.get(day) ?? []);
  assert.deepEqual(['2026-11-05', '2026-11-14', '2026-11-08', '2026-11-01', '2026-10-26', '2026-10-25', '2026-11-02'].map(tone), ['bad', 'plan', 'plan', 'past', 'past', '', '']);
  assert.equal(c.since, '2026-10-26');
  const ev = (tone) => ({ day: 'x', at: 1, icon: 'x', title: 'x', project: '', tone, word: '' });
  assert.equal(dayTone([ev('past'), ev('soon'), ev('plan')], []), 'soon');
});

test('the calendar says which sources it couldn’t read', () => {
  assert.deepEqual(calendar(snap(), [], NOW).unread, []);
  const broken = snap({ deploys: { error: "Can't read GitHub: gh isn't installed" }, done: { error: "Can't read what was done: test" } });
  const c = calendar(broken, null, NOW);
  assert.deepEqual(c.unread, ['GitHub', 'what was done', 'the to-dos']);
  assert.equal(c.since, '');
  assert.equal(calendarGap(c.unread), "Couldn't read GitHub, what was done and the to-dos, so their days aren't shown.");
  assert.equal(calendarGap(['Sideloadly']), "Couldn't read Sideloadly, so its days aren't shown.");
  assert.equal(calendarGap([]), '');
});

test('a hover card names up to six projects, else five and never “1 more project”', () => {
  const groups = (n) => Array.from({ length: n }, (_, i) => ({ project: `test-${i}`, kind: 'other', items: [] }));
  assert.deepEqual([cardProjects(groups(6)).shown.length, cardProjects(groups(6)).more], [6, 0]);
  assert.deepEqual([cardProjects(groups(7)).shown.length, cardProjects(groups(7)).more], [5, 2]);
  assert.deepEqual(cardProjects([]), { shown: [], more: 0 });
});
