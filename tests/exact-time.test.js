import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, dayWord, faceOf, gapOf, isoWeek, offsetOf, placeOf, readTimer, verdictOf } from '../src/lib/lab/exact-time.js';

test("the CDN's timer header reads as when the request arrived and how long it was kept, or not at all", () => {
  const t = readTimer(' S1791374542.156116,VS0,VE270 ');
  assert.ok(Math.abs(t.at - 1791374542156.116) < 0.01);
  assert.equal(t.kept, 270);
  assert.deepEqual(readTimer('S1791374542,VS0,VE0'), { at: 1791374542000, kept: 0 });
  for (const bad of [null, undefined, '', 'garbage', 'S12,VS0', 'VE5']) assert.equal(readTimer(bad), null, String(bad));
});

test("a clock's offset comes from the middle of the trip, sure to within half the time on the road", () => {
  // The device is 1 s behind: sent at 0, it reached the server 40 ms later (1040 on the server's clock), was kept 20 ms
  // and came back 40 ms later, at 100.
  assert.deepEqual(offsetOf({ sent: 0, answered: 100, at: 1040, kept: 20 }), { offset: 1000, within: 40 });
  // The device is 250 ms ahead; a trip faster than the time kept can't be less than nothing.
  assert.deepEqual(offsetOf({ sent: 1000, answered: 1060, at: 775, kept: 10 }), { offset: -250, within: 25 });
  assert.equal(offsetOf({ sent: 0, answered: 5, at: 0, kept: 10 }).within, 0);
});

test('a gap reads as briefly as it reads well', () => {
  assert.deepEqual([90, -1234, 9994, 9996, 12345, 59940, 59960, 125000, 10920000, 97200000, 180000000].map(gapOf), ['0.09 s', '1.23 s', '9.99 s', '10.0 s', '12.3 s', '59.9 s', '1 min 0 s', '2 min 5 s', '3 h 2 min', '1 day 3 h', '2 days 2 h']);
});

test('the verdict: exact within half a second, close within 5, else off, and which way', () => {
  assert.deepEqual(verdictOf(90, 30), { level: 'exact', title: 'Your clock is exact.', detail: "It's 0.09 s behind this site's server (±0.03 s)." });
  assert.equal(verdictOf(-90, 30).detail, "It's 0.09 s ahead of this site's server (±0.03 s).");
  assert.deepEqual(verdictOf(1234, 20), { level: 'close', title: 'Your clock is 1.23 s behind.', detail: "Checked against this site's server (±0.02 s)." });
  assert.equal(verdictOf(-125000, 40).title, 'Your clock is 2 min 5 s ahead.');
  assert.deepEqual([499, 500, 4999, 5000].map((ms) => verdictOf(ms, 0).level), ['exact', 'close', 'close', 'off']);
  // A margin too small to show still reads as one.
  assert.equal(verdictOf(60, 3).detail, "It's 0.06 s behind this site's server (±0.01 s).");
});

test("ISO weeks start on Monday, and week 1 holds the year's first Thursday", () => {
  assert.equal(isoWeek(2026, 10, 7), 41);
  assert.equal(isoWeek(2026, 1, 1), 1);
  assert.equal(isoWeek(2027, 1, 1), 53);
  assert.equal(isoWeek(2024, 12, 30), 1);
  assert.equal(isoWeek(2021, 1, 3), 53);
});

test("the clock's face and the date, in a time zone, on the 24- and 12-hour clocks", () => {
  const evening = Date.UTC(2026, 9, 7, 12, 5, 41);
  assert.deepEqual(faceOf(evening, 'Asia/Kuala_Lumpur'), { hours: '20', minutes: '05', seconds: '41', half: '', date: 'Wednesday, 7 October 2026', week: 41, day: '2026-10-07' });
  assert.deepEqual([faceOf(evening, 'Asia/Kuala_Lumpur', true).hours, faceOf(evening, 'Asia/Kuala_Lumpur', true).half], ['8', 'PM']);
  const midnight = Date.UTC(2026, 9, 7, 16, 0, 0);
  assert.equal(faceOf(midnight, 'Asia/Kuala_Lumpur').hours, '00');
  assert.deepEqual([faceOf(midnight, 'Asia/Kuala_Lumpur', true).hours, faceOf(midnight, 'Asia/Kuala_Lumpur', true).half], ['12', 'AM']);
  assert.equal(faceOf(midnight, 'Asia/Kuala_Lumpur').date, 'Thursday, 8 October 2026');
  assert.equal(faceOf(evening, 'America/Los_Angeles').day, '2026-10-07');
});

test("a city's day next to yours, and the place a time zone is named after", () => {
  assert.deepEqual(['2026-10-06', '2026-10-07', '2026-10-08'].map((d) => dayWord(d, '2026-10-07')), ['Yesterday', 'Today', 'Tomorrow']);
  assert.equal(placeOf('Asia/Kuala_Lumpur'), 'Kuala Lumpur');
  assert.equal(placeOf('America/Argentina/Buenos_Aires'), 'Buenos Aires');
  assert.equal(placeOf('UTC'), 'UTC');
});

test("time.is's six cities, each a real time zone", () => {
  assert.deepEqual(CITIES.map(([name]) => name), ['Los Angeles', 'New York', 'London', 'Paris', 'Beijing', 'Tokyo']);
  for (const [, zone] of CITIES) assert.doesNotThrow(() => faceOf(0, zone), zone);
});
