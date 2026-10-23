import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampView, wheelFactor, zoomAt, ZOOM_MAX } from '../src/lib/zoom.js';
import { clampSplit, settleSplit, splitAt, SNAP_PX } from '../src/lib/split.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
/** The picture's own point under (px, py) of the window. */
const under = (v, px, py) => [(px - v.x) / v.s, (py - v.y) / v.s];

test('zooming keeps the point under the pointer where it is', () => {
  let v = { s: 1, x: 0, y: 0 };
  const [w, h, px, py] = [1000, 400, 300, 160];
  const before = under(v, px, py);
  for (let i = 0; i < 6; i++) v = zoomAt(v, px, py, v.s * wheelFactor(-120), w, h);
  assert.ok(v.s > 2.5);
  const after = under(v, px, py);
  close(after[0], before[0], 1e-6);
  close(after[1], before[1], 1e-6);
});

test('zoom stays between 100% and 600%', () => {
  assert.equal(zoomAt({ s: 5, x: -100, y: -100 }, 10, 10, 99, 100, 100).s, ZOOM_MAX);
  const out = zoomAt({ s: 2, x: -50, y: -20 }, 10, 10, 0.1, 100, 100);
  assert.deepEqual(out, { s: 1, x: 0, y: 0 });
});

test('the picture never moves past its edges', () => {
  assert.deepEqual(clampView({ s: 2, x: 50, y: -900 }, 100, 80), { s: 2, x: 0, y: -80 });
  assert.deepEqual(clampView({ s: 1, x: -5, y: 5 }, 100, 80), { s: 1, x: 0, y: 0 });
  // Zooming at a corner keeps it in, too.
  const v = zoomAt({ s: 1, x: 0, y: 0 }, 0, 0, 3, 100, 80);
  assert.deepEqual(v, { s: 3, x: 0, y: 0 });
});

test('a touchpad pinch zooms more per unit than a mouse wheel', () => {
  assert.ok(wheelFactor(-10, true) > wheelFactor(-10));
  close(wheelFactor(0), 1);
  assert.ok(wheelFactor(100) < 1);
});

test('the line follows the pointer, kept between 20% and 80%', () => {
  // 1000 px of room from 0, a 24 px gap: the pointer in the gap's middle at 512 is the middle.
  close(splitAt(512, 0, 1000, 24), 0.5);
  close(splitAt(312, 0, 1000, 24), 0.3);
  assert.equal(splitAt(-500, 0, 1000, 24), 0.2);
  assert.equal(splitAt(5000, 0, 1000, 24), 0.8);
  assert.equal(clampSplit(0.81), 0.8);
});

test('let go near the middle, it settles there; further off, it stays', () => {
  assert.equal(settleSplit(0.5 - (SNAP_PX - 1) / 1000, 1000), 0.5);
  assert.equal(settleSplit(0.5 + (SNAP_PX - 1) / 1000, 1000), 0.5);
  close(settleSplit(0.47, 1000), 0.47);
});
