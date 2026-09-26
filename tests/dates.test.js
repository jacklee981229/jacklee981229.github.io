import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysBetween, formatDate, isoDay, localTimestamp, monthKey, monthName, yearOf } from '../src/lib/dates.js';

test('dates show the Malaysia calendar day, even near midnight', () => {
  // 11:47 pm in Malaysia is still the same day there, although it is 15:47 UTC.
  assert.equal(formatDate(new Date('2023-10-04T23:47:00+08:00')), '4 Oct 2023');
  // 6:24 am in Malaysia is the previous day in UTC; it must still show 5 Oct.
  assert.equal(formatDate(new Date('2023-10-05T06:24:00+08:00')), '5 Oct 2023');
  assert.equal(isoDay(new Date('2023-10-05T06:24:00+08:00')), '2023-10-05');
});

test('month and year helpers', () => {
  const d = new Date('2023-03-25T12:21:17+08:00');
  assert.equal(monthName(d), 'Mar');
  assert.equal(yearOf(d), '2023');
  assert.equal(monthKey(d), '2023-03');
  assert.equal(monthName(new Date('2023-09-01T10:00:00+08:00')), 'Sep');
});

test('daysBetween counts calendar days in Malaysia time', () => {
  assert.equal(daysBetween(new Date('2023-10-04T19:26:20+08:00'), new Date('2023-03-25T12:21:17+08:00')), 193);
  assert.equal(daysBetween(new Date('2023-10-05T00:10:00+08:00'), new Date('2023-10-04T23:50:00+08:00')), 1);
  assert.equal(daysBetween(new Date('2023-10-04T23:50:00+08:00'), new Date('2023-10-04T00:10:00+08:00')), 0);
});

test('localTimestamp writes Malaysia time with a +08:00 offset', () => {
  assert.equal(localTimestamp(new Date('2026-09-26T06:05:09Z')), '2026-09-26T14:05:09+08:00');
  assert.equal(localTimestamp(new Date('2026-09-26T17:30:00Z')), '2026-09-27T01:30:00+08:00');
});
