import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTown, CAR_LENGTH, CAR_WIDTH, COLOURS } from '../src/lib/town/layout.js';
import { carPlace, startTraffic, STEP, STUCK } from '../src/lib/town/sim.js';
import { ANGRY, apart, boxOf, FADE, goingSomewhere, startThoughts } from '../src/lib/town/thoughts.js';

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

test('24 hours of a 12 by 5 town whose queues used to lock up (168 cars taken off before detours): nobody stuck', () => {
  const traffic = startTraffic(buildTown(12, 5, 1), 1);
  for (let i = 0; i < DAY / STEP; i++) traffic.step();
  assert.equal(traffic.stats.removed, 0, 'cars taken off the road');
  assert.ok(traffic.stats.longestStill < STUCK, `longest stop ${traffic.stats.longestStill.toFixed(1)}s`);
  assert.equal(traffic.stats.crossed.stop, 0, 'crossings on red');
});

// Thought bubbles (W5).
test('thought bubbles leave the traffic exactly as it would be without them', () => {
  const run = (thinking) => {
    const traffic = startTraffic(buildTown(6, 4, 5), 5);
    const thoughts = thinking ? startThoughts(traffic, 5) : null;
    for (let i = 0; i < 6000; i++) {
      traffic.step();
      thoughts?.step();
    }
    return JSON.stringify(traffic.cars.map((c) => [c.id, c.mode, c.part, c.s.toFixed(6), c.back.toFixed(6), c.to?.lane.id ?? -1]));
  };
  assert.equal(run(true), run(false));
});

for (const [cols, rows, seed] of TOWNS) {
  test(`three hours of thought bubbles in a ${cols} by ${rows} town, with clicks: only cars going somewhere, the right thought, a few at a time, never touching`, () => {
    const traffic = startTraffic(buildTown(cols, rows, seed), seed);
    const thoughts = startThoughts(traffic, seed);
    const seen = new Set();
    const lastTrip = new Map();
    const count = { thoughts: 0, asked: 0, angry: 0, notDriving: 0, wrong: 0, twice: 0, early: 0, lingering: 0, touching: 0, tooMany: 0, tooAngry: 0 };
    for (let i = 0; i < (3 * 3600) / STEP; i++) {
      traffic.step();
      thoughts.step();
      // Now and then someone clicks a car, any car in town.
      if (i % 740 === 0) {
        const inTown = traffic.cars.filter((c) => c.mode !== 'away');
        thoughts.think(inTown[i % inTown.length]);
      }
      const { bubbles } = thoughts;
      for (const b of bubbles) {
        // A thought of its own only while driving; one asked for, while it's going somewhere.
        if (b.asked ? !goingSomewhere(b.car) : b.car.mode !== 'driving') count.notDriving++;
        if (b.kind === 'angry' && b.car.still === 0 && b.until > traffic.time + FADE + 1e-9) count.lingering++;
        if (seen.has(b)) continue;
        seen.add(b);
        if (b.kind === 'angry') {
          count.angry++;
          if (b.car.still <= ANGRY) count.early++;
          continue;
        }
        // What it thinks of is where its trip goes: its place (in that place's colour), home, or out of town.
        const car = b.car;
        const want = car.exit ? ['away', car.colour] : car.to.building === car.home ? ['home', car.home.colour] : ['place', car.to.building.colour];
        if (b.kind !== want[0] || b.colour !== want[1] || b.trip !== car.route) count.wrong++;
        if (b.asked) {
          count.asked++;
          lastTrip.set(car, b.trip);
          continue;
        }
        count.thoughts++;
        if (lastTrip.get(car) === b.trip) count.twice++;
        lastTrip.set(car, b.trip);
      }
      if (bubbles.filter((b) => !b.asked && b.kind !== 'angry').length > thoughts.most) count.tooMany++;
      if (bubbles.filter((b) => b.kind === 'angry').length > 3) count.tooAngry++;
      const boxes = bubbles.map((b) => boxOf(b, carPlace(b.car)));
      for (let a = 0; a < boxes.length; a++) for (let c = a + 1; c < boxes.length; c++) if (apart(boxes[a], boxes[c]) <= 0) count.touching++;
    }
    assert.ok(count.thoughts > 300 && count.asked > 5, `only ${count.thoughts} thoughts and ${count.asked} asked for in three hours`);
    assert.equal(count.notDriving, 0, 'a car thinking with nowhere to go, or a thought of its own while not driving');
    assert.equal(count.wrong, 0, 'a thought that is not where the car is going');
    assert.equal(count.twice, 0, 'a car thinking twice in one trip');
    assert.equal(count.early, 0, 'anger before a car had stood still long enough');
    assert.equal(count.lingering, 0, 'anger still showing after its car moved on');
    assert.equal(count.tooMany, 0, `more than ${thoughts.most} thoughts at once`);
    assert.equal(count.tooAngry, 0, 'more than three angry at once');
    assert.equal(count.touching, 0, 'two bubbles touching');
  });
}

test('a car stuck in a jam is angry until it moves on, then its anger fades', () => {
  const traffic = startTraffic(buildTown(8, 4, 1), 1);
  const thoughts = startThoughts(traffic, 1);
  for (let i = 0; i < 600; i++) traffic.step();
  // A driving car well inside the town, held still as long as a jam would (only the bubbles move on meanwhile).
  const car = traffic.cars.find((c) => c.mode === 'driving' && c.route[c.part].kind === 'lane' && (({ x, y }) => x > 1 && y > 1 && x < 7 && y < 3)(carPlace(c)));
  car.still = ANGRY - 0.5;
  for (let i = 0; i < 5; i++) thoughts.step();
  assert.ok(!thoughts.bubbles.some((b) => b.car === car && b.kind === 'angry'), 'angry too soon');
  car.still = ANGRY + 0.5;
  thoughts.step();
  const angry = thoughts.bubbles.find((b) => b.car === car);
  assert.equal(angry?.kind, 'angry', 'not angry after standing still longer than a red light');
  assert.equal(angry.until, Infinity, 'anger that ends by itself');
  car.still = 0;
  thoughts.step();
  assert.ok(angry.until <= traffic.time + FADE, 'anger not fading once the car moved on');
});

// Add car and Remove car.
test('Add car and Remove car: cars sent away leave town for good; cars brought in come from outside to live in empty homes, or stay', () => {
  for (const [cols, rows, seed] of [[8, 4, 1], [6, 4, 2], [4, 3, 4]]) {
    const traffic = startTraffic(buildTown(cols, rows, seed), seed);
    const homes = traffic.town.buildings.filter((b) => b.kind === 'home');
    const run = (seconds) => { for (let i = 0; i < seconds / STEP; i++) traffic.step(); };
    run(10);
    // A few parked cars sent away: they back out, drive out of town and are gone, and their homes stand empty.
    const gone = Array.from({ length: Math.min(5, Math.floor(homes.length / 3)) }, () => traffic.removeCar());
    assert.ok(gone.every((c) => c && c.leaving && c.exit), `${cols}x${rows}: Remove car found no parked car`);
    run(240);
    assert.ok(gone.every((c) => !traffic.cars.includes(c)), `${cols}x${rows}: a car sent away is still in town`);
    const empty = homes.filter((h) => !traffic.cars.some((c) => c.home === h));
    assert.ok(empty.length >= gone.filter((c) => c.home).length, `${cols}x${rows}: only ${empty.length} empty homes`);
    // As many brought in as the town takes: one for each empty home, and half as many again as there are homes.
    let added = 0;
    while (traffic.addCar()) added++;
    assert.equal(added, empty.length + Math.round(homes.length / 2), `${cols}x${rows}: Add car stopped at ${added}`);
    run(240);
    for (const h of homes) assert.ok(traffic.cars.some((c) => c.home === h && !c.leaving), `${cols}x${rows}: a home still empty`);
    const stayers = traffic.cars.filter((c) => c.stays);
    assert.equal(stayers.length, Math.round(homes.length / 2), `${cols}x${rows}: ${stayers.length} cars stayed`);
  }
});

for (const [cols, rows, seed] of [[8, 4, 1], [4, 3, 4]]) {
  test(`three busy hours in a ${cols} by ${rows} town, filled up with Add car and stirred with Remove car: nobody stuck, touching or crossing on red; cars come and go out of sight`, () => {
    const traffic = startTraffic(buildTown(cols, rows, seed), seed);
    while (traffic.addCar());
    let was = new Map(inTown(traffic).map((c) => [c, carPlace(c)]));
    let nearestComing = Infinity;
    let nearestGoing = Infinity;
    let overlaps = 0;
    let most = 0;
    for (let i = 0; i < (3 * 3600) / STEP; i++) {
      traffic.step();
      // Every two minutes a car is sent away, and a minute later one is brought in.
      if (i % 2400 === 1200) traffic.removeCar();
      if (i % 2400 === 0) traffic.addCar();
      const now = new Map(inTown(traffic).map((c) => [c, carPlace(c)]));
      for (const [car, place] of now) if (!was.has(car)) nearestComing = Math.min(nearestComing, outside(traffic.town, place));
      for (const [car, place] of was) if (!now.has(car)) nearestGoing = Math.min(nearestGoing, outside(traffic.town, place));
      was = now;
      most = Math.max(most, now.size);
      if (i % 10) continue;
      const places = [...now.values()];
      for (let a = 0; a < places.length; a++) for (let b = a + 1; b < places.length; b++) if (touching(places[a], places[b])) overlaps++;
    }
    const { stats } = traffic;
    assert.ok(nearestComing >= 1 && nearestGoing >= 1, 'a car appeared or vanished in sight');
    assert.equal(overlaps, 0, 'cars touching');
    assert.equal(stats.removed, 0, 'cars taken off the road');
    assert.equal(stats.crossed.stop, 0, 'crossings on red');
    assert.ok(stats.longestStill < STUCK, `longest stop ${stats.longestStill.toFixed(1)}s`);
    assert.ok(stats.longestWait < STUCK, `longest wait to back out ${stats.longestWait.toFixed(1)}s`);
    const homes = traffic.town.buildings.filter((b) => b.kind === 'home').length;
    assert.ok(most > homes * 1.5, `at most ${most} cars in town`);
  });
}
