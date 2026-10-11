import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centre, COLOURS, dayOf, dirTo, doorOf, EW, flyRamp, gatesOf, H, homesOf, N, newTown, NS, OUT, placesOf, reachable, RING_R, roadChains, step, W, xOf, yOf } from '../src/lib/town/map.js';
import { BRIDGE_MAX, BUILD, build, change, HOMES, PLACES, RINGS } from '../src/lib/town/growth.js';

/** @typedef {import('../src/lib/town/map.js').Town} Town */

/** Some days' towns, seeded as the page seeds them: the day's date as yyyymmdd. */
const DAYS = [20261011, 20261012, 20261018, 20261103, 20261225, 20270101, 20270322, 20270615, 20271031, 20280229];
/** Changes to put each town through: at one about every 2 minutes, half a day of watching. */
const CHANGES = 400;

/** @param {number} seed */
function grown(seed) {
  const T = newTown(seed);
  build(T);
  return T;
}
/** @param {Town} T */
function roadTiles(T) {
  let n = 0;
  for (let i = 0; i < N; i++) n += T.isRoad[i];
  return n;
}
/** @param {Town} T */
function rings(T) {
  let n = 0;
  for (let i = 0; i < N; i++) n += T.ring[i] === 1 ? 1 : 0;
  return n;
}

/** Everything wrong with a town, in words: nothing, in a good town. @param {Town} T */
function problems(T) {
  const out = [];
  const reach = reachable(T);
  const facing = new Uint8Array(N);
  for (const b of T.buildings.values()) {
    const door = doorOf(b);
    facing[door]++;
    if (!T.isRoad[door]) out.push(`${b.kind} ${b.id} faces no road`);
    else if (!reach[door]) out.push(`${b.kind} ${b.id} is cut off`);
    if (b.kind === 'home' && dirTo(b.tile, b.front) !== b.face) out.push(`home ${b.id} isn't beside the road it faces`);
    if (flyRamp(T, door)) out.push(`${b.kind} ${b.id} faces the road where the flyover comes down`);
    if (b.kind === 'place' && b.slots.length !== 4) out.push(`building ${b.id} has ${b.slots.length} bays`);
    for (const t of b.kind === 'home' ? [b.tile] : b.tiles) {
      if (T.use[t] !== b.id) out.push(`a tile of ${b.kind} ${b.id} isn't marked as its`);
      if (T.isRoad[t] || T.wet[t] || T.shore[t] || T.under[t] || T.ring[t]) out.push(`${b.kind} ${b.id} stands on road, water, a bank, a roundabout or under the flyover`);
    }
  }
  for (let i = 0; i < N; i++) {
    if (T.use[i] >= 0 && !T.buildings.has(T.use[i])) out.push(`tile ${i} is marked for a building that's gone`);
    if (T.fronts[i] !== facing[i]) out.push(`tile ${i}: ${T.fronts[i]} buildings counted facing it, ${facing[i]} do`);
    if (T.ring[i] === 2 && (T.isRoad[i] || T.trees[i])) out.push(`road or a tree on a roundabout's corner at ${i}`);
    if (!T.isRoad[i]) {
      if (T.road[i] || T.gate[i] >= 0) out.push(`links or a road out of town on tile ${i}, which has no road`);
      continue;
    }
    if (!reach[i]) out.push(`road tile ${i} is cut off`);
    for (let d = 0; d < 4; d++) {
      if (!((T.road[i] >> d) & 1)) continue;
      const j = step(i, d);
      if (j < 0 || !T.isRoad[j] || !((T.road[j] >> ((d + 2) % 4)) & 1)) out.push(`road tile ${i} links to ${j}, which doesn't link back`);
    }
    if (T.gate[i] >= 0 && step(i, T.gate[i]) >= 0) out.push(`the road out of town at ${i} doesn't leave the map`);
    if (xOf(i) < W - 1 && yOf(i) < H - 1 && T.isRoad[i + 1] && T.isRoad[i + W] && T.isRoad[i + W + 1]) out.push(`a square of road at ${i}`);
    if (T.wet[i]) {
      if (T.road[i] !== NS && T.road[i] !== EW) out.push(`a bridge turns or branches at ${i}`);
      // How long the bridge is: the wet road tiles in a line through this one.
      const [d1, d2] = T.road[i] === NS ? [0, 2] : [1, 3];
      let len = 1;
      for (const d of [d1, d2]) for (let k = step(i, d); k >= 0 && T.wet[k] && T.isRoad[k]; k = step(k, d)) len++;
      if (len > BRIDGE_MAX) out.push(`a bridge ${len} tiles long at ${i}`);
    }
  }
  if (rings(T) > RINGS) out.push(`${rings(T)} roundabouts`);
  for (let i = 0; i < N; i++) if (T.ring[i] === 1 && (!T.isRoad[i] || !reach[i])) out.push(`roundabout ${i} has no road to it`);
  if (T.flyover && !(T.isRoad[T.flyover.a] && reach[T.flyover.a] && T.isRoad[T.flyover.b] && reach[T.flyover.b])) out.push(`the flyover's ends have no road to them`);
  // The flyover leaves each end sideways, like a side road, its ramp over open ground that stays open.
  const f = T.flyover;
  if (f) {
    for (const [e, d] of [[f.a, f.da], [f.b, f.db]]) {
      const n = step(e, d);
      if (n < 0 || T.isRoad[n] || T.use[n] >= 0 || T.wet[n] || T.ring[n] || T.trees[n]) out.push(`something on the ground the flyover's ramp comes down on at ${n}`);
      if ((T.road[e] >> d) & 1) out.push(`a road runs on under the flyover's ramp at ${e}`);
    }
  }
  return out;
}

test("the day's town goes by the date in Malaysia", () => {
  // Half past four in the afternoon on Sunday 11 October in London's winter time is half past midnight on Monday the
  // 12th in Malaysia.
  assert.deepEqual(dayOf(new Date('2026-10-11T16:30:00Z')), { seed: 20261012, weekday: 1 });
  assert.deepEqual(dayOf(new Date('2026-10-11T15:59:00Z')), { seed: 20261011, weekday: 0 });
  assert.deepEqual(dayOf(new Date('2028-02-28T16:00:00Z')), { seed: 20280229, weekday: 2 });
});

test('a watched build grows the same town, every piece of it within its few seconds, each home after its road', () => {
  for (const seed of [20261011, 20261019, 20270305]) {
    const all = newTown(seed), watched = newTown(seed);
    build(all);
    const end = build(watched, 5);
    const shape = (/** @type {ReturnType<typeof newTown>} */ T) => JSON.stringify([[...T.road], [...T.use], [...T.ring], T.flyover?.pts]);
    assert.equal(shape(watched), shape(all), `${seed}: watching changed the town`);
    assert.equal(end, 5 + BUILD);
    const times = [];
    for (let i = 0; i < N; i++) { if (watched.isRoad[i]) times.push(watched.born[i]); if (watched.ring[i] === 1) times.push(watched.ringBorn[i]); }
    for (const b of watched.buildings.values()) times.push(b.born);
    if (watched.flyover) times.push(watched.flyover.born);
    assert.ok(times.every((t) => t >= 5 && t <= end + 1e-9), `${seed}: something born outside the build's few seconds`);
    for (const b of homesOf(watched)) assert.ok(b.born >= watched.born[b.front], `${seed}: home ${b.id} before its road`);
    assert.ok([...all.buildings.values()].every((b) => b.born === -Infinity), `${seed}: an unwatched town pops`);
  }
});

test('the same day grows the same town through the same changes, and another day another town', () => {
  /** @param {Town} T */
  const shape = (T) => JSON.stringify([[...T.road], [...T.gate], [...T.use], [...T.ring], [...T.trees], [...T.wet], T.flyover?.pts, [...T.buildings.values()]]);
  const a = grown(DAYS[0]), b = grown(DAYS[0]);
  assert.equal(shape(a), shape(b));
  for (let k = 0; k < 100; k++) assert.deepEqual(change(a, k), change(b, k));
  assert.equal(shape(a), shape(b));
  assert.notEqual(shape(grown(DAYS[0])), shape(grown(DAYS[1])));
});

test('a new town has buildings in all five colours, its homes, a bridge and three roads out of town, and most a roundabout', () => {
  let withRing = 0;
  for (const seed of DAYS) {
    const T = grown(seed);
    assert.deepEqual(problems(T), [], `${seed}`);
    assert.equal(new Set(placesOf(T).map((p) => p.colour)).size, COLOURS, `${seed}`);
    assert.ok(placesOf(T).length >= PLACES - 2 && placesOf(T).length <= PLACES, `${seed}: ${placesOf(T).length} buildings`);
    assert.ok(homesOf(T).length >= HOMES - 8 && homesOf(T).length <= HOMES, `${seed}: ${homesOf(T).length} homes`);
    if (rings(T)) withRing++;
    assert.equal(gatesOf(T).length, 3, `${seed}`);
    assert.ok(T.wet.some((w, i) => w && T.isRoad[i]), `${seed}: no bridge`);
  }
  assert.ok(withRing >= DAYS.length - 2, `${withRing} of ${DAYS.length} with a roundabout`);
});

test('after every change, every building faces a road it can be driven to, and nothing stands where it mustn\'t', () => {
  for (const seed of DAYS) {
    const T = grown(seed);
    for (let k = 0; k < CHANGES; k++) {
      change(T, k);
      const wrong = problems(T);
      if (wrong.length) assert.fail(`${seed}, change ${k + 1}: ${wrong.join('; ')}`);
    }
  }
});

test('the town keeps its size through its changes, and every kind of change comes along', () => {
  const kinds = new Set();
  for (const seed of DAYS) {
    const T = grown(seed);
    for (let k = 0; k < CHANGES; k++) {
      const res = change(T, k);
      if (res) kinds.add(res.kind);
      const homes = homesOf(T).length, places = placesOf(T).length, roads = roadTiles(T);
      assert.ok(homes >= HOMES - 8 && homes <= HOMES + 4, `${seed}, change ${k + 1}: ${homes} homes`);
      assert.ok(places >= PLACES - 3 && places <= PLACES + 1, `${seed}, change ${k + 1}: ${places} buildings`);
      assert.ok(roads <= 160, `${seed}, change ${k + 1}: ${roads} road tiles`);
    }
  }
  // A new street with no home on it is rare: these days don't have one.
  for (const kind of ['home', 'home-gone', 'opened', 'closed', 'shortcut', 'road-gone', 'roundabout']) assert.ok(kinds.has(kind), kind);
});

test('no road goes from under the traffic, and no junction a car stands on becomes a roundabout', () => {
  for (const seed of DAYS.slice(0, 4)) {
    const T = grown(seed);
    // Every tile in use, as if cars were everywhere: then nothing that's there may go.
    const everywhere = { route: new Uint8Array(N).fill(1), body: new Uint8Array(N).fill(1) };
    let removals = 0;
    for (let k = 0; k < 150; k++) {
      const roads = T.isRoad.slice(), ring = T.ring.slice();
      const res = change(T, k, everywhere);
      if (res && (res.kind === 'home-gone' || res.kind === 'closed')) removals++;
      for (let i = 0; i < N; i++) {
        if (roads[i] && !T.isRoad[i]) assert.fail(`${seed}, change ${k + 1}: road ${i} went`);
        if (!ring[i] && T.ring[i] === 1) assert.fail(`${seed}, change ${k + 1}: a roundabout at ${i}`);
      }
    }
    assert.ok(removals > 0, `${seed}: nothing came down, so this proved nothing`);
  }
});

test('the runs of road take in every stretch of road and every road out of town exactly once', () => {
  for (const seed of DAYS) {
    const T = grown(seed);
    for (let k = 0; k <= CHANGES; k += 50) {
      if (k) for (let n = 0; n < 50; n++) change(T, k + n);
      const links = new Map(), gates = new Map();
      /** @param {number} i @param {number} d */
      const use = (i, d) => {
        const j = step(i, d);
        if (j < 0) gates.set(i, (gates.get(i) ?? 0) + 1);
        else { const key = Math.min(i, j) * 2 + (d % 2); links.set(key, (links.get(key) ?? 0) + 1); }
        return j;
      };
      for (const { pts, tiles } of roadChains(T, () => true)) {
        tiles.forEach((t, n) => {
          // Each point is in the middle of its tile (a roundabout's at its ring); a road out of town runs on out of sight.
          if (t >= 0 && T.ring[t] !== 1) assert.deepEqual(pts[n], centre(t), `${seed}, after ${k}: point at ${t}`);
          if (t >= 0 && T.ring[t] === 1) assert.ok(Math.abs(Math.hypot(pts[n][0] - centre(t)[0], pts[n][1] - centre(t)[1]) - RING_R) < 1e-9, `${seed}, after ${k}: a road ends off its roundabout's ring`);
          if (t < 0) assert.ok(Math.max(-pts[n][0], pts[n][0] - W, -pts[n][1], pts[n][1] - H) >= OUT - 1, `${seed}, after ${k}: a road out of town ends on the map`);
        });
        for (let n = 1; n < tiles.length; n++) {
          const a = tiles[n - 1], b = tiles[n];
          // The tiles between two points are a straight line; a run out of town goes on until it leaves the map.
          const [tx, ty] = b >= 0 ? [xOf(b) + 0.5, yOf(b) + 0.5] : pts[n];
          const dx = Math.sign(Math.round(tx - xOf(a) - 0.5)), dy = Math.sign(Math.round(ty - yOf(a) - 0.5));
          const d = dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3;
          for (let i = a, guard = 0; i !== b && i >= 0 && guard < W + H; guard++) i = use(i, d);
        }
      }
      for (let i = 0; i < N; i++) {
        for (const d of [1, 2]) if ((T.road[i] >> d) & 1) assert.equal(links.get(i * 2 + (d % 2)), 1, `${seed}, after ${k}: road ${i} going ${d}`);
        if (T.isRoad[i] && T.gate[i] >= 0) assert.equal(gates.get(i), 1, `${seed}, after ${k}: road out of town at ${i}`);
      }
      assert.equal([...links.values()].reduce((s, v) => s + v, 0), [...T.road].reduce((s, m) => s + ((m >> 1) & 1) + ((m >> 2) & 1), 0), `${seed}, after ${k}: links walked that aren't road`);
    }
  }
});
