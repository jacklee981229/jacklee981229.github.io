import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateToUnix, formatInstant, offsetName, readUnixTime } from '../src/lib/lab/timestamp.js';

// "Local time" in these tests is Malaysia's, whatever the computer running them uses.
process.env.TZ = 'Asia/Kuala_Lumpur';
const KL = 'Asia/Kuala_Lumpur';

test('a Unix time in seconds or milliseconds, told apart by size', () => {
  assert.deepEqual(readUnixTime('1727600000'), { ms: 1727600000000, unit: 'seconds' });
  assert.deepEqual(readUnixTime(' 1727600000123 '), { ms: 1727600000123, unit: 'milliseconds' });
  assert.deepEqual(readUnixTime('1727600000.5'), { ms: 1727600000500, unit: 'seconds' });
  assert.deepEqual(readUnixTime('-86400'), { ms: -86400000, unit: 'seconds' });
  assert.deepEqual(readUnixTime('0'), { ms: 0, unit: 'seconds' });
});

test('nothing typed shows nothing; anything else gets a plain message', () => {
  assert.equal(readUnixTime('  '), null);
  assert.deepEqual(readUnixTime('yesterday'), { error: 'Type a Unix time in digits, like 1727600000.' });
  assert.deepEqual(readUnixTime('1e9'), { error: 'Type a Unix time in digits, like 1727600000.' });
  assert.deepEqual(readUnixTime('99999999999999999'), { error: 'That’s too far from today to show as a date.' });
});

test('a moment shown in local time and in UTC', () => {
  assert.equal(formatInstant(1727600000000, KL), '29 Sep 2024, 16:53:20');
  assert.equal(formatInstant(1727600000000, 'UTC'), '29 Sep 2024, 08:53:20');
  assert.equal(formatInstant(1727600000123, 'UTC'), '29 Sep 2024, 08:53:20.123');
  assert.equal(formatInstant(-500, 'UTC'), '31 Dec 1969, 23:59:59.500');
  assert.equal(formatInstant(Date.parse('2024-01-05T00:00:00Z'), 'UTC'), '5 Jan 2024, 00:00:00');
});

test('the offset from UTC, with daylight saving where a place has it', () => {
  assert.equal(offsetName(1727600000000, KL), 'GMT+8');
  assert.equal(offsetName(Date.parse('2024-07-01T12:00:00Z'), 'America/New_York'), 'GMT-4');
  assert.equal(offsetName(Date.parse('2024-01-15T12:00:00Z'), 'America/New_York'), 'GMT-5');
});

test('a date back to Unix time, read as local time or UTC', () => {
  assert.deepEqual(dateToUnix('2024-09-29T16:53:20', 'local'), { seconds: 1727600000, milliseconds: 1727600000000 });
  assert.deepEqual(dateToUnix('2024-09-29T08:53:20', 'utc'), { seconds: 1727600000, milliseconds: 1727600000000 });
  assert.deepEqual(dateToUnix('2024-09-29T16:53', 'local'), { seconds: 1727599980, milliseconds: 1727599980000 });
  assert.deepEqual(dateToUnix('1969-12-31T23:59:59.500', 'utc'), { seconds: -1, milliseconds: -500 });
});

test('local time follows daylight saving', () => {
  process.env.TZ = 'America/New_York';
  try {
    assert.equal(dateToUnix('2024-07-01T12:00', 'local')?.seconds, 1719849600);
    assert.equal(dateToUnix('2024-01-15T12:00', 'local')?.seconds, 1705338000);
  } finally {
    process.env.TZ = KL;
  }
});

test('an unfinished date gives nothing yet', () => {
  assert.equal(dateToUnix('', 'local'), null);
  assert.equal(dateToUnix('2024-09-29', 'local'), null);
});

test('both ways agree', () => {
  const back = dateToUnix('2024-09-29T16:53:20', 'local');
  assert.equal(formatInstant(back?.milliseconds ?? 0, KL), '29 Sep 2024, 16:53:20');
});
