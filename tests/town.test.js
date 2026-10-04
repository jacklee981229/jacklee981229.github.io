import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTown, CAR_LENGTH, CAR_WIDTH, COLOURS } from '../src/lib/town/layout.js';
import { carPlace, startTraffic, STEP, STUCK } from '../src/lib/town/sim.js';

const DAY = 24 * 60 * 60;
const TOWNS = [[8, 4, 1], [6, 4, 2], [10, 5, 3], [4, 3, 4]];
const inTown = (traffic) => traffic.cars.filter((c) => c.mode !== 'away');

/** Whether two cars' bodies overlap: two turned boxes, tested along each box's sides. */
function touching(a, b) {
  if (Math.hypot(a.x - b.x, a.y - b.y) > CAR_LENGTH * 1.2) return false;
  const half = [CAR_LENGTH / 2 - 0.002, CAR_WIDTH / 2 - 0.002];
  const axes = (p) => [[Math.cos(p.angle), Math.sin(p.angle)], [-Math.sin(p.angle), Math.cos(p.angle)]];
  const reach = (p, [x, y]) => axes(p).reduce((sum, [ax, ay], i) => sum + half[i] * Math.abs(ax * x + ay * y), 0);
  return [...axes(a), ...axes(b)].every(([x, y]) => Math.abs((b.x - a.x) * x + (b.y - a.y) * y) < reach(a, [x, y]) + reach(b, [x, y]));
}

/** How far a point is outside the town's own ground (0 inside it). */
const outside = (town, p) => Math.max(0, -p.x, p.x - town.cols, -p.y, p.y - town.rows);

test('a town is the same for the same seed, and different for another', () => {
  const shape = (t) => JSON.stringify([t.roads.map(([a, b]) => [a.id, b.id]), t.gates.map((g) => g.at.id), t.buildings.map((b) => [b.kind, b.colour, b.lane.id])]);
  assert.equal(shape(buildTown(8, 4, 7)), shape(buildTown(8, 4, 7)));
  assert.notEqual(shape(buildTown(8, 4, 7)), shape(buildTown(8, 4, 8)));
});

test('every junction has two roads or more, and every lane can be driven to from every other', () => {
  for (const [cols, rows, seed] of [...TOWNS, [12, 6, 5], [3, 2, 6]]) {
    const town = buildTown(cols, rows, seed);
    for (const j of town.junctions) assert.ok(j.lanesIn.length >= 2, `junction ${j.id} of ${cols}x${rows}`);
    // Lanes into town only start trips and lanes out only end them.
    const ins = new Set(town.gates.map((g) => g.in));
    const outs = new Set(town.gates.map((g) => g.out));
    for (const a of town.lanes) for (const b of town.lanes) if (!outs.has(a) && !ins.has(b)) assert.ok(town.next.get(a)?.has(b), `${cols}x${rows}: lane ${a.id} to ${b.id}`);
  }
});

test('one to three roads out of town, each from a junction on the edge, straight out past it', () => {
  for (const [cols, rows, seed] of [...TOWNS, [12, 6, 5], [3, 2, 6]]) {
    const town = buildTown(cols, rows, seed);
    assert.ok(town.gates.length >= 1 && town.gates.length <= 3, `${town.gates.length} roads out`);
    assert.equal(new Set(town.gates.map((g) => `${g.dir.x},${g.dir.y}`)).size, town.gates.length, 'one a side');
    for (const g of town.gates) {
      assert.ok(outside(town, g.end) >= 1, 'it ends past the edge');
      assert.equal(g.in.from, g.end);
      assert.equal(g.out.to, g.end);
      assert.ok(g.at.light, 'the junction it meets has lights');
    }
  }
});

test('lights where three or four roads meet; eight places in four colours with three bays, homes with one', () => {
  const town = buildTown(8, 4, 1);
  for (const j of town.junctions) assert.equal(Boolean(j.light), j.lanesIn.length >= 3);
  const places = town.buildings.filter((b) => b.kind === 'place');
  assert.equal(COLOURS, 4);
  assert.deepEqual(places.map((p) => p.colour).sort(), [0, 0, 1, 1, 2, 2, 3, 3]);
  for (const p of places) assert.equal(p.bays.length, 3);
  const homes = town.buildings.filter((b) => b.kind === 'home');
  for (const h of homes) assert.equal(h.bays.length, 1);
  assert.deepEqual([...new Set(homes.map((h) => h.colour))].sort(), [0, 1, 2, 3]);
  // Each building on a lane of its own, none on a road out of town.
  const out = new Set(town.gates.flatMap((g) => [g.in, g.out]));
  assert.equal(new Set(town.buildings.map((b) => b.lane)).size, town.buildings.length);
  for (const b of town.buildings) assert.ok(!out.has(b.lane));
});

test('the same seed plays out the same', () => {
  const run = () => {
    const traffic = startTraffic(buildTown(6, 4, 5), 5);
    for (let i = 0; i < 6000; i++) traffic.step();
    return JSON.stringify(traffic.cars.map((c) => [c.id, c.mode, c.part, c.s.toFixed(6), c.back.toFixed(6), c.to?.lane.id ?? -1]));
  };
  assert.equal(run(), run());
});

test('cars glide: in and out of bays, round the town, in and out of it; none jumps, none appears or vanishes in sight', () => {
  for (const [cols, rows, seed] of TOWNS) {
    const traffic = startTraffic(buildTown(cols, rows, seed), seed);
    let was = new Map(inTown(traffic).map((c) => [c, carPlace(c)]));
    let biggest = 0;
    let sharpest = 0;
    let nearestComing = Infinity;
    let nearestGoing = Infinity;
    const seen = new Set();
    for (let i = 0; i < (3 * 3600) / STEP; i++) {
      traffic.step();
      const now = new Map(inTown(traffic).map((c) => [c, carPlace(c)]));
      for (const [car, place] of now) {
        seen.add(car.mode);
        const before = was.get(car);
        if (!before) {
          nearestComing = Math.min(nearestComing, outside(traffic.town, place));
          continue;
        }
        biggest = Math.max(biggest, Math.hypot(place.x - before.x, place.y - before.y));
        let turn = Math.abs(place.angle - before.angle);
        if (turn > Math.PI) turn = Math.PI * 2 - turn;
        sharpest = Math.max(sharpest, turn);
      }
      for (const [car, place] of was) if (!now.has(car)) nearestGoing = Math.min(nearestGoing, outside(traffic.town, place));
      was = now;
    }
    for (const mode of ['backing', 'driving', 'parked']) assert.ok(seen.has(mode), mode);
    // The fastest a car goes is 0.42 blocks a second: about 0.021 a step.
    assert.ok(biggest < 0.03, `${cols}x${rows}: a car jumped ${biggest.toFixed(3)}`);
    assert.ok(sharpest < 0.3, `${cols}x${rows}: a car swung ${sharpest.toFixed(2)} radians in one step`);
    assert.ok(nearestComing >= 1, `${cols}x${rows}: a car appeared ${nearestComing.toFixed(2)} outside the town`);
    assert.ok(nearestGoing >= 1, `${cols}x${rows}: a car vanished ${nearestGoing.toFixed(2)} outside the town`);
  }
});

for (const [cols, rows, seed] of TOWNS) {
  test(`24 hours of a ${cols} by ${rows} town (seed ${seed}): cars come and go; nobody stuck, touching or crossing on red`, () => {
    const traffic = startTraffic(buildTown(cols, rows, seed), seed);
    const residents = traffic.cars.length;
    let overlaps = 0;
    let bumper = Infinity;
    let fewest = Infinity;
    let most = 0;
    for (let i = 0; i < DAY / STEP; i++) {
      traffic.step();
      if (i % 10) continue;
      const cars = inTown(traffic);
      fewest = Math.min(fewest, cars.length);
      most = Math.max(most, cars.length);
      const places = cars.map(carPlace);
      for (let a = 0; a < places.length; a++) for (let b = a + 1; b < places.length; b++) if (touching(places[a], places[b])) overlaps++;
      for (const lane of traffic.town.lanes) {
        const driving = lane.cars.filter((c) => c.mode === 'driving' && c.route[c.part] === lane);
        for (let k = 1; k < driving.length; k++) bumper = Math.min(bumper, driving[k - 1].s - driving[k].s);
      }
    }
    const { stats, cars } = traffic;
    assert.equal(stats.removed, 0, 'cars taken off the road');
    assert.ok(stats.longestStill < STUCK, `longest stop ${stats.longestStill.toFixed(1)}s`);
    assert.ok(stats.longestWait < STUCK, `longest wait to back out ${stats.longestWait.toFixed(1)}s`);
    assert.equal(stats.crossed.stop, 0, 'crossings on red');
    assert.equal(overlaps, 0, 'cars touching');
    assert.ok(bumper >= CAR_LENGTH, `bumper to bumper ${bumper.toFixed(3)}`);
    // Visitors came and went, residents went out of town and came back, and the town's count kept changing.
    assert.ok(stats.visitors > 100 && stats.left > 100, `${stats.visitors} visitors, ${stats.left} left town`);
    assert.ok(most - fewest >= 4, `between ${fewest} and ${most} cars in town`);
    assert.equal(cars.filter((c) => !c.visitor).length, residents);
    // Every trip set off is finished, except those still under way at the end.
    assert.equal(stats.trips - stats.done, cars.filter((c) => c.mode === 'driving' || c.mode === 'backing').length);
    assert.ok(stats.done > residents * 80, `${stats.done} trips in a day`);
    // Each bay holds at most its one car, and every parked car is in the bay that says so.
    for (const car of cars) if (car.mode === 'parked') assert.equal(car.bay.car, car);
    for (const bay of traffic.town.buildings.flatMap((b) => b.bays)) if (bay.car) assert.equal(bay.car.bay, bay);
  });
}
