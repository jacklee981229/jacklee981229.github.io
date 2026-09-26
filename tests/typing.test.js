import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURSOR_MS, TYPE_MS, typingTimeline } from '../src/lib/typing.js';

const beatsOf = (times) => times.slice(1).map((t, i) => t - times[i]);

test('the whole typing effect, cursor included, fits in 2 seconds', () => {
  assert.ok(TYPE_MS + CURSOR_MS <= 2000);
});

test("Jack's Space types one character at a time, starting at once and ending on time", () => {
  const times = typingTimeline("Jack's Space");
  assert.equal(times.length, 12);
  assert.equal(times[0], 0);
  assert.equal(times.at(-1), TYPE_MS);
  beatsOf(times).forEach((beat) => assert.ok(beat > 0, 'every character comes after the one before'));
});

test('letters come at uneven speeds, with a longer beat around the space', () => {
  const beats = beatsOf(typingTimeline("Jack's Space"));
  const letterBeats = beats.filter((_, i) => i !== 5 && i !== 6); // index 5 leads into the space, 6 leads out of it
  assert.ok(new Set(letterBeats).size > 4, 'the speed varies from letter to letter');
  assert.ok(Math.min(beats[5], beats[6]) > Math.max(...letterBeats), 'the space gets the longest beats');
});

test('a longer title still finishes on time', () => {
  const times = typingTimeline('A much longer site title than today');
  assert.equal(times.at(-1), TYPE_MS);
  assert.equal(typingTimeline('Jack').at(-1), TYPE_MS);
});
