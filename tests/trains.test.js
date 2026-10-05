import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNetwork, COLOURS, sizesAt } from '../src/lib/trains/layout.js';
import { carsOf, startTrains, STEP, STUCK, TOP } from '../src/lib/trains/sim.js';

// Window sizes from a small phone's to a big screen's, short laptops and a tall tablet among them.
const SIZES = [[320, 288], [360, 450], [375, 468], [768, 600], [768, 1024], [1024, 600], [1280, 288], [1265, 652], [1366, 657], [1440, 760], [1920, 1000]];
const SEEDS = [1, 2];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const heading = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const turn = (a, b) => Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
const each = (fn) => { for (const [w, h] of SIZES) for (const seed of SEEDS) fn(buildNetwork(w, h, seed), `${w}x${h} seed ${seed}`); };

test('the same seed lays out the same network, another seed another', () => {
  const shape = (n) => JSON.stringify(n.stations.map((s) => [s.kind, s.colour, Math.round(s.x), Math.round(s.y)]));
  assert.equal(shape(buildNetwork(1265, 652, 7)), shape(buildNetwork(1265, 652, 7)));
  assert.notEqual(shape(buildNetwork(1265, 652, 7)), shape(buildNetwork(1265, 652, 8)));
});

test("stations come in three shapes, one pickup with two platforms when there's room", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed++) for (const s of buildNetwork(1265, 652, seed).stations) seen.add(s.shape);
  assert.deepEqual([...seen].sort(), ['double', 'loop', 'round']);
  each((n, at) => assert.ok(n.stations.filter((s) => s.shape === 'double').every((s) => s.kind === 'pickup'), at));
});

test('a pickup and a drop-off of each colour, fewer on a phone; more room in the depot than there are trains', () => {
  each((n, at) => {
    const want = Math.min(n.width, n.height) < 500 ? 2 : COLOURS;
    assert.equal(n.colours, want, at);
    for (let c = 0; c < n.colours; c++) {
      assert.deepEqual(n.stations.filter((s) => s.colour === c).map((s) => s.kind).sort(), ['drop', 'pickup'], `${at}: colour ${c}`);
    }
    assert.ok(n.depot.sidings.length > n.trains, at);
    // A whole train fits where it waits, on each platform and in each siding.
    for (const s of n.stations) {
      assert.ok(s.wait.s1 - s.wait.s0 >= n.trainLength, `${at}: a waiting straight too short`);
      for (const p of s.platforms) assert.ok(p.s1 - p.s0 >= n.trainLength, `${at}: a platform too short`);
    }
    for (const t of n.depot.sidings) assert.ok(t.len >= n.trainLength, `${at}: a siding too short`);
  });
});

test('every station can be reached from the depot, and the depot from every station', () => {
  const reachable = (from) => {
    const seen = new Set([from]);
    const todo = [from];
    while (todo.length) {
      const t = todo.pop();
      for (const p of t.to?.paths ?? []) if (p.from === t && !seen.has(p.to)) seen.add(p.to), todo.push(p.to);
    }
    return seen;
  };
  each((n, at) => {
    for (const siding of n.depot.sidings) {
      const seen = reachable(siding);
      for (const s of n.stations) for (const p of s.platforms) assert.ok(seen.has(p.track), `${at}: ${s.kind} ${s.colour} out of reach of the depot`);
    }
    for (const s of n.stations) {
      for (const p of s.platforms) {
        const seen = reachable(p.track);
        assert.ok(n.depot.sidings.every((t) => seen.has(t)), `${at}: no way back from ${s.kind} ${s.colour} to every siding`);
      }
    }
  });
});

test('every join is smooth: no gap, no kink, no bend tighter than the network allows', () => {
  each((n, at) => {
    const tightest = 0.95 * sizesAt(n.k).loop;
    for (const p of n.paths) {
      const from = p.from.points;
      const to = p.to.points;
      assert.ok(dist(from[from.length - 1], p.points[0]) < 0.01, `${at}: a gap into a junction`);
      assert.ok(dist(p.points[p.points.length - 1], to[0]) < 0.01, `${at}: a gap out of a junction`);
      // Across a join the heading turns no more than a curve of the tightest radius would over the same ground.
      const bend = (a, b, c) => turn(heading(a, b), heading(b, c)) <= (dist(a, b) + dist(b, c)) / 2 / tightest + 0.002;
      assert.ok(bend(from[from.length - 2], from[from.length - 1], p.points[1]), `${at}: a kink into a junction`);
      assert.ok(bend(p.points[p.points.length - 2], p.points[p.points.length - 1], to[1]), `${at}: a kink out of a junction`);
    }
    for (const part of [...n.tracks, ...n.paths]) {
      const pts = part.points;
      for (let i = 2; i < pts.length; i++) {
        const a = dist(pts[i - 2], pts[i - 1]);
        const b = dist(pts[i - 1], pts[i]);
        assert.ok(a > 1e-6 && b > 1e-6, `${at}: two points on top of each other`);
        // The turn between two short pieces of a circle of radius r is about their length over r.
        assert.ok(turn(heading(pts[i - 2], pts[i - 1]), heading(pts[i - 1], pts[i])) <= (a + b) / 2 / tightest + 0.002, `${at}: a sharp bend in ${part.kind} ${part.name ?? part.id}`);
      }
    }
  });
});

test('every junction has a look-ahead signal at each way in and a plain one at each way out', () => {
  each((n, at) => {
    for (const p of n.paths) {
      const last = p.from.signals[p.from.signals.length - 1];
      assert.ok(last?.kind === 'chain' && Math.abs(last.s - p.from.len) < 1e-6, `${at}: a way into a junction with no look-ahead signal`);
      assert.ok(p.to.signals[0]?.kind === 'block' && p.to.signals[0].s === 0, `${at}: a way out of a junction with no signal`);
    }
    // Along a track the signals stand in order, a block between each two.
    for (const t of n.tracks) for (let i = 1; i < t.signals.length; i++) assert.ok(t.signals[i].s > t.signals[i - 1].s, `${at}: signals out of order on ${t.name}`);
  });
});

test('the network stays inside the window, and no two tracks touch except through a junction', () => {
  each((n, at) => {
    const { tie } = sizesAt(n.k);
    for (const part of [...n.tracks, ...n.paths]) {
      for (const p of part.points) assert.ok(p.x >= tie && p.y >= tie && p.x <= n.width - tie && p.y <= n.height - tie, `${at}: track outside the window`);
    }
    for (const t of n.tracks) for (const s of t.signals) assert.ok(s.x >= 0 && s.y >= 0 && s.x <= n.width && s.y <= n.height, `${at}: a signal outside the window`);
    // Tracks' sleepers never overlap: any two points of different tracks are at least two half-sleepers apart.
    const cell = 2 * tie;
    const grid = new Map();
    for (const t of n.tracks) {
      for (const p of t.points) {
        const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push([t, p]);
      }
    }
    let closest = Infinity;
    for (const [key, items] of grid) {
      const [cx, cy] = key.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const [t2, q] of grid.get(`${cx + dx},${cy + dy}`) ?? []) for (const [t1, p] of items) if (t1 !== t2) closest = Math.min(closest, dist(p, q));
        }
      }
    }
    assert.ok(closest >= cell * 0.99, `${at}: two tracks ${closest.toFixed(1)} px apart`);
  });
});

// The trains (TR2).
const DAY = 24 * 60 * 60;

/** Whether two cars' bodies overlap: two turned boxes, tested along each box's sides. */
function touching(a, b, width) {
  if (Math.hypot(a.x - b.x, a.y - b.y) > (a.length + b.length) / 2 + width) return false;
  const axes = (p) => [[Math.cos(p.angle), Math.sin(p.angle)], [-Math.sin(p.angle), Math.cos(p.angle)]];
  const reach = (p, [x, y]) => (p.length / 2 - 0.2) * Math.abs(axes(p)[0][0] * x + axes(p)[0][1] * y) + (width / 2 - 0.2) * Math.abs(axes(p)[1][0] * x + axes(p)[1][1] * y);
  return [...axes(a), ...axes(b)].every(([x, y]) => Math.abs((b.x - a.x) * x + (b.y - a.y) * y) < reach(a, [x, y]) + reach(b, [x, y]));
}

test('the same seed runs the same', () => {
  const run = () => {
    const traffic = startTrains(buildNetwork(1265, 652, 3), 3);
    for (let i = 0; i < 6000; i++) traffic.step();
    return JSON.stringify(traffic.trains.map((t) => [t.phase, t.head.toFixed(6), t.cargo.toFixed(4)]));
  };
  assert.equal(run(), run());
});

for (const [w, h, seed] of [[1265, 652, 1], [375, 468, 2], [1920, 1000, 3], [768, 600, 4], [1280, 288, 5]]) {
  test(`24 hours of trains on a ${w} by ${h} network (seed ${seed}): one train to a block, none past a red, every delivery made`, () => {
    const network = buildNetwork(w, h, seed);
    const traffic = startTrains(network, seed);
    const { k } = network;
    const width = 9 * k;
    let sharedBlocks = 0;
    let crossedWays = 0;
    let unbooked = 0;
    let touches = 0;
    let jump = 0;
    let lowest = 1;
    for (let i = 0; i < DAY / STEP; i++) {
      const was = traffic.trains.map((t) => [t.route, t.head]);
      traffic.step();
      traffic.trains.forEach((t, n) => { if (t.route === was[n][0]) jump = Math.max(jump, t.head - was[n][1]); });
      if (i % 10) continue;
      for (const st of traffic.stations) if (st.kind === 'drop') lowest = Math.min(lowest, st.stock);
      // What each train's body covers, worked out afresh from where it is.
      const on = new Map();
      for (const t of traffic.trains) {
        for (const p of t.pieces) {
          if (p.a < t.head && p.b > t.head - t.length) {
            if (on.has(p.piece) && on.get(p.piece) !== t) sharedBlocks++;
            on.set(p.piece, t);
            if (p.piece.owner !== t) unbooked++;
          }
        }
      }
      for (const [piece, t] of on) if (piece.kind === 'path' && piece.crosses.some((c) => on.has(c) && on.get(c) !== t)) crossedWays++;
      if (i % 40) continue;
      const cars = traffic.trains.map((t) => carsOf(t, t.head, k));
      for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) for (const x of cars[a]) for (const y of cars[b]) if (touching(x, y, width)) touches++;
    }
    const { stats, trains } = traffic;
    assert.equal(sharedBlocks, 0, 'two trains in one block');
    assert.equal(crossedWays, 0, 'two trains on crossing ways through a junction');
    assert.equal(unbooked, 0, 'a train where it had not booked');
    assert.equal(stats.unbooked, 0, 'a train where it had not booked (its own count)');
    assert.equal(touches, 0, 'two trains touching');
    assert.equal(stats.removed, 0, 'trains taken off');
    assert.ok(stats.longestWait < STUCK, `a train waited ${stats.longestWait.toFixed(0)}s`);
    assert.ok(lowest >= 0 && stats.lowestStock >= 0, 'stock below zero');
    // Every load picked up was delivered, but for those on board at the end.
    assert.equal(stats.loaded - stats.delivered, trains.filter((t) => t.phase === 'over' || t.phase === 'unloading').length);
    assert.ok(stats.delivered > 24 * 30, `${stats.delivered} deliveries in a day`);
    assert.ok(jump <= TOP * k * STEP + 1e-6, `a train jumped ${jump.toFixed(2)} px in a step`);
  });
}
