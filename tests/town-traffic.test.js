import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doorOf, homesOf, newTown, placesOf } from '../src/lib/town/map.js';
import { build, change } from '../src/lib/town/growth.js';
import { bodiesTouch, bodyOf } from '../src/lib/town/roads.js';
import { startTraffic, STEP } from '../src/lib/town/traffic.js';

/** @typedef {ReturnType<typeof startTraffic>} Traffic @typedef {Traffic['cars'][number]} Car */

/** Days whose towns have the awkward places: a busy junction where cars go another way, a flyover, whose ends are
 *  junctions with roads to two sides, and a junction gone to a corner (a home and its road came down) under a car
 *  turning there. */
const DAYS = [20261011, 20261012, 20261019, 20261032, 20270305];
/** The town changes every two town hours: more often than on the page, which changes it about every three. */
const EVERY = 120;

/**
 * Runs a day's town for `hours` town hours from 7 in the morning, changing it every two hours, and looks at every step:
 * cars touching, the longest any car stands on the road, and inside a box (which it should never stop in), the longest
 * one waits in its drive or bay to pull out, the longest trip, and (with `watch`) each car's every step.
 * @param {number} seed @param {number} hours @param {number} [trips] @param {(car: Car, was: { state: string, F: number[], R: number[] }) => void} [watch]
 */
function run(seed, hours, trips = 1, watch) {
  const T = newTown(seed);
  build(T);
  const traffic = startTraffic(T, seed, { clock: 7 * 60, trips });
  let next = traffic.clock + EVERY, touching = 0, stand = 0, inBox = 0, pullOut = 0, trip = 0;
  /** How long each car has stood still inside a box. @type {Map<Car, number>} */
  const still = new Map();
  /** @type {Map<Car, { state: string, F: number[], R: number[] }>} */
  const before = new Map();
  for (let n = 0; n < (hours * 60) / STEP; n++) {
    traffic.step();
    let changed = false;
    if (traffic.clock >= next) { change(T, n, traffic.inUse()); traffic.after(); next += EVERY; changed = true; }
    const here = traffic.cars.filter((c) => c.state !== 'away');
    for (const c of here) {
      if (c.state === 'driving') {
        const inSpot = c.k === 0 && c.s === 0 && c.legs[0].kind === 'move' && c.legs[0].move.kind === 'leave';
        if (inSpot) pullOut = Math.max(pullOut, c.waited); else stand = Math.max(stand, c.waited);
        trip = Math.max(trip, traffic.clock - c.setOff);
        const t = !inSpot && c.legs[c.k].kind === 'move' && c.v < 0.02 ? (still.get(c) ?? 0) + STEP : 0;
        still.set(c, t);
        inBox = Math.max(inBox, t);
      }
      const was = before.get(c);
      if (watch && was && !changed) watch(c, was);
      before.set(c, { state: c.state, F: c.F, R: c.R });
    }
    // A car out of town comes back in by a road out of town: it's not where it was.
    for (const c of traffic.cars) if (c.state === 'away') before.delete(c);
    for (let i = 0; i < here.length; i++) {
      for (let j = i + 1; j < here.length; j++) {
        const a = here[i], b = here[j];
        if (a.up !== b.up || Math.abs(a.F[0] - b.F[0]) + Math.abs(a.F[1] - b.F[1]) > 1) continue;
        if (bodiesTouch(bodyOf(a.F, a.R), bodyOf(b.F, b.R), -0.002)) touching++;
      }
    }
  }
  return { traffic, touching, stand, inBox, pullOut, trip };
}

test('over a town day, with the town changing every two hours, cars never touch, nobody is held up long and no car is lost', () => {
  for (const seed of DAYS) {
    const { traffic, touching, stand, inBox, pullOut, trip } = run(seed, 24);
    assert.equal(touching, 0, `${seed}: cars touched`);
    assert.ok(inBox < 1, `${seed}: a car stood ${inBox.toFixed(1)} town minutes inside a box`);
    assert.equal(traffic.stats.guarded, 0, `${seed}: a car had to be stopped from running into another`);
    assert.equal(traffic.stats.dropped, 0, `${seed}: a car was lost when the town changed`);
    assert.ok(stand < 45, `${seed}: a car stood ${stand.toFixed(1)} town minutes on the road`);
    assert.ok(pullOut < 75, `${seed}: a car waited ${pullOut.toFixed(1)} town minutes to pull out`);
    assert.ok(trip < 150, `${seed}: a trip took ${trip.toFixed(1)} town minutes`);
    assert.ok(traffic.stats.arrived > 300, `${seed}: only ${traffic.stats.arrived} trips arrived`);
  }
});

test('with three times the trips, the town still flows', () => {
  for (const seed of [20261011, 20261016]) {
    const { traffic, touching, stand, inBox, pullOut } = run(seed, 24, 3);
    assert.equal(touching, 0, `${seed}: cars touched`);
    assert.ok(inBox < 1, `${seed}: a car stood ${inBox.toFixed(1)} town minutes inside a box`);
    assert.equal(traffic.stats.guarded, 0, `${seed}: a car had to be stopped from running into another`);
    assert.ok(stand < 45, `${seed}: a car stood ${stand.toFixed(1)} town minutes on the road`);
    assert.ok(pullOut < 90, `${seed}: a car waited ${pullOut.toFixed(1)} town minutes to pull out`);
  }
});

test('a car\'s back wheels follow its front ones, never sliding sideways, and it turns into its spot smoothly to the end', () => {
  let steps = 0, parks = 0;
  run(DAYS[0], 12, 1, (car, was) => {
    if (was.state !== 'driving') return;
    const heading = (/** @type {number[]} */ f, /** @type {number[]} */ r) => { const x = f[0] - r[0], y = f[1] - r[1], l = Math.hypot(x, y); return [x / l, y / l]; };
    const u = heading(was.F, was.R), v = heading(car.F, car.R);
    if (car.state === 'parked') {
      // The last step into the spot turns the car no more than the steps before it did: no straightening at once.
      parks++;
      assert.ok(Math.acos(Math.min(1, u[0] * v[0] + u[1] * v[1])) < (6 * Math.PI) / 180, `car ${car.id} swung into its spot`);
      return;
    }
    if (car.state !== 'driving') return;
    const dx = car.R[0] - was.R[0], dy = car.R[1] - was.R[1], moved = Math.hypot(dx, dy);
    if (moved < 1e-5) return;
    steps++;
    const mx = u[0] + v[0], my = u[1] + v[1], ml = Math.hypot(mx, my);
    const sideways = Math.abs(dx * (my / ml) - dy * (mx / ml));
    assert.ok(sideways <= 0.12 * moved + 1e-4, `car ${car.id}'s back slid ${sideways.toFixed(4)} sideways moving ${moved.toFixed(4)}`);
  });
  assert.ok(steps > 10000 && parks > 100, `${steps} steps and ${parks} parkings watched`);
});

test('a car driving out of a building, or into one, as it comes down carries on out of it', () => {
  const seed = DAYS[0], T = newTown(seed);
  build(T);
  const traffic = startTraffic(T, seed, { clock: 7 * 60, trips: 3 });
  /** @type {Car | undefined} */
  let leaving, parking;
  for (let n = 0; n < 3 * 60 / STEP && !(leaving && parking); n++) {
    traffic.step();
    for (const c of traffic.cars) {
      const leg = c.legs[c.k];
      if (c.state !== 'driving' || !leg || (leg.kind !== 'move' && leg.kind !== 'rear')) continue;
      if (!leaving && leg.move.kind === 'leave' && c.s > 0.1 && 'b' in leg.move.from && leg.move.from.b.kind === 'home') leaving = c;
      if (!parking && leg.kind === 'rear' && 'b' in leg.move.to && leg.move.to.b.kind === 'place') parking = c;
    }
  }
  assert.ok(leaving && parking, 'found a car leaving its home and one parking at a building');
  const gone = [leaving, parking].map((c) => { const leg = /** @type {{ move: import('../src/lib/town/roads.js').Move }} */ (c.legs[c.k]); return 'b' in leg.move.from ? leg.move.from.b : /** @type {import('../src/lib/town/roads.js').Spot} */ (leg.move.to).b; });
  // Both buildings come down, as the town would take them away.
  for (const b of gone) {
    for (const t of b.kind === 'home' ? [b.tile] : b.tiles) T.use[t] = -1;
    T.fronts[doorOf(b)]--;
    T.buildings.delete(b.id);
  }
  traffic.after();
  assert.equal(traffic.stats.dropped, 0, 'a car was lost');
  for (let n = 0; n < 60 / STEP; n++) traffic.step();
  assert.ok(!traffic.cars.includes(leaving) || leaving.state !== 'parked' || leaving.spot?.b !== gone[0], 'the car is still at the home that came down');
  assert.ok(!traffic.cars.includes(parking) || parking.state !== 'parked' || parking.spot?.b !== gone[1], 'the car is still at the building that came down');
  assert.ok(homesOf(T).length && placesOf(T).length);
});

test('the same day plays out the same', () => {
  /** @param {Traffic} traffic */
  const where = (traffic) => JSON.stringify(traffic.cars.map((c) => [c.id, c.state, c.F, c.R]));
  assert.equal(where(run(DAYS[1], 3).traffic), where(run(DAYS[1], 3).traffic));
});
