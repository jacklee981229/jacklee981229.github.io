// Jack's Town's map: a grid of tiles with a river across it. A road tile keeps which of its four sides it joins (bit d
// for direction d: north, east, south, west); a home takes one tile beside a road and faces it; a big building takes
// two by two tiles with its car park on one side and its door, a road tile, beyond that. Roads out of town leave from
// tiles on the edge, and one flyover may join two roads far apart. growth.js builds the day's town and changes it now
// and then; the cars drive, and the roads are drawn, along the runs of road that roadChains() gives. Tested by
// tests/town-growth.test.js.
import { isoDay } from '../dates.js';

/** The map, in tiles: the same for every window, so everyone sees the same town on the same day. */
export const W = 28, H = 15, N = W * H;
/** The colours of the homes and buildings: how many there are. */
export const COLOURS = 5;
/** The ring of a roundabout, from its middle to the middle of its road. */
export const RING_R = 0.95;
/** How far a road out of town runs on past the map's edge, in tiles: out of sight on the widest stage, a short laptop
 *  window's, where the map has up to 16 tiles of ground either side. (A tall stage turns the town: worlds/town.js.) */
export const OUT = 16;
/** How far along the flyover from each end its ramp lies at the road's own level, over the open ground beside the
 *  road it leaves; past that, it's up. */
export const RAMP = 1.2;
export const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
/** A straight road's links: north and south, east and west. */
export const NS = 5, EW = 10;

export const xOf = (/** @type {number} */ i) => i % W;
export const yOf = (/** @type {number} */ i) => (i - (i % W)) / W;
export const inMap = (/** @type {number} */ x, /** @type {number} */ y) => x >= 0 && y >= 0 && x < W && y < H;
/** The tile at (x, y), or -1 off the map. */
export const tileAt = (/** @type {number} */ x, /** @type {number} */ y) => (inMap(x, y) ? y * W + x : -1);
/** The tile beside `i` in direction `d`, or -1 off the map. */
export const step = (/** @type {number} */ i, /** @type {number} */ d) => tileAt(xOf(i) + DX[d], yOf(i) + DY[d]);
/** @param {number} i @returns {[number, number]} */
export const centre = (i) => [xOf(i) + 0.5, yOf(i) + 0.5];
/** The direction from tile `a` to the tile `b` beside it, or -1 if they aren't side by side. */
export const dirTo = (/** @type {number} */ a, /** @type {number} */ b) =>
  b - a === 1 && yOf(a) === yOf(b) ? 1 : a - b === 1 && yOf(a) === yOf(b) ? 3 : b - a === W ? 2 : a - b === W ? 0 : -1;
/** How many sides a road tile joins. */
export const bits = (/** @type {number} */ m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
/** The two directions at right angles to `d`. */
export const sides = (/** @type {number} */ d) => [(d + 1) % 4, (d + 3) % 4];

/** The day's town, the same for everyone that day: the date in Malaysia as yyyymmdd for its seed, and its weekday
 *  (0 for Sunday). @param {Date} date */
export function dayOf(date) {
  const day = isoDay(date);
  return { seed: Number(day.replace(/-/g, '')), weekday: new Date(`${day}T00:00:00Z`).getUTCDay() };
}

/** A small, fast random number source that gives the same numbers for the same seed. @param {number} seed */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A queue that always gives back its smallest key's value first; `top` is the key of the value last given back. */
export class Heap {
  constructor() {
    /** @type {number[]} */ this.k = [];
    /** @type {number[]} */ this.v = [];
    this.top = 0;
  }
  get size() { return this.k.length; }
  /** @param {number} key @param {number} val */
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const topV = v[0];
    this.top = k[0];
    const lk = /** @type {number} */ (k.pop()), lv = /** @type {number} */ (v.pop());
    if (k.length) {
      let i = 0;
      const n = k.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return topV;
  }
}

/** Points along a smooth curve through `pts`, `per` for each stretch between two of them. @param {[number, number][]} pts */
export function samples(pts, per = 40) {
  /** @type {[number, number][]} */
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let k = 0; k < per; k++) {
      const u = k / per, v = 1 - u;
      out.push([v * v * v * p1[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * p2[0], v * v * v * p1[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * p2[1]]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
/** How far the point (px, py) is from the line between a and b. @param {number} px @param {number} py @param {number[]} a @param {number[]} b */
export function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/**
 * @typedef {{ id: number, kind: 'home', colour: number, tile: number, front: number, face: number, born: number }} Home
 * A home stands on `tile` and faces the road tile `front`, in direction `face`.
 * @typedef {{ id: number, kind: 'place', colour: number, block: number[], lot: number[], doors: number[], door: number,
 *   o: number, bx: number, by: number, cx: number, cy: number, tiles: number[], slots: { x: number, y: number, angle: number }[], born: number }} Place
 * A big building stands on the 2 by 2 `block` with its top left tile at (bx, by), its car park `lot` on side `o`, and
 * the road tile `door` beyond the car park (one of the two `doors` it could have had); (cx, cy) is the middle of block
 * and car park together, and `slots` its parking bays.
 * @typedef {Home | Place} Building
 * @typedef {{ a: number, b: number, da: number, db: number, pts: [number, number][], len: number, cost: number, born: number }} Flyover
 * The flyover runs from road tile `a` to road tile `b` along `pts`, leaving each sideways from its road, like a side
 * road: `a` in direction `da` and `b` in `db`; `cost` is what driving it counts for against a tile of road.
 * @typedef {{ kind: 'road', i: number, mask: number, gate: number, died: number } | { kind: 'home' | 'place', b: Building, died: number }} Ghost
 * Something taken away, kept until the drawing has shown it go.
 * @typedef {ReturnType<typeof newTown>} Town
 */

/** A town with nothing in it yet, whose growth follows `seed`. Times (`born`, `died`) are on the drawing's clock, in
 *  seconds, so it can show what's new arriving. @param {number} seed */
export function newTown(seed) {
  return {
    seed,
    random: seeded(seed),
    /** River, its banks (which take no building), trees (0 none, else the kind), and the flyover's shade. */
    wet: new Uint8Array(N), shore: new Uint8Array(N), trees: new Uint8Array(N), under: new Uint8Array(N),
    /** The sides each road tile joins, whether a tile is road, and the direction a road leaves the map (-1 none). */
    road: new Uint8Array(N), isRoad: new Uint8Array(N), gate: new Int8Array(N).fill(-1),
    /** Which building stands on each tile (-1 none), how many buildings face each road tile, and the roundabouts: 1 at
     *  the middle, 2 on the corners round it. */
    use: new Int32Array(N).fill(-1), fronts: new Uint8Array(N), ring: new Uint8Array(N),
    born: new Float64Array(N), ringBorn: new Float64Array(N),
    /** @type {Map<number, Building>} */
    buildings: new Map(),
    /** @type {Flyover | null} */
    flyover: null,
    /** The river's middle line, top to bottom, through the map's edges. @type {[number, number][]} */
    river: [],
    nextId: 0,
    /** @type {Ghost[]} */
    ghosts: [],
  };
}

/** @param {Town} T @param {number} [c] @returns {Home[]} */
export const homesOf = (T, c) => /** @type {Home[]} */ ([...T.buildings.values()].filter((b) => b.kind === 'home' && (c === undefined || b.colour === c)));
/** @param {Town} T @param {number} [c] @returns {Place[]} */
export const placesOf = (T, c) => /** @type {Place[]} */ ([...T.buildings.values()].filter((b) => b.kind === 'place' && (c === undefined || b.colour === c)));
/** Whether road tile `i` is an end of the flyover. @param {Town} T @param {number} i */
export const flyEnd = (T, i) => !!T.flyover && (i === T.flyover.a || i === T.flyover.b);
/** Whether tile `i` is where the flyover comes down: an end, or the open tile beside it that its ramp lies over.
 *  @param {Town} T @param {number} i */
export const flyRamp = (T, i) => {
  const f = T.flyover;
  return !!f && (i === f.a || i === f.b || i === step(f.a, f.da) || i === step(f.b, f.db));
};
/** How many ways lead on from road tile `i`: its roads, a road out of town, the flyover. @param {Town} T @param {number} i */
export const degree = (T, i) => bits(T.road[i]) + (T.gate[i] >= 0 ? 1 : 0) + (flyEnd(T, i) ? 1 : 0);
/** The road tiles where roads leave the map. @param {Town} T */
export function gatesOf(T) {
  const g = [];
  for (let i = 0; i < N; i++) if (T.gate[i] >= 0 && T.isRoad[i]) g.push(i);
  return g;
}
/** The road tile a building's cars come and go by. @param {Building} b */
export const doorOf = (b) => (b.kind === 'home' ? b.front : b.door);

/** Calls `fn` with each tile a car can drive to from road tile `i`, and what that counts for. @param {Town} T
 *  @param {number} i @param {(j: number, w: number) => void} fn */
export function eachLink(T, i, fn) {
  const m = T.road[i];
  for (let d = 0; d < 4; d++) if ((m >> d) & 1) fn(step(i, d), 1);
  const f = T.flyover;
  if (f) { if (i === f.a) fn(f.b, f.cost); else if (i === f.b) fn(f.a, f.cost); }
}
/** The tiles a car can reach from the roads out of town. @param {Town} T */
export function reachable(T) {
  const seen = new Uint8Array(N);
  const todo = gatesOf(T);
  for (const g of todo) seen[g] = 1;
  while (todo.length) {
    const i = /** @type {number} */ (todo.pop());
    eachLink(T, i, (j) => { if (!seen[j]) { seen[j] = 1; todo.push(j); } });
  }
  return seen;
}
/** How far every road tile is from the nearest of `sources`, along the roads, and the next tile on the way there.
 *  @param {Town} T @param {number[]} sources */
export function roadField(T, sources) {
  const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const heap = new Heap();
  for (const s of sources) { dist[s] = 0; heap.push(0, s); }
  while (heap.size) {
    const i = heap.pop(), c = heap.top;
    if (c > dist[i]) continue;
    eachLink(T, i, (j, w) => { const nc = c + w; if (nc < dist[j]) { dist[j] = nc; prev[j] = i; heap.push(nc, j); } });
  }
  return { dist, prev };
}
/** How many trips use each tile: every home to each building of its colour (shared between them, as its car picks
 *  one), and visitors from each road out of town to every building (half as many). @param {Town} T */
export function busyness(T) {
  const busy = new Float32Array(N);
  for (const p of placesOf(T)) {
    const share = 1 / placesOf(T, p.colour).length;
    const { prev } = roadField(T, [p.door]);
    for (const h of homesOf(T, p.colour)) for (let i = h.front, n = 0; i >= 0 && n < N; i = prev[i], n++) busy[i] += share;
  }
  for (const g of gatesOf(T)) {
    const { prev } = roadField(T, [g]);
    for (const p of placesOf(T)) for (let i = p.door, n = 0; i >= 0 && n < N; i = prev[i], n++) busy[i] += 0.5;
  }
  return busy;
}

/**
 * The roads as runs between junctions and ends: each a line of points (`pts`, at the tiles in `tiles`, -1 for a point
 * past the map's edge) with a radius for each bend. The same runs draw the roads and steer the cars. `seen` says which
 * road tiles show; `ringOn` which roundabouts. Fills `radii` (for each tile) when given.
 * @param {Town} T @param {(i: number) => boolean} seen @param {Float32Array} [radii] @param {(i: number) => boolean} [ringOn]
 */
export function roadChains(T, seen, radii, ringOn = (i) => T.ring[i] === 1) {
  /** @param {number} i @returns {[number, number][]} */
  const exits = (i) => {
    /** @type {[number, number][]} */
    const out = [];
    const m = T.road[i];
    for (let d = 0; d < 4; d++) if ((m >> d) & 1) { const j = step(i, d); if (seen(j)) out.push([d, j]); }
    if (T.gate[i] >= 0) out.push([T.gate[i], -1]);
    return out;
  };
  const isNode = (/** @type {number} */ i) => ringOn(i) || flyEnd(T, i) || exits(i).length !== 2;
  const junction = (/** @type {number} */ i) => !ringOn(i) && (flyEnd(T, i) || exits(i).length >= 3);
  const done = new Uint8Array(N * 4);
  /** @type {{ pts: [number, number][], tiles: number[], radii: number[] }[]} */
  const chains = [];
  /** @param {number} i @param {number} d @param {number} j */
  const walk = (i, d, j) => {
    const pts = [centre(i)], tiles = [i];
    done[i * 4 + d] = 1;
    // The tile behind the walk, for a road that runs off the map: its last point is past that tile, not the last bend.
    let cur = j, dir = d, behind = i;
    for (let guard = 0; guard < N; guard++) {
      if (cur < 0) { const [x, y] = centre(behind); pts.push([x + DX[dir] * OUT, y + DY[dir] * OUT]); tiles.push(-1); break; }
      done[cur * 4 + (dir + 2) % 4] = 1;
      if (isNode(cur)) { pts.push(centre(cur)); tiles.push(cur); break; }
      const next = /** @type {[number, number]} */ (exits(cur).find(([e]) => e !== (dir + 2) % 4));
      if (next[0] !== dir) { pts.push(centre(cur)); tiles.push(cur); }
      done[cur * 4 + next[0]] = 1;
      behind = cur;
      cur = next[1];
      dir = next[0];
    }
    const first = tiles[0], last = tiles[tiles.length - 1];
    // Ends at a roundabout stop at its ring.
    /** @param {number[]} a @param {number[]} b @param {number} r @returns {[number, number]} */
    const towards = (a, b, r) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + (b[0] - a[0]) / l * r, a[1] + (b[1] - a[1]) / l * r]; };
    if (ringOn(first)) pts[0] = towards(pts[0], pts[1], RING_R);
    if (last >= 0 && ringOn(last)) pts[pts.length - 1] = towards(pts[pts.length - 1], pts[pts.length - 2], RING_R);
    const r = pts.map(() => 0);
    for (let k = 1; k < pts.length - 1; k++) {
      const lp = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      const ln = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
      // A bend takes at most half the straight to the next bend, leaves a junction room for its own corners, and
      // leaves the road straight where the ways onto and off a roundabout's ring meet it.
      const limP = k - 1 > 0 ? lp / 2 : junction(first) ? lp - 0.35 : ringOn(first) ? lp - 0.4 : lp;
      const limN = k + 1 < pts.length - 1 ? ln / 2 : last >= 0 && junction(last) ? ln - 0.35 : last >= 0 && ringOn(last) ? ln - 0.4 : ln;
      r[k] = Math.max(0.2, Math.min(0.95, limP, limN));
      if (radii && tiles[k] >= 0) radii[tiles[k]] = r[k];
    }
    chains.push({ pts, tiles, radii: r });
  };
  for (let i = 0; i < N; i++) if (T.isRoad[i] && seen(i) && isNode(i)) for (const [d, j] of exits(i)) if (!done[i * 4 + d]) walk(i, d, j);
  return chains;
}
