// Jack's Town's growth: the day's town built from nothing (the river and trees, an avenue across the map with roads
// out of town, the big buildings with roads laid to them, short cuts, the flyover, a roundabout, the homes), then now
// and then one change, adding and taking away in balance so the town keeps its size. Roads are laid the way a planner
// would: straight runs, few turns, never right beside another road or in a square of road, over the river only
// straight across by a short bridge. The same seed grows the same town through the same changes. Works on the map of
// map.js; tested by tests/town-growth.test.js.
import {
  bits, busyness, centre, COLOURS, degree, dirTo, doorOf, DX, DY, EW, flyEnd, flyRamp, H, Heap, homesOf, inMap, N, NS,
  placesOf, reachable, roadField, samples, segDist, sides, step, tileAt, W, xOf, yOf,
} from './map.js';

/** @typedef {import('./map.js').Town} Town @typedef {import('./map.js').Building} Building
 *  @typedef {import('./map.js').Home} Home @typedef {import('./map.js').Place} Place */

/** The size the town keeps: about this many homes and big buildings. */
export const HOMES = 46, PLACES = 7;
/** Bridges are at most this many tiles of water long. */
export const BRIDGE_MAX = 4;
/** What a planner pays, over a tile of plain road, for a turn and for running right beside another road. */
const TURN_COST = 2.5, HUG_COST = 2.5;
/** A junction with this many trips through it can become a roundabout; at most this many roundabouts. */
const RING_BUSY = 5;
export const RINGS = 3;
/** No new roads cutting a long way round once the town has this many road tiles. */
const ROADS_MAX = 150;
/** A changing road's tiles appear one after another this far apart, in seconds, so a road lays itself. */
const LAY = 0.05;

/** Free land a new road may take: off the map's edge row, no building, no roundabout, not where the flyover comes down
 *  (if the road there has gone). @param {Town} T @param {number} j @param {Set<number> | null} [avoid] */
function roadable(T, j, avoid) {
  const x = xOf(j), y = yOf(j);
  return x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2 && !T.isRoad[j] && T.use[j] < 0 && !T.ring[j] && !flyRamp(T, j) && !(avoid && avoid.has(j));
}
/** Land a building may take: not road, not by the water, not under the flyover. @param {Town} T @param {number} t */
const buildable = (T, t) => t >= 0 && !T.isRoad[t] && T.use[t] < 0 && !T.ring[t] && !T.shore[t] && !T.under[t];
/** Whether a junction or a roundabout is right beside `j`. @param {Town} T @param {number} j */
function nearJunction(T, j) {
  for (let d = 0; d < 4; d++) { const k = step(j, d); if (k >= 0 && T.isRoad[k] && (T.ring[k] === 1 || degree(T, k) >= 3)) return true; }
  return false;
}
/** Whether road other than `i` is beside `j`. @param {Town} T @param {number} j @param {number} i */
function beside(T, j, i) {
  for (let d = 0; d < 4; d++) { const k = step(j, d); if (k >= 0 && k !== i && T.isRoad[k]) return true; }
  return false;
}
/** Whether road on `j` would make a square of four road tiles, counting `also` (tiles about to be road) as road.
 *  @param {Town} T @param {number} j @param {number[]} [also] */
function makesSquare(T, j, also = []) {
  const x = xOf(j), y = yOf(j);
  for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    let all = true;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const k = tileAt(x + ox + dx, y + oy + dy);
      if (k === j) continue;
      if (k < 0 || !(T.isRoad[k] || also.includes(k))) { all = false; break; }
    }
    if (all) return true;
  }
  return false;
}
/** Whether a bridge can start at the water tile `j`, heading `d`: straight across, short, nothing beside it, and
 *  land to come down on. @param {Town} T @param {number} j @param {number} d */
function bridgeOk(T, j, d) {
  let k = j, len = 0;
  while (k >= 0 && T.wet[k]) {
    if (T.isRoad[k]) return false;
    for (const p of sides(d)) { const s = step(k, p); if (s >= 0 && T.isRoad[s]) return false; }
    if (++len > BRIDGE_MAX) return false;
    k = step(k, d);
  }
  if (k < 0) return false;
  if (T.isRoad[k]) return !T.ring[k];
  return roadable(T, k);
}
/** What it costs to join the network at road tile `j`, coming in heading `d`: a plain T is best. @param {Town} T
 *  @param {number} j @param {number} d */
function joinCost(T, j, d) {
  const m = T.road[j], deg = degree(T, j);
  let k = 0;
  if (T.ring[j] === 1) k += 1.5;
  else if (deg >= 3) k += 2.5;
  else if (deg === 2 && m !== NS && m !== EW) k += 1.5;
  else if (deg === 1 && (m >> d) & 1) k -= 0.5;
  if (nearJunction(T, j)) k += 3;
  return k;
}

/**
 * @typedef {{ avoid?: Iterable<number> | null, accept?: ((j: number) => boolean) | null, from?: number, maxCost?: number }} RoadOptions
 * `avoid`: tiles the road mustn't take; `accept`: which road tiles it may join; `from`: a road tile it leaves from.
 * @typedef {{ tiles: number[], cost: number, bridge: boolean }} RoadPath
 * `tiles` run from the start to the road tile the new road joins.
 */
/** The cheapest new road from the free tile `start` to the network. @param {Town} T @param {number} start
 *  @param {RoadOptions} [opts] @returns {RoadPath | null} */
function findRoad(T, start, opts = {}) {
  // A road that would make a square with its own tiles is searched again around the tile that made it.
  const avoid = new Set(opts.avoid ?? []);
  const reach = reachable(T);
  for (let attempt = 0; attempt < 4; attempt++) {
    const path = searchRoad(T, start, { ...opts, avoid, reach });
    if (!path) return null;
    const fresh = path.tiles.filter((t) => !T.isRoad[t]);
    const bad = fresh.find((t) => makesSquare(T, t, fresh));
    if (bad === undefined) return path;
    if (bad === start) return null;
    avoid.add(bad);
  }
  return null;
}
/** The search behind findRoad, over (tile, heading) so turns cost what they should. @param {Town} T @param {number} start
 *  @param {{ avoid: Set<number>, accept?: ((j: number) => boolean) | null, from?: number, maxCost?: number, reach: Uint8Array }} opts
 *  @returns {RoadPath | null} */
function searchRoad(T, start, { avoid, accept = null, from = -1, maxCost = 28, reach }) {
  if (!roadable(T, start, avoid) || T.wet[start] || makesSquare(T, start)) return null;
  const cost = new Float64Array(N * 5).fill(Infinity), prev = new Int32Array(N * 5).fill(-1);
  const heap = new Heap();
  cost[start * 5 + 4] = 0;
  heap.push(0, start * 5 + 4);
  while (heap.size) {
    const s = heap.pop(), c = heap.top;
    if (c > cost[s]) continue;
    const i = (s / 5) | 0, din = s % 5;
    if (T.isRoad[i]) {
      const tiles = [];
      for (let k = s; k >= 0; k = prev[k]) tiles.push((k / 5) | 0);
      tiles.reverse();
      return { tiles, cost: c, bridge: tiles.some((t) => T.wet[t]) };
    }
    if (c > maxCost) break;
    for (let d = 0; d < 4; d++) {
      if (din < 4 && d === (din + 2) % 4) continue;
      if (T.wet[i] && din < 4 && d !== din) continue;
      const j = step(i, d);
      if (j < 0 || j === from) continue;
      let k = 1 + (din < 4 && d !== din ? TURN_COST : 0);
      if (T.isRoad[j]) {
        // Never joining the road where the flyover comes down over it.
        if (T.wet[j] || T.ring[j] === 2 || !reach[j] || flyRamp(T, j) || (accept && !accept(j))) continue;
        k += joinCost(T, j, d);
      } else {
        if (!roadable(T, j, avoid) || makesSquare(T, j, [i, start])) continue;
        if (T.wet[j]) {
          if (!T.wet[i] && !bridgeOk(T, j, d)) continue;
          k += 1.2;
        } else if (T.trees[j]) k += 0.3;
        if (beside(T, j, i)) k += HUG_COST;
      }
      const ns = j * 5 + d, nc = c + Math.max(0.2, k);
      if (nc < cost[ns]) { cost[ns] = nc; prev[ns] = s; heap.push(nc, ns); }
    }
  }
  return null;
}

/** @param {Town} T @param {number} a @param {number} b */
function link(T, a, b) {
  const d = dirTo(a, b);
  T.road[a] |= 1 << d;
  T.road[b] |= 1 << ((d + 2) % 4);
}
/** Lays road along `tiles` (each beside the last), growing from its start or its end; returns when it's all there.
 *  @param {Town} T @param {number[]} tiles @param {number} when @param {'start' | 'end'} [growFrom] */
function layRoad(T, tiles, when, growFrom = 'start') {
  let t = when;
  for (const i of growFrom === 'start' ? tiles : [...tiles].reverse()) {
    if (T.isRoad[i]) continue;
    T.isRoad[i] = 1;
    T.born[i] = t;
    T.trees[i] = 0;
    t += LAY;
  }
  for (let k = 1; k < tiles.length; k++) link(T, tiles[k - 1], tiles[k]);
  return t;
}
/** @param {Town} T @param {number} i @param {number} when */
function removeRoad(T, i, when) {
  T.ghosts.push({ kind: 'road', i, mask: T.road[i], gate: T.gate[i], died: when });
  for (let d = 0; d < 4; d++) if ((T.road[i] >> d) & 1) { const j = step(i, d); T.road[j] &= ~(1 << ((d + 2) % 4)); }
  T.road[i] = 0;
  T.isRoad[i] = 0;
  T.gate[i] = -1;
}
/** Takes away road that nothing needs: dead ends nobody faces, and road cut off from the roads out of town; never
 *  road a car is on or on its way along (`keep`). Returns how many tiles went. @param {Town} T @param {number} when
 *  @param {Uint8Array | null} keep */
function prune(T, when, keep) {
  let gone = 0;
  for (let again = true; again; ) {
    again = false;
    for (let i = 0; i < N; i++) {
      if (!T.isRoad[i] || T.gate[i] >= 0 || T.fronts[i] || T.ring[i] || flyEnd(T, i) || keep?.[i]) continue;
      if (bits(T.road[i]) <= 1) { removeRoad(T, i, when + gone * LAY); gone++; again = true; }
    }
  }
  const reach = reachable(T);
  for (let i = 0; i < N; i++) if (T.isRoad[i] && !reach[i] && !T.fronts[i] && !T.ring[i] && !flyEnd(T, i) && !keep?.[i]) { removeRoad(T, i, when); gone++; }
  return gone;
}

/** The land: a river from the top edge to the bottom, and clumps of trees. @param {Town} T */
function terrain(T) {
  const r = T.random;
  const x0 = W * (0.3 + r() * 0.4), lean = (r() - 0.5) * 9, bend = (1 + r() * 1.5) * (r() < 0.5 ? -1 : 1), phase = r() * Math.PI * 2;
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    T.river.push([x0 + lean * (t - 0.5) + bend * Math.sin(phase + t * Math.PI * 1.4), -1.5 + t * (H + 3)]);
  }
  const line = samples(T.river, 24);
  for (let i = 0; i < N; i++) {
    const [x, y] = centre(i);
    let d = Infinity;
    for (let k = 1; k < line.length; k++) d = Math.min(d, segDist(x, y, line[k - 1], line[k]));
    if (d < 1.3) T.wet[i] = 1;
    if (d < 1.85) T.shore[i] = 1;
  }
  for (let k = 0; k < 11; k++) {
    const cx = r() * W, cy = r() * H, rad = 1.1 + r() * 1.5;
    for (let i = 0; i < N; i++) {
      const [x, y] = centre(i);
      if (Math.hypot(x - cx, y - cy) < rad && !T.shore[i] && r() < 0.75) T.trees[i] = 1 + Math.floor(r() * 3);
    }
  }
}

/** The avenue right across the town, bridging the river, and a second road out of town from it to the top or bottom;
 *  returns when they're laid. @param {Town} T @param {number} when */
function avenue(T, when) {
  const rows = [];
  for (let y = 4; y <= H - 5; y++) {
    const wet = [];
    for (let x = 0; x < W; x++) if (T.wet[tileAt(x, y)]) wet.push(x);
    if (wet.length && wet.length <= BRIDGE_MAX && wet[wet.length - 1] - wet[0] === wet.length - 1) rows.push(y);
  }
  const y = rows.length ? rows[Math.floor(T.random() * rows.length)] : Math.floor(H / 2);
  const tiles = [];
  for (let x = 0; x < W; x++) tiles.push(tileAt(x, y));
  T.gate[tiles[0]] = 3;
  T.gate[tiles[W - 1]] = 1;
  const end = layRoad(T, tiles, when);
  const options = [];
  for (let x = 3; x <= W - 4; x++) {
    for (const dy of [-1, 1]) {
      const col = [];
      let ok = true;
      for (let yy = y + dy; yy >= 0 && yy < H; yy += dy) { const t = tileAt(x, yy); if (T.shore[t]) { ok = false; break; } col.push(t); }
      if (ok && col.length >= 4) options.push({ x, dy, col });
    }
  }
  if (options.length) {
    const { x, dy, col } = options[Math.floor(T.random() * options.length)];
    T.gate[col[col.length - 1]] = dy < 0 ? 0 : 2;
    return layRoad(T, [tileAt(x, y), ...col], end);
  }
  return end;
}

/** A big building's footprint at (bx, by), its car park on side `o` and the two tiles beyond that its door can be on.
 *  @param {number} bx @param {number} by @param {number} o */
function placeSite(bx, by, o) {
  if (!inMap(bx, by) || !inMap(bx + 1, by + 1)) return null;
  const block = [tileAt(bx, by), tileAt(bx + 1, by), tileAt(bx, by + 1), tileAt(bx + 1, by + 1)];
  const [lot, doors] = [
    [[[bx, by - 1], [bx + 1, by - 1]], [[bx, by - 2], [bx + 1, by - 2]]],
    [[[bx + 2, by], [bx + 2, by + 1]], [[bx + 3, by], [bx + 3, by + 1]]],
    [[[bx, by + 2], [bx + 1, by + 2]], [[bx, by + 3], [bx + 1, by + 3]]],
    [[[bx - 1, by], [bx - 1, by + 1]], [[bx - 2, by], [bx - 2, by + 1]]],
  ][o];
  if (!lot.every(([x, y]) => inMap(x, y))) return null;
  const doorTiles = doors.filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2).map(([x, y]) => tileAt(x, y));
  if (!doorTiles.length) return null;
  const lotTiles = lot.map(([x, y]) => tileAt(x, y));
  const all = [...block, ...lotTiles];
  const xs = all.map(xOf), ys = all.map(yOf);
  return { block, lot: lotTiles, doors: doorTiles, o, bx, by, cx: (Math.min(...xs) + Math.max(...xs) + 1) / 2, cy: (Math.min(...ys) + Math.max(...ys) + 1) / 2 };
}
/** Whether a building stands on any tile around these. @param {Town} T @param {number[]} tiles */
function crowded(T, tiles) {
  for (const t of tiles) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = tileAt(xOf(t) + dx, yOf(t) + dy); if (k >= 0 && T.use[k] >= 0) return true; }
  return false;
}

/** A new big building in `colour`, on open land, with the road to it laid from the network. @param {Town} T
 *  @param {number} colour @param {number} when */
function openPlace(T, colour, when) {
  const others = placesOf(T);
  const reach = reachable(T);
  /** @type {{ site: NonNullable<ReturnType<typeof placeSite>>, door: number, path: RoadPath | null, score: number } | null} */
  let best = null;
  for (let tries = 0; tries < 90; tries++) {
    const site = placeSite(Math.floor(T.random() * W), Math.floor(T.random() * H), Math.floor(T.random() * 4));
    if (!site) continue;
    const footprint = [...site.block, ...site.lot];
    if (!footprint.every((t) => buildable(T, t)) || crowded(T, footprint)) continue;
    if (others.some((p) => Math.hypot(p.cx - site.cx, p.cy - site.cy) < 6)) continue;
    const avoid = new Set(footprint);
    for (const door of site.doors) {
      let path = null;
      if (T.isRoad[door]) {
        if (T.wet[door] || T.ring[door] || !reach[door] || flyRamp(T, door)) continue;
      } else {
        path = findRoad(T, door, { avoid });
        if (!path) continue;
      }
      const score = Math.abs((path ? path.cost : 0) - 6) + T.random() * 4;
      if (!best || score < best.score) best = { site, door, path, score };
    }
  }
  if (!best) return null;
  const { site, door, path } = best;
  /** @type {Place} */
  const p = { id: T.nextId++, kind: 'place', colour, ...site, tiles: [...site.block, ...site.lot], door, slots: [], born: when };
  p.slots = lotSlots(p);
  for (const t of p.tiles) { T.use[t] = p.id; T.trees[t] = 0; }
  T.buildings.set(p.id, p);
  T.fronts[door]++;
  const end = path ? layRoad(T, path.tiles, when + 0.35, 'end') : when + 0.45;
  return { b: p, end, bridge: !!path?.bridge, at: /** @type {[number, number]} */ ([p.cx, p.cy]) };
}
/** Where cars park in a building's car park: four bays side by side, nose to the building. @param {Place} p */
function lotSlots(p) {
  const xs = p.lot.map(xOf), ys = p.lot.map(yOf);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const along = p.o === 0 || p.o === 2;
  const nose = [Math.PI / 2, Math.PI, -Math.PI / 2, 0][p.o];
  const depth = p.o === 0 ? 0.62 : p.o === 2 ? 0.38 : p.o === 1 ? 0.38 : 0.62;
  return [0, 1, 2, 3].map((k) => (along ? { x: x0 + 0.25 + k * 0.5, y: y0 + depth, angle: nose } : { x: x0 + depth, y: y0 + 0.25 + k * 0.5, angle: nose }));
}

/** The colours with buildings, those with the fewest homes for each building first. @param {Town} T */
function homeColours(T) {
  const out = [];
  for (let c = 0; c < COLOURS; c++) {
    const n = placesOf(T, c).length;
    if (n) out.push([homesOf(T, c).length / n + T.random() * 0.01, c]);
  }
  return out.sort((a, b) => a[0] - b[0]).map(([, c]) => c);
}
/** Whether a tile is a corner of a junction: kept free so the junction can become a roundabout. @param {Town} T
 *  @param {number} t */
function byJunction(T, t) {
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const k = tileAt(xOf(t) + dx, yOf(t) + dy);
    if (k >= 0 && T.isRoad[k] && (T.ring[k] === 1 || bits(T.road[k]) >= 3)) return true;
  }
  return false;
}
/** How many homes stand one after another from beside `t`, going `q`, facing the road the same way (`d`).
 *  @param {Town} T @param {number} t @param {number} d @param {number} q */
function inRow(T, t, d, q) {
  let n = 0;
  for (let k = step(t, q); k >= 0 && n < 3; k = step(k, q)) {
    const b = T.use[k] >= 0 ? T.buildings.get(T.use[k]) : null;
    if (!b || b.kind !== 'home' || b.face !== d) break;
    n++;
  }
  return n;
}
/** The best free tile for a home in `colour`: beside a road, near one of its buildings, among homes of its colour;
 *  only on the road tiles in `only` when given. @param {Town} T @param {number} colour @param {Float64Array} dist
 *  @param {Set<number> | null} [only] */
function bestFrontage(T, colour, dist, only = null) {
  /** @type {{ t: number, r: number, score: number } | null} */
  let best = null;
  for (let t = 0; t < N; t++) {
    if (!buildable(T, t) || byJunction(T, t)) continue;
    for (let d = 0; d < 4; d++) {
      const r = step(t, d);
      // Not facing the road where the flyover comes down, where its car would turn in and out under the ramp.
      if (r < 0 || !T.isRoad[r] || T.wet[r] || T.ring[r] || flyRamp(T, r) || (only ? !only.has(r) : dist[r] > 12)) continue;
      // At most two homes in a row along a road, so a new street can always branch off between them.
      if (inRow(T, t, d, (d + 1) % 4) + inRow(T, t, d, (d + 3) % 4) >= 2) continue;
      let same = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = tileAt(xOf(t) + dx, yOf(t) + dy); const b = k >= 0 && T.use[k] >= 0 ? T.buildings.get(T.use[k]) : null; if (b && b.colour === colour) same++; }
      const score = dist[r] + T.random() * 3 - same * 0.7 + (T.trees[t] ? 0.6 : 0);
      if (!best || score < best.score) best = { t, r, score };
    }
  }
  return best;
}
/** A short new street near a building, into open land: at right angles off a straight road, or on from the end of a
 *  dead end; joining another road if it meets one. @param {Town} T @param {Float64Array} dist @param {number} when */
function growStreet(T, dist, when) {
  /** @type {{ r: number, tiles: number[], through: number, score: number } | null} */
  let best = null;
  for (let r = 0; r < N; r++) {
    if (!T.isRoad[r] || dist[r] > 12 || T.wet[r] || T.ring[r] || T.gate[r] >= 0 || flyRamp(T, r) || nearJunction(T, r)) continue;
    const m = T.road[r];
    const ways = m === NS ? [1, 3] : m === EW ? [0, 2] : bits(m) === 1 ? [[2, 3, 0, 1][Math.log2(m)]] : [];
    for (const p of ways) {
      const tiles = [];
      let through = -1, last = r;
      for (let k = 0; k < 5; k++) {
        const t = step(last, p);
        if (t < 0) break;
        if (T.isRoad[t]) {
          if (tiles.length >= 2 && !T.wet[t] && !T.ring[t] && !flyRamp(T, t) && !nearJunction(T, t) && (T.road[t] === (p % 2 ? NS : EW) || bits(T.road[t]) === 1)) through = t;
          break;
        }
        if (!roadable(T, t) || T.wet[t] || makesSquare(T, t, [last])) break;
        if (sides(p).some((q) => { const s = step(t, q); return s >= 0 && T.isRoad[s]; })) break;
        tiles.push(t);
        last = t;
      }
      if (through < 0) {
        if (tiles.length > 4) tiles.length = 4;
        // A dead end mustn't stop right against another road.
        while (tiles.length) { const ahead = step(tiles[tiles.length - 1], p); if (ahead >= 0 && T.isRoad[ahead]) tiles.pop(); else break; }
      }
      if (tiles.length < 2) continue;
      // Only a street a home can stand on: a free tile beside it, away from the junction it makes.
      const room = tiles.slice(1).some((t) => sides(p).some((q) => { const s = step(t, q); return buildable(T, s) && !byJunction(T, s); }));
      if (!room) continue;
      const score = dist[r] + T.random() * 2 - (through >= 0 ? 2.5 : 0);
      if (!best || score < best.score) best = { r, tiles, through, score };
    }
  }
  if (!best) return null;
  const end = layRoad(T, [best.r, ...best.tiles, ...(best.through >= 0 ? [best.through] : [])], when);
  return { end, at: centre(best.tiles[0]), tiles: best.tiles };
}
/** A new home near a building of its colour (the colour with the fewest homes for each building, or the next if
 *  there's no room for that one), on a new street if there's no room on the roads there. @param {Town} T @param {number} when */
function addHome(T, when) {
  for (const colour of homeColours(T)) {
    const res = addHomeIn(T, colour, when);
    if (res) return res;
  }
  return null;
}
/** @param {Town} T @param {number} colour @param {number} when */
function addHomeIn(T, colour, when) {
  const doors = placesOf(T, colour).map((p) => p.door);
  let { dist } = roadField(T, doors);
  // Now and then a new street first, so neighbourhoods grow streets and not only line the roads they have.
  let pick = T.random() < 0.22 ? null : bestFrontage(T, colour, dist);
  let end = when, street = false;
  if (!pick) {
    const grown = growStreet(T, dist, when);
    if (grown) {
      end = grown.end;
      street = true;
      dist = roadField(T, doors).dist;
      // The home goes on the new street, which would otherwise stand empty.
      pick = bestFrontage(T, colour, dist, new Set(grown.tiles));
    }
    pick ??= bestFrontage(T, colour, dist);
    if (!pick) return grown ? { end, street, at: grown.at } : null;
  }
  /** @type {Home} */
  const b = { id: T.nextId++, kind: 'home', colour, tile: pick.t, front: pick.r, face: dirTo(pick.t, pick.r), born: end };
  T.use[b.tile] = b.id;
  T.trees[b.tile] = 0;
  T.fronts[b.front]++;
  T.buildings.set(b.id, b);
  return { b, end: end + 0.45, street, at: centre(b.tile) };
}
/** The colour with the most homes for each of its buildings loses its home farthest from them. @param {Town} T
 *  @param {number} when @param {Uint8Array | null} keep */
function removeHome(T, when, keep) {
  let colour = -1, top = -1;
  for (let c = 0; c < COLOURS; c++) {
    const n = placesOf(T, c).length, h = homesOf(T, c).length;
    if (!h) continue;
    const ratio = (n ? h / n : 99) + T.random() * 0.01;
    if (ratio > top) { colour = c; top = ratio; }
  }
  if (colour < 0) return null;
  const ps = placesOf(T, colour);
  const dist = ps.length ? roadField(T, ps.map((p) => p.door)).dist : new Float64Array(N);
  let pick = /** @type {Home} */ (homesOf(T, colour)[0]), far = -1;
  for (const h of homesOf(T, colour)) { const v = dist[h.front] + T.random() * 4; if (v > far) { far = v; pick = h; } }
  takeAway(T, pick, when);
  const gone = prune(T, when + 0.3, keep);
  return { b: pick, gone, at: centre(pick.tile), end: when + 0.6 + gone * LAY };
}
/** @param {Town} T @param {Building} b @param {number} when */
function takeAway(T, b, when) {
  // Trees grow back on some of the land, so where a neighbourhood thins out it turns green, not bare.
  for (const t of b.kind === 'home' ? [b.tile] : b.tiles) { T.use[t] = -1; if (T.random() < 0.45) T.trees[t] = 1 + Math.floor(T.random() * 2); }
  T.fronts[doorOf(b)]--;
  T.buildings.delete(b.id);
  T.ghosts.push({ kind: b.kind, b, died: when });
}
/** A building closes where its colour has another: the one with the fewest homes of its colour nearby. @param {Town} T
 *  @param {number} when @param {Uint8Array | null} keep */
function closePlace(T, when, keep) {
  /** @type {Place | null} */
  let pick = null, fewest = Infinity;
  for (const p of placesOf(T)) {
    if (placesOf(T, p.colour).length < 2) continue;
    const { dist } = roadField(T, [p.door]);
    const near = homesOf(T, p.colour).filter((h) => dist[h.front] <= 9).length + T.random() * 2;
    if (near < fewest) { fewest = near; pick = p; }
  }
  if (!pick) return null;
  takeAway(T, pick, when);
  const gone = prune(T, when + 0.3, keep);
  return { b: pick, gone, at: /** @type {[number, number]} */ ([pick.cx, pick.cy]), end: when + 0.6 + gone * LAY };
}
/** The colour that most needs another building: the most homes for each it has. @param {Town} T */
function placeColour(T) {
  let best = 0, top = -1;
  for (let c = 0; c < COLOURS; c++) {
    const n = placesOf(T, c).length;
    const ratio = (n ? homesOf(T, c).length / n : 99) + T.random() * 0.5;
    if (ratio > top) { top = ratio; best = c; }
  }
  return best;
}

/** The busiest junction with room around it becomes a roundabout, if at least `least` trips go through it and no
 *  car stands on it or beside it (`cars`). @param {Town} T @param {number} when @param {number} [least]
 *  @param {Uint8Array | null} [cars] */
function addRoundabout(T, when, least = RING_BUSY, cars = null) {
  let rings = 0;
  for (let i = 0; i < N; i++) if (T.ring[i] === 1) rings++;
  if (rings >= RINGS) return null;
  const busy = busyness(T);
  let best = -1;
  for (let c = 0; c < N; c++) {
    if (!T.isRoad[c] || T.ring[c] || T.wet[c] || T.gate[c] >= 0 || flyRamp(T, c) || bits(T.road[c]) < 3 || busy[c] < least || cars?.[c]) continue;
    const x = xOf(c), y = yOf(c);
    if (x < 2 || y < 2 || x > W - 3 || y > H - 3) continue;
    let ok = true;
    for (let dy = -1; dy <= 1 && ok; dy++) {
      for (let dx = -1; dx <= 1 && ok; dx++) {
        if (!dx && !dy) continue;
        const k = tileAt(x + dx, y + dy);
        if (T.use[k] >= 0 || T.wet[k] || T.ring[k] || flyRamp(T, k) || T.fronts[k] || cars?.[k]) ok = false;
        else if (dx && dy) { if (T.isRoad[k]) ok = false; }
        else if (T.isRoad[k]) {
          // Each arm runs straight out from the ring for a tile at least.
          const d = dirTo(c, k), back = 1 << ((d + 2) % 4);
          if (T.road[k] !== (back | (1 << d)) && T.road[k] !== back && T.gate[k] !== d) ok = false;
        }
      }
    }
    if (!ok) continue;
    for (let i = 0; i < N && ok; i++) if (T.ring[i] === 1 && Math.max(Math.abs(xOf(i) - x), Math.abs(yOf(i) - y)) <= 5) ok = false;
    if (ok && (best < 0 || busy[c] > busy[best])) best = c;
  }
  if (best < 0) return null;
  T.ring[best] = 1;
  T.ringBorn[best] = when;
  // The ring covers the tiles round it that aren't its arms: nothing stands or grows there.
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = tileAt(xOf(best) + dx, yOf(best) + dy); if (k !== best && !T.isRoad[k]) { T.ring[k] = 2; T.trees[k] = 0; } }
  return { at: centre(best), end: when + 0.6 };
}

/** A new road from a busy straight road that reaches somewhere much farther away by the roads: a short cut, over the
 *  river if that's the way. @param {Town} T @param {number} when */
function addShortcut(T, when) {
  let roads = 0;
  for (let i = 0; i < N; i++) roads += T.isRoad[i];
  if (roads >= ROADS_MAX) return null;
  const busy = busyness(T);
  // From the side of a straight stretch, or on from the end of a dead end.
  const starts = [];
  for (let a = 0; a < N; a++) {
    if (!T.isRoad[a] || T.wet[a] || T.ring[a] || T.gate[a] >= 0 || flyRamp(T, a) || nearJunction(T, a)) continue;
    const m = T.road[a];
    const ways = m === NS ? [1, 3] : m === EW ? [0, 2] : bits(m) === 1 ? [[2, 3, 0, 1][Math.log2(m)]] : [];
    if (ways.length) starts.push({ a, ways, w: busy[a] + T.random() * 6 });
  }
  starts.sort((p, q) => q.w - p.w);
  for (const { a, ways } of starts.slice(0, 16)) {
    const { dist } = roadField(T, [a]);
    for (const p of ways) {
      const start = step(a, p);
      if (start < 0 || !roadable(T, start) || T.wet[start] || beside(T, start, a) || makesSquare(T, start)) continue;
      const accept = (/** @type {number} */ j) => dist[j] >= Math.max(8, 2 * (Math.abs(xOf(j) - xOf(a)) + Math.abs(yOf(j) - yOf(a))) + 2) && !nearJunction(T, j);
      const path = findRoad(T, start, { accept, from: a, maxCost: 16 });
      if (!path) continue;
      const end = layRoad(T, [a, ...path.tiles], when);
      return { bridge: path.bridge, at: centre(start), end };
    }
  }
  return null;
}

/** A stretch of road no trip uses and nothing faces is taken away, if everything can still be reached without it and
 *  no car is on it or on its way along it (`keep`). @param {Town} T @param {number} when @param {Uint8Array | null} keep */
function removeUnusedRoad(T, when, keep) {
  const busy = busyness(T);
  const plain = (/** @type {number} */ i) => T.isRoad[i] && bits(T.road[i]) === 2 && T.gate[i] < 0 && !T.fronts[i] && !T.ring[i] && !flyEnd(T, i) && busy[i] === 0 && !keep?.[i];
  const seen = new Uint8Array(N);
  const runs = [];
  for (let i = 0; i < N; i++) {
    if (seen[i] || !plain(i)) continue;
    const run = [], todo = [i];
    seen[i] = 1;
    while (todo.length) {
      const k = /** @type {number} */ (todo.pop());
      run.push(k);
      for (let d = 0; d < 4; d++) if ((T.road[k] >> d) & 1) { const j = step(k, d); if (!seen[j] && plain(j)) { seen[j] = 1; todo.push(j); } }
    }
    runs.push({ run, w: T.random() });
  }
  runs.sort((p, q) => p.w - q.w);
  for (const { run } of runs) {
    // Taken away on trial first: everyone must still be reachable without it.
    const touched = new Set(run);
    for (const k of run) for (let d = 0; d < 4; d++) { const j = step(k, d); if (j >= 0) touched.add(j); }
    const saved = [...touched].map((k) => [k, T.road[k], T.isRoad[k]]);
    for (const k of run) {
      for (let d = 0; d < 4; d++) if ((T.road[k] >> d) & 1) { const j = step(k, d); T.road[j] &= ~(1 << ((d + 2) % 4)); }
      T.road[k] = 0;
      T.isRoad[k] = 0;
    }
    const reach = reachable(T);
    let ok = [...T.buildings.values()].every((b) => reach[doorOf(b)]) && (!T.flyover || (reach[T.flyover.a] && reach[T.flyover.b]));
    for (let i = 0; i < N && ok; i++) if (T.ring[i] === 1 && !reach[i]) ok = false;
    for (const [k, m, r] of saved) { T.road[k] = m; T.isRoad[k] = r; }
    if (!ok) continue;
    run.forEach((k, n) => removeRoad(T, k, when + n * LAY));
    const gone = run.length + prune(T, when + run.length * LAY, keep);
    return { gone, at: centre(run[0]), end: when + gone * LAY + 0.6 };
  }
  return null;
}

/** The flyover: a raised road joining two straight stretches far apart that are much farther apart by the roads. It
 *  leaves each of them sideways, like a side road at a junction, its ramp coming down over open ground beside the
 *  road, so the road rises into it and cars turn onto it from either way. Nothing is built under it, and nothing on
 *  the ground its ramps come down on. @param {Town} T @param {number} when */
function addFlyover(T, when) {
  if (T.flyover) return null;
  const ends = [];
  for (let i = 0; i < N; i++) {
    if (!T.isRoad[i] || T.wet[i] || T.ring[i] || T.gate[i] >= 0 || T.fronts[i] || (T.road[i] !== NS && T.road[i] !== EW) || nearJunction(T, i)) continue;
    const x = xOf(i), y = yOf(i);
    if (x < 2 || y < 2 || x > W - 3 || y > H - 3) continue;
    ends.push(i);
  }
  const pairs = [];
  for (const a of ends) {
    const { dist } = roadField(T, [a]);
    for (const b of ends) {
      if (b <= a || !Number.isFinite(dist[b])) continue;
      const [ax, ay] = centre(a), [bx, by] = centre(b);
      const e = Math.hypot(bx - ax, by - ay);
      if (e < 8 || dist[b] < 1.3 * e) continue;
      // Each end leaves its road sideways towards the other, so the flyover leaves and lands in a gentle curve.
      const facing = (/** @type {number} */ i) => { const [u, v] = T.road[i] === EW ? [0, 1] : [1, 0]; return Math.abs(u * (bx - ax) + v * (by - ay)) / e; };
      if (facing(a) < 0.45 || facing(b) < 0.45) continue;
      pairs.push({ a, b, score: dist[b] - 1.2 * e + T.random() * 2 });
    }
  }
  pairs.sort((p, q) => q.score - p.score);
  for (const { a, b } of pairs.slice(0, 200)) {
    const da = leaving(T, a, b), db = leaving(T, b, a);
    // Where a ramp comes down, beside its road, the ground is open: no road, building, water or roundabout.
    const open = (/** @type {number} */ n) => n >= 0 && !T.isRoad[n] && T.use[n] < 0 && !T.wet[n] && !T.ring[n];
    if (!open(step(a, da)) || !open(step(b, db))) continue;
    const pts = flyCurve(a, b, da, db);
    const corridor = new Set();
    let ok = true;
    const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
    for (const [x, y] of pts) {
      if (x < 0.4 || y < 0.4 || x > W - 0.4 || y > H - 0.4) { ok = false; break; }
      if (Math.hypot(x - ax, y - ay) < 1 || Math.hypot(x - bx, y - by) < 1) continue;
      for (let ty = Math.floor(y - 0.9); ty <= Math.floor(y + 0.9); ty++) for (let tx = Math.floor(x - 0.9); tx <= Math.floor(x + 0.9); tx++) {
        const t = tileAt(tx, ty);
        if (t >= 0 && Math.hypot(tx + 0.5 - x, ty + 0.5 - y) < 0.85) corridor.add(t);
      }
    }
    if (!ok || [...corridor].some((t) => T.use[t] >= 0 || T.ring[t])) continue;
    for (const t of corridor) T.under[t] = 1;
    for (const n of [step(a, da), step(b, db)]) { T.under[n] = 1; T.trees[n] = 0; }
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    T.flyover = { a, b, da, db, pts, len, cost: len * 0.5, born: when };
    return { at: pts[pts.length >> 1], end: when + 1.3 };
  }
  return null;
}
/** The way the flyover leaves the straight road tile `a`: sideways, towards `b`. @param {Town} T @param {number} a
 *  @param {number} b */
function leaving(T, a, b) {
  return T.road[a] === EW ? (yOf(b) > yOf(a) ? 2 : 0) : xOf(b) > xOf(a) ? 1 : 3;
}
/** The flyover's line: a curve leaving `a` in direction `da` and `b` in `db`. @param {number} a @param {number} b
 *  @param {number} da @param {number} db */
function flyCurve(a, b, da, db) {
  const P0 = centre(a), P3 = centre(b);
  const k = 0.36 * Math.hypot(P3[0] - P0[0], P3[1] - P0[1]);
  const P1 = [P0[0] + DX[da] * k, P0[1] + DY[da] * k], P2 = [P3[0] + DX[db] * k, P3[1] + DY[db] * k];
  /** @type {[number, number][]} */
  const pts = [];
  for (let s = 0; s <= 48; s++) {
    const t = s / 48, u = 1 - t;
    pts.push([u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]]);
  }
  return pts;
}

/** Seconds a watched build takes, from its first road to its last home, whose pop settles a moment later. */
export const BUILD = 4.2;

/** The day's town, built from nothing: land, the avenue, the big buildings with their roads, short cuts, the flyover,
 *  a roundabout where it's busiest, and the homes. Watched (from `start`, seconds on the drawing's clock), each piece
 *  goes up after the last, its roads laying themselves, the whole build taking BUILD seconds; otherwise it's all there
 *  at once, born before any clock starts, so nothing pops when the town first shows. The town is the same either way.
 *  Returns when the build is done. @param {Town} T @param {number} [start] */
export function build(T, start = -Infinity) {
  terrain(T);
  // Each piece on a clock of its own, a moment after the last; squeezed into BUILD seconds at the end.
  let t = avenue(T, 0) + 0.3;
  /** @param {{ end: number } | null} res */
  const next = (res) => { t = Math.max(t, res?.end ?? t) + 0.3; };
  const order = [0, 1, 2, 3, 4].map((c) => [T.random(), c]).sort((a, b) => a[0] - b[0]).map(([, c]) => c);
  for (let k = 0; k < PLACES; k++) next(openPlace(T, k < COLOURS ? order[k] : placeColour(T), t));
  for (let k = 0; k < 2; k++) next(addShortcut(T, t));
  next(addFlyover(T, t));
  // The roundabout before the homes, where the visitors' trips meet, so the homes leave room round it.
  next(addRoundabout(T, t, 1));
  // The homes in quick succession, one waiting only for a street laid for it.
  for (let guard = 0; homesOf(T).length < HOMES && guard < HOMES * 3; guard++) {
    const res = addHome(T, t);
    if (!res) break;
    t = Math.max(t, res.b ? res.b.born : res.end) + 0.12;
  }
  const watched = Number.isFinite(start);
  let last = 0;
  for (let i = 0; i < N; i++) { if (T.isRoad[i]) last = Math.max(last, T.born[i]); if (T.ring[i] === 1) last = Math.max(last, T.ringBorn[i]); }
  for (const b of T.buildings.values()) last = Math.max(last, b.born);
  if (T.flyover) last = Math.max(last, T.flyover.born);
  const at = (/** @type {number} */ x) => (watched ? start + (x / (last || 1)) * BUILD : -Infinity);
  for (let i = 0; i < N; i++) { if (T.isRoad[i]) T.born[i] = at(T.born[i]); if (T.ring[i] === 1) T.ringBorn[i] = at(T.ringBorn[i]); }
  for (const b of T.buildings.values()) b.born = at(b.born);
  if (T.flyover) T.flyover.born = at(T.flyover.born);
  return watched ? start + BUILD : -Infinity;
}

/**
 * @typedef {{ kind: 'roundabout' | 'shortcut' | 'road-gone' | 'opened' | 'closed' | 'home' | 'street' | 'home-gone',
 *   at: [number, number], end: number, b?: Building, bridge?: boolean, gone?: number, street?: boolean }} Change
 * What changed: `at` is where, `end` when its roads have all laid themselves (on the drawing's clock); `b` the
 * building that went up or came down, `bridge` whether a new road crossed the river, `gone` how many road tiles went,
 * `street` whether a new home came with a new street.
 */
/** One change at `when`: adding and taking away in balance so the town keeps its size. `inUse` says which tiles the
 *  traffic needs: `route`, those a car is on or on its way along, from under which no road goes; and `body`, those a
 *  car stands on, where no junction becomes a roundabout. Returns what happened, or null if nothing could.
 *  @param {Town} T @param {number} when @param {{ route: Uint8Array, body: Uint8Array } | null} [inUse]
 *  @returns {Change | null} */
export function change(T, when, inUse = null) {
  const keep = inUse?.route ?? null;
  const homes = homesOf(T).length, places = placesOf(T).length;
  const roll = T.random();
  if (roll < 0.07) { const res = addRoundabout(T, when, RING_BUSY, inUse?.body); if (res) return { kind: 'roundabout', ...res }; }
  else if (roll < 0.14) { const res = addShortcut(T, when); if (res) return { kind: 'shortcut', ...res }; }
  else if (roll < 0.2) { const res = removeUnusedRoad(T, when, keep); if (res) return { kind: 'road-gone', ...res }; }
  if (T.random() < 0.18) {
    const open = places < PLACES || (places === PLACES && T.random() < 0.5);
    if (open) {
      const res = openPlace(T, placeColour(T), when);
      if (res) return { kind: 'opened', ...res };
    }
    const res = closePlace(T, when, keep);
    if (res) return { kind: 'closed', ...res };
  }
  const add = homes < HOMES - 2 || (homes <= HOMES + 2 && T.random() < 0.5);
  if (add) {
    const res = addHome(T, when);
    return res ? { kind: res.b ? 'home' : 'street', ...res } : null;
  }
  const res = removeHome(T, when, keep);
  return res ? { kind: 'home-gone', ...res } : null;
}
