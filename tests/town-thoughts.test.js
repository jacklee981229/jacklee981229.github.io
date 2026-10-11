import { test } from 'node:test';
import assert from 'node:assert/strict';
import { H, newTown, W } from '../src/lib/town/map.js';
import { build, change } from '../src/lib/town/growth.js';
import { startTraffic, STEP } from '../src/lib/town/traffic.js';
import { ANGRY, apart, boxOf, cloudOf, FADE, goingSomewhere, MOST, pullingOut, startThoughts } from '../src/lib/town/thoughts.js';

/** @typedef {ReturnType<typeof startTraffic>} Traffic @typedef {Traffic['cars'][number]} Car */

const CLOUD = cloudOf(1.1);

/** A day's town and its traffic from 7 in the morning, and its bubbles as the page would have them, with the town
 *  lying as it is (not turned) and a town minute passing in a second. @param {number} seed @param {number} [trips] */
function town(seed, trips = 1) {
  const T = newTown(seed);
  build(T);
  const traffic = startTraffic(T, seed, { clock: 7 * 60, trips });
  const where = (/** @type {Car} */ car) => { const p = traffic.pose(car, 1); return { x: p.x, y: p.y }; };
  const thoughts = startThoughts(traffic, seed, { where, bounds: () => ({ w: W, h: H }), cloud: () => CLOUD });
  return { T, traffic, thoughts, where };
}

test('thought bubbles leave the traffic exactly as it would be without them', () => {
  /** @param {boolean} thinking */
  const run = (thinking) => {
    const { traffic, thoughts } = town(20261011);
    for (let n = 0; n < 2 * 60 / STEP; n++) {
      traffic.step();
      if (thinking) {
        thoughts.step(n * STEP, STEP);
        if (n % 500 === 0) { const c = traffic.cars.find((car) => goingSomewhere(car)); if (c) thoughts.think(c, n * STEP); }
      }
    }
    return JSON.stringify(traffic.cars.map((c) => [c.id, c.state, c.F, c.R]));
  };
  assert.equal(run(true), run(false));
});

for (const [seed, trips] of [[20261011, 1], [20261019, 1], [20270305, 3]]) {
  test(`three town hours of bubbles in ${seed}'s town, ${trips > 1 ? 'busy, ' : ''}with taps: only cars going somewhere, the right thought, a few at a time, never touching`, () => {
    const { T, traffic, thoughts, where } = town(seed, trips);
    /** @type {Set<object>} */
    const seen = new Set();
    /** @type {Map<Car, number>} */
    const lastTrip = new Map();
    const count = { thoughts: 0, asked: 0, angry: 0, notDriving: 0, wrong: 0, twice: 0, early: 0, lingering: 0, touching: 0, tooMany: 0, tooAngry: 0 };
    let next = traffic.clock + 120;
    for (let n = 0; n < (3 * 60) / STEP; n++) {
      traffic.step();
      if (traffic.clock >= next) { change(T, n, traffic.inUse()); traffic.after(); next += 120; }
      const now = n * STEP;
      thoughts.step(now, STEP);
      // Now and then someone taps a car: any car in town, or one driving by.
      if (n % 400 === 0) {
        const pool = n % 800 ? traffic.cars.filter((c) => c.state !== 'away') : traffic.cars.filter((c) => goingSomewhere(c));
        if (pool.length) thoughts.think(pool[n % pool.length], now);
      }
      const { bubbles } = thoughts;
      for (const b of bubbles) {
        // A thought of its own only while out on the road; one asked for, while it's going somewhere.
        if (!goingSomewhere(b.car) || (!b.asked && pullingOut(b.car))) count.notDriving++;
        if (b.kind === 'angry' && b.car.waited === 0 && b.until > now + FADE + 1e-9) count.lingering++;
        if (seen.has(b)) continue;
        seen.add(b);
        if (b.kind === 'angry') {
          count.angry++;
          if (b.car.waited <= ANGRY) count.early++;
          continue;
        }
        // What it thinks of is where its trip goes: a building (in that building's colour), home, or out of town.
        const dest = b.car.dest;
        const want = !dest || dest === 'out' ? { kind: 'away', b: null, colour: b.car.colour } : { kind: dest.b === b.car.home ? 'home' : 'place', b: dest.b, colour: dest.b.colour };
        if (b.kind !== want.kind || b.colour !== want.colour || b.b !== want.b || b.trip !== b.car.setOff) count.wrong++;
        if (b.asked) { count.asked++; lastTrip.set(b.car, b.trip); continue; }
        count.thoughts++;
        if (lastTrip.get(b.car) === b.trip) count.twice++;
        lastTrip.set(b.car, b.trip);
      }
      if (bubbles.filter((b) => !b.asked && b.kind !== 'angry').length > MOST) count.tooMany++;
      if (bubbles.filter((b) => b.kind === 'angry').length > 3) count.tooAngry++;
      const boxes = bubbles.map((b) => boxOf(b, where(b.car), CLOUD));
      for (let a = 0; a < boxes.length; a++) for (let c = a + 1; c < boxes.length; c++) if (apart(boxes[a], boxes[c]) <= 0) count.touching++;
    }
    assert.equal(count.notDriving, 0, 'a car thinking with nowhere to go, or a thought of its own while not out on the road');
    assert.equal(count.wrong, 0, 'a thought that is not where the car is going');
    assert.equal(count.twice, 0, 'a car thinking twice in one trip');
    assert.equal(count.early, 0, 'anger before a car had stood still long enough');
    assert.equal(count.lingering, 0, 'anger still showing after its car moved on');
    assert.equal(count.tooMany, 0, `more than ${MOST} thoughts at once`);
    assert.equal(count.tooAngry, 0, 'more than three angry at once');
    assert.equal(count.touching, 0, 'two bubbles touching');
    assert.ok(count.thoughts > 15 && count.asked > 3, `only ${count.thoughts} thoughts and ${count.asked} asked for in three hours`);
  });
}

test('never more than four thoughts at once, however many cars want one', () => {
  const { traffic, thoughts } = town(20261011, 3);
  let most = 0;
  for (let n = 0; n < 30 / STEP; n++) {
    traffic.step();
    // A step this long makes every car that may think want to.
    thoughts.step(n * STEP, 60);
    most = Math.max(most, thoughts.bubbles.filter((b) => !b.asked && b.kind !== 'angry').length);
  }
  assert.equal(most, MOST);
});

test('a tap on a parked car shows nothing; on a driving one, where it\'s going, at once, and nearby bubbles give way', () => {
  const { traffic, thoughts, where } = town(20261011);
  for (let n = 0; n < 20 / STEP; n++) { traffic.step(); thoughts.step(n * STEP, STEP); }
  const now = 20;
  const parked = traffic.cars.find((c) => c.state === 'parked');
  assert.ok(parked, 'a parked car');
  assert.equal(thoughts.think(parked, now), false);
  assert.ok(!thoughts.bubbles.some((b) => b.car === parked));
  const car = traffic.cars.find((c) => goingSomewhere(c) && !pullingOut(c));
  assert.ok(car, 'a driving car');
  assert.equal(thoughts.think(car, now), true);
  const mine = thoughts.bubbles.filter((b) => b.car === car);
  assert.equal(mine.length, 1);
  const dest = car.dest;
  assert.equal(mine[0].kind, !dest || dest === 'out' ? 'away' : dest.b === car.home ? 'home' : 'place');
  assert.ok(mine[0].asked);
  const box = boxOf(mine[0], where(car), CLOUD);
  for (const b of thoughts.bubbles) if (b !== mine[0]) assert.ok(apart(boxOf(b, where(b.car), CLOUD), box) >= 1.1 - 1e-9, 'a bubble stayed too near the asked one');
});
