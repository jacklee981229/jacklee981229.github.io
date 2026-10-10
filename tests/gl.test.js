import { test } from 'node:test';
import assert from 'node:assert/strict';
import { governor, linear, stepper } from '../src/effects/gl.js';

test('the stepper runs the same steps a second at 60, 90 and 120 frames a second', () => {
  for (const rate of [60, 90, 120]) {
    const step = stepper(120, 8);
    let steps = 0;
    for (let i = 0; i < rate * 10; i++) steps += step(1 / rate);
    assert.ok(Math.abs(steps - 1200) <= 1, `${rate} a second: ${steps} steps in 10 s`);
  }
});

test('the stepper never runs more than its most in a frame, and drops what it owes beyond that', () => {
  const step = stepper(120, 4);
  assert.equal(step(1), 4);
  // It doesn't try to catch up on the 116 it couldn't run.
  assert.ok(step(1 / 60) <= 3);
});

/** Feeds a governor `seconds` of frames `gap` ms apart, starting at `from`, and returns the time it got to. */
const feed = (g, from, seconds, gap) => {
  let now = from;
  for (let i = 0; i < (seconds * 1000) / gap; i++) g.tick((now += gap));
  return now;
};

test('the governor leaves a 60, 90 or 120 Hz screen alone', () => {
  for (const gap of [1000 / 60, 1000 / 90, 1000 / 120]) {
    const changes = [];
    const g = governor(4, (r) => changes.push(r));
    feed(g, 0, 20, gap);
    assert.deepEqual(changes, [], `${Math.round(1000 / gap)} Hz`);
  }
});

test('the governor steps down while frames come late, and back up once there is room', () => {
  const changes = [];
  const g = governor(4, (r) => changes.push(r));
  let now = feed(g, 0, 5, 30);
  assert.ok(g.rung >= 1, 'stepped down at 33 a second');
  const lowest = g.rung;
  now = feed(g, now, 30, 1000 / 90);
  assert.ok(g.rung < lowest, 'stepped back up once frames had room');
  assert.ok(changes.length >= 2);
});

test('the governor ignores pauses and holds still while the piece runs slowly on purpose', () => {
  const changes = [];
  const g = governor(4, (r) => changes.push(r));
  let now = feed(g, 0, 3, 1000 / 60);
  // A hidden tab: one long gap.
  now = feed(g, now + 5000, 3, 1000 / 60);
  g.hold(true);
  feed(g, now, 10, 1000 / 30);
  assert.deepEqual(changes, []);
});

test('the governor still steps down when told every frame that it isn\'t held', () => {
  const g = governor(4, () => {});
  let now = 0;
  for (let i = 0; i < 200; i++) {
    g.hold(false);
    g.tick((now += 30));
  }
  assert.ok(g.rung >= 1);
});

test('token colours turn into light\'s own units', () => {
  assert.deepEqual(linear([0, 255, 255]).map((v) => Math.round(v * 1000) / 1000), [0, 1, 1]);
  assert.ok(Math.abs(linear([128, 128, 128])[0] - 0.2158) < 0.001);
});
