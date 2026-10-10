import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEPTH, easeStrength, fieldPull, fieldShare, fieldSq, FINGER_LIFT, HELD, keepInside, LIFTED, onset, ONSET_MOST, REACH, REST, strengthGoal, wander } from '../src/lib/magnet.js';

const near = (a, b, within = 1e-9) => Math.abs(a - b) <= within * Math.max(1, Math.abs(b));

test('the field peaks right over the magnet at 4 / z⁶ and falls away the same way in every direction', () => {
  for (const z of [0.3, 0.5, 1]) assert.ok(near(fieldSq(0, z), 4 / z ** 6), `z ${z}`);
  assert.equal(fieldShare(0), 1);
  let last = Infinity;
  for (let r = 0; r <= 2; r += 0.05) {
    const here = fieldSq(r * r);
    assert.ok(here < last, `still falling at ${r.toFixed(2)}`);
    last = here;
    // The same distance in any direction gives the same field.
    for (const a of [0.3, 1.9, 4]) assert.ok(near(fieldShare((r * Math.cos(a)) ** 2 + (r * Math.sin(a)) ** 2), fieldShare(r * r)));
  }
});

test('the pull always points towards the magnet, and is the field\'s own slope', () => {
  for (const [x, y] of [[0.2, 0], [-0.4, 0.3], [0.05, -0.7], [1.2, 0.9]]) {
    const [px, py] = fieldPull(x, y);
    // Inwards: against the way out from the magnet.
    assert.ok(px * x + py * y < 0, `at ${x}, ${y}`);
    // Parallel to the way in: no sideways part.
    assert.ok(Math.abs(px * y - py * x) < 1e-9);
    // And it is the slope: compare with a small step.
    const h = 1e-6;
    const slope = (fieldShare((x + h) ** 2 + y * y) - fieldShare((x - h) ** 2 + y * y)) / (2 * h);
    assert.ok(Math.abs(slope - px) < 1e-5, `slope at ${x}, ${y}: ${slope} vs ${px}`);
  }
  assert.deepEqual(fieldPull(0, 0).map(Math.abs), [0, 0]);
});

test('the onset: spikes over the magnet at rest strength, a wider crown held down, none far off or with the field off', () => {
  assert.ok(onset(1, REST) > 0, 'spikes right over the magnet');
  assert.ok(onset(fieldShare(1), REST) < 0, 'flat at the far side of the dish');
  assert.ok(onset(1, 0) === -1, 'flat everywhere with the field off');
  // Held down, the crown reaches further out.
  const reach = (m) => {
    let r = 0;
    while (onset(fieldShare(r * r), m) > 0) r += 0.001;
    return r;
  };
  assert.ok(reach(HELD) > reach(REST) * 1.3, `${reach(HELD)} vs ${reach(REST)}`);
  // It eases off, so the spikes stand apart instead of joining into ridges.
  assert.ok(onset(1, 3) <= ONSET_MOST && onset(1, 3) > 0.9 * ONSET_MOST);
});

test('holding turns the magnet up within half a second, letting go brings it back, and a lifted finger turns it off', () => {
  const run = (from, input, seconds) => {
    let m = from;
    for (let t = 0; t < seconds; t += 1 / 120) m = easeStrength(m, strengthGoal(input), 1 / 120);
    return m;
  };
  assert.ok(run(REST, { down: true, touch: false, sinceLift: 9 }, 0.5) > REST + 0.9 * (HELD - REST), 'held');
  assert.ok(Math.abs(run(HELD, { down: false, touch: false, sinceLift: 9 }, 0.6) - REST) < 0.02, 'let go');
  assert.ok(run(HELD, { down: false, touch: true, sinceLift: 0 }, 0.5) < 0.05, 'finger lifted: off');
  assert.equal(strengthGoal({ down: false, touch: true, sinceLift: LIFTED - 0.1 }), 0);
  assert.equal(strengthGoal({ down: false, touch: true, sinceLift: LIFTED + 0.1 }), REST, 'then the wander takes over');
  assert.equal(strengthGoal({ down: false, touch: false, sinceLift: 0 }), REST, 'a mouse never turns it off');
  assert.ok(FINGER_LIFT > 0);
});

test('the wander stays inside the dish, starts on the left heading right, and never quite repeats', () => {
  let most = 0;
  for (let t = 0; t < 600; t += 0.1) most = Math.max(most, Math.hypot(...wander(t)));
  assert.ok(most < REACH, `reaches ${most}`);
  assert.ok(wander(0)[0] < -0.3 && wander(0.5)[0] > wander(0)[0]);
  // Back at the start's place later on, it's never also heading the same way at the same speed.
  const [x0, y0] = wander(0);
  const [vx0, vy0] = wander(0.01).map((v, i) => v - [x0, y0][i]);
  for (let t = 5; t < 600; t += 0.01) {
    const [x, y] = wander(t);
    if (Math.hypot(x - x0, y - y0) > 0.01) continue;
    const [vx, vy] = wander(t + 0.01).map((v, i) => v - [x, y][i]);
    assert.ok(Math.hypot(vx - vx0, vy - vy0) > 1e-4, `repeats at ${t.toFixed(2)}`);
  }
});

test('a point is kept inside the reach, sliding along its edge, and left alone well inside', () => {
  assert.deepEqual(keepInside(0.1, -0.2), [0.1, -0.2]);
  for (const r of [0.6, 0.7, 1, 5]) {
    const [x, y] = keepInside(r * 0.6, r * 0.8);
    assert.ok(Math.hypot(x, y) <= REACH + 1e-12, `${r}`);
    assert.ok(Math.abs(Math.atan2(y, x) - Math.atan2(0.8, 0.6)) < 1e-12, 'same direction');
  }
  // Further out is never kept closer in.
  assert.ok(Math.hypot(...keepInside(0.9, 0)) >= Math.hypot(...keepInside(0.7, 0)));
  assert.ok(DEPTH > 0);
});
