// Jack's Town's roads as its cars drive them. Every road carries a lane each way (cars keep left, as in Malaysia), and
// the lanes meet in boxes: a junction (where the flyover leaves a road, too, as one more road), each road's meeting
// with a roundabout's ring, a dead end (where a car can turn round), and every stretch of road that a home's drive or a
// car park opens onto. A box holds the
// ways across it (moves). Two moves of a box that come near each other from different lanes are foes: a car takes a
// move only while none of its foes is in use, and it stops only on the lanes between boxes, never in one (traffic.js
// keeps both rules). The ways are laid as a car's wheels go: the leading axle along the lane and round a bend as wide
// as fits; into a drive or a bay, the back axle along a curve that ends square in it, so a car parks straight with no
// last-moment shuffle. Built from the map (map.js) afresh after every change; tested by tests/town-roads.test.js.
import { centre, degree, DX, DY, doorOf, Heap, RING_R, roadChains, step, xOf, yOf } from './map.js';

/** @typedef {import('./map.js').Town} Town @typedef {import('./map.js').Building} Building
 *  @typedef {import('./map.js').Place} Place */
/** @typedef {[number, number]} Pt */
/**
 * @typedef {{ pts: Pt[], lens: number[], len: number, u0: Pt, u1: Pt }} Line
 * A line of points, the distance along it at each, and the way it heads at its start and end.
 * @typedef {{ id: number, line: Line, from: Box | null, to: Box | null, outs: Move[], ins: Move[], noStop: boolean,
 *   up: boolean, gateIn: boolean, gateOut: boolean, cars: any[], incoming: number }} Seg
 * A lane between two boxes (`from` null: it comes in from past the map's edge; `to` null: it leaves the map). `noStop`:
 * too short for a car to stand on, or a roundabout's ring, where nobody stops. `up`: the flyover's deck. `cars` and
 * `incoming` are the traffic's: the cars on it, front first, and how many more have been let in.
 * @typedef {{ id: number, box: Box, kind: 'through' | 'turn' | 'uturn' | 'park' | 'leave' | 'ring-in' | 'ring-out' | 'ring',
 *   from: Seg | Spot, to: Seg | Spot, line: Line, lead: number, rear: Line | null, rear0: Pt, minor: boolean,
 *   foes: Move[], held: number, cost: number, sweep: number[][], clear: number }} Move
 * A way across a box. `line` is where the car's leading axle goes; for the first `lead` of it the car steers along it,
 * and after that (into a drive or a bay) its back axle follows `rear` instead. `rear0` is where its back axle is as
 * it starts. `minor`: a move into or out of a drive or a car park, or onto a roundabout, which gives way. `sweep` is
 * where a car's body goes along it; `clear`, how far past its end a car's leading axle must be for its body to be out
 * of the way of every foe (usually just out of the box; farther where a car leaves the box at a slant, say).
 * `held` is the traffic's: how many cars are on it or let onto it.
 * @typedef {{ id: number, kind: 'junction' | 'end' | 'stop' | 'ring', tile: number, moves: Move[] }} Box
 * @typedef {{ id: number, b: Building, slot: number, box: Box | null, R: Pt, u: Pt, ins: Move[], outs: Move[] }} Spot
 * Where a car parks: a home's drive (`slot` -1) or a bay. `R` is its back axle there and `u` the way it faces.
 * @typedef {{ segs: Seg[], moves: Move[], boxes: Box[], spots: Spot[], spotOf: Map<string, Spot>, gatesIn: Seg[], gatesOut: Seg[] }} Roads
 */

/** How far a lane runs from the road's middle. */
export const LANE = 0.16;
/** A car's length and width, and how far apart its axles are (its middle is midway between them). */
export const CAR_L = 0.4, CAR_W = 0.2, AXLES = 0.24;
/** The room a car keeps to the car in front. */
export const GAP = 0.12;
/** The bend from a roundabout's road onto its ring; it leaves the road this far from the ring's middle, and meets the
 *  ring this far round from the road. */
const FILLET = 0.3;
const RING_LANE = RING_R + LANE;
const RING_IN = Math.sqrt((RING_LANE + FILLET) ** 2 - (LANE + FILLET) ** 2);
const RING_PHI = Math.atan2(LANE + FILLET, RING_IN);
/** How far apart points are laid along a bend. */
const SAMPLE = 0.04;
/** A car parked on its drive: its middle this far from the road's middle. */
const DRIVE = 0.55;
/** In a car park, across it from its mouth: where a car comes in, its aisle, and the bays' middles. */
const MOUTH = -0.05, AISLE = 0.18, BAY = 0.62;
/** What turning round counts for in choosing a way, against a tile of road. */
const UTURN = 6;

const sub = (/** @type {Pt} */ a, /** @type {Pt} */ b) => /** @type {Pt} */ ([a[0] - b[0], a[1] - b[1]]);
const along = (/** @type {Pt} */ a, /** @type {Pt} */ u, /** @type {number} */ k) => /** @type {Pt} */ ([a[0] + u[0] * k, a[1] + u[1] * k]);
const dot = (/** @type {Pt} */ a, /** @type {Pt} */ b) => a[0] * b[0] + a[1] * b[1];
const cross = (/** @type {Pt} */ a, /** @type {Pt} */ b) => a[0] * b[1] - a[1] * b[0];
/** @param {Pt} a @returns {Pt} */
const unit = (a) => { const l = Math.hypot(a[0], a[1]); return l > 1e-12 ? [a[0] / l, a[1] / l] : [1, 0]; };
/** The left of heading `u` (y runs down the map). @param {Pt} u @returns {Pt} */
const leftOf = (u) => [u[1], -u[0]];
/** @param {number} d @returns {Pt} */
const dirOf = (d) => [DX[d], DY[d]];

/** @param {Pt[]} pts @param {Pt | null} [u] the way a line of one point heads @param {number} [gap] points nearer
 *  than this to the one before are left out */
export function makeLine(pts, u = null, gap = 1e-6) {
  /** @type {Pt[]} */
  const out = [];
  for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > gap) out.push([p[0], p[1]]); }
  const lens = [0];
  for (let k = 1; k < out.length; k++) lens.push(lens[k - 1] + Math.hypot(out[k][0] - out[k - 1][0], out[k][1] - out[k - 1][1]));
  const n = out.length;
  return { pts: out, lens, len: lens[n - 1], u0: n > 1 ? unit(sub(out[1], out[0])) : u ?? [1, 0], u1: n > 1 ? unit(sub(out[n - 1], out[n - 2])) : u ?? [1, 0] };
}
/** The stretch of a line that distance `s` falls in. @param {Line} line @param {number} s */
function seek(line, s) {
  const { lens } = line;
  let lo = 0, hi = lens.length - 1;
  if (hi < 1 || s <= 0) return 0;
  if (s >= line.len) return hi - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (lens[mid] <= s) lo = mid; else hi = mid; }
  return lo;
}
/** The point `s` along a line, running on straight past either end. @param {Line} line @param {number} s @returns {Pt} */
export function pointAt(line, s) {
  const { pts, lens } = line;
  if (pts.length === 1) return along(pts[0], line.u0, s);
  const k = seek(line, s), t = (s - lens[k]) / (lens[k + 1] - lens[k]);
  return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t];
}
/** The way a line heads `s` along it. @param {Line} line @param {number} s */
export function dirAt(line, s) {
  if (line.pts.length === 1) return line.u0;
  const k = seek(line, s);
  return unit(sub(line.pts[k + 1], line.pts[k]));
}
/** @param {Line[]} lines */
function joinLines(...lines) {
  return makeLine(lines.flatMap((l) => l.pts), lines[0].u0);
}

/** Points along a curve with these four control points. @param {Pt} a @param {Pt} b @param {Pt} c @param {Pt} d */
function bezier(a, b, c, d) {
  const n = Math.max(4, Math.ceil((Math.hypot(...sub(b, a)) + Math.hypot(...sub(c, b)) + Math.hypot(...sub(d, c))) / SAMPLE));
  /** @type {Pt[]} */
  const out = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, w = 1 - t;
    out.push([w * w * w * a[0] + 3 * w * w * t * b[0] + 3 * w * t * t * c[0] + t * t * t * d[0], w * w * w * a[1] + 3 * w * w * t * b[1] + 3 * w * t * t * c[1] + t * t * t * d[1]]);
  }
  return out;
}
/**
 * The way an axle takes from `a`, heading `u`, to `b`, heading `v`: straight on, round one bend as wide as fits, and
 * straight on into `b`; an S-bend between two that head the same way side by side; a loop between two that head
 * opposite ways. `exact`: it leaves `a` and comes into `b` heading exactly `u` and `v`, so a car following it turns
 * no further at either end. @param {Pt} a @param {Pt} u @param {Pt} b @param {Pt} v @returns {Pt[]}
 */
export function turnPath(a, u, b, v, exact = true) {
  const pts = turnPoints(a, u, b, v);
  if (!exact) return pts;
  const e = 0.003, far = (/** @type {Pt} */ p) => Math.hypot(...sub(p, a)) > 2 * e && Math.hypot(...sub(p, b)) > 2 * e;
  return [a, along(a, u, e), ...pts.slice(1, -1).filter(far), along(b, v, -e), b];
}
/** @param {Pt} a @param {Pt} u @param {Pt} b @param {Pt} v @returns {Pt[]} */
function turnPoints(a, u, b, v) {
  const d = sub(b, a), c = cross(u, v), dt = dot(u, v);
  if (dt > 0.9999) {
    const fwd = dot(d, u);
    if (Math.abs(dot(d, leftOf(u))) < 1e-4 && fwd > 0) return [a, b];
    const h = Math.max(0.1, fwd * 0.45);
    return bezier(a, along(a, u, h), along(b, v, -h), b);
  }
  if (dt < -0.9999) {
    // A loop out and round, swinging wide of the far lane so the turn isn't too tight.
    const side = Math.sign(dot(d, leftOf(u))) || 1, out = along([0, 0], leftOf(u), -0.15 * side);
    return bezier(a, [a[0] + u[0] * 0.5 + out[0], a[1] + u[1] * 0.5 + out[1]], [b[0] + u[0] * 0.5 - out[0] * 0.2, b[1] + u[1] * 0.5 - out[1] * 0.2], b);
  }
  // Where the two lines meet: the bend's corner, `t` on from a and `s` back from b.
  const t = cross(d, v) / c, s = cross(u, d) / c;
  const theta = Math.acos(Math.max(-1, Math.min(1, dt)));
  if (t > 1e-6 && s > 1e-6) {
    const tau = Math.min(t, s), rho = tau / Math.tan(theta / 2);
    const k = along(a, u, t), t1 = along(k, u, -tau);
    /** @type {Pt} */
    const n = c > 0 ? [-u[1], u[0]] : [u[1], -u[0]];
    const o = along(t1, n, rho), a0 = Math.atan2(t1[1] - o[1], t1[0] - o[0]), sign = c > 0 ? 1 : -1;
    const m = Math.max(2, Math.ceil((rho * theta) / SAMPLE));
    /** @type {Pt[]} */
    const pts = [a];
    for (let i = 0; i <= m; i++) { const ang = a0 + (sign * theta * i) / m; pts.push([o[0] + rho * Math.cos(ang), o[1] + rho * Math.sin(ang)]); }
    pts.push(b);
    return pts;
  }
  const chord = Math.hypot(d[0], d[1]), h = Math.min(0.6 * chord, ((4 / 3) * Math.tan(theta / 4) * chord) / (2 * Math.sin(theta / 2) || 1));
  return bezier(a, along(a, u, h), along(b, v, -h), b);
}
/** One line through poses [point, heading], turning between each and the next. @param {[Pt, Pt][]} ways */
function wayLine(ways) {
  /** @type {Pt[]} */
  const pts = [];
  for (let k = 0; k < ways.length - 1; k++) pts.push(...turnPath(ways[k][0], ways[k][1], ways[k + 1][0], ways[k + 1][1]));
  return makeLine(pts.length ? pts : [ways[0][0]], ways[0][1]);
}

/** The back axle `AXLES` behind the front at `f`, pulled along from where it was (`r`): it moves only the way the car
 *  points, as a real car's back wheels do. @param {Pt} r @param {Pt} f @returns {Pt} */
export function follow(r, f) {
  const u = unit(sub(f, r));
  return [f[0] - u[0] * AXLES, f[1] - u[1] * AXLES];
}
/** The back axle's line for a car steering its front axle along `line` from `r` (its back axle as it starts), and
 *  where its back axle ends up. @param {Line} line @param {Pt} r */
function trail(line, r) {
  const pts = [r];
  for (let s = SAMPLE; s < line.len + SAMPLE; s += SAMPLE) { r = follow(r, pointAt(line, Math.min(s, line.len))); pts.push(r); }
  return { pts, end: r };
}
/** Where the front axle goes while the back axle follows `rear`. @param {Line} rear */
function frontOf(rear) {
  const n = rear.pts.length;
  return rear.pts.map((p, k) => along(p, k < n - 1 ? unit(sub(rear.pts[k + 1], p)) : rear.u1, AXLES));
}

/** A line moved `d` to the left of the way it runs. @param {Pt[]} pts */
function offsetLeft(pts, d) {
  const n = pts.length;
  return pts.map((p, k) => {
    const u = unit(sub(pts[Math.min(n - 1, k + 1)], pts[Math.max(0, k - 1)]));
    return /** @type {Pt} */ ([p[0] + u[1] * d, p[1] - u[0] * d]);
  });
}
/** A road's middle, its bends rounded as the road is drawn. Its points keep a little apart: two almost on top of each
 *  other would turn the lanes beside them back on themselves on a tight bend. @param {{ pts: Pt[], radii: number[] }} ch */
function middleOf(ch) {
  const P = ch.pts, pts = [P[0]];
  for (let k = 1; k < P.length - 1; k++) {
    const u = unit(sub(P[k], P[k - 1])), v = unit(sub(P[k + 1], P[k])), r = ch.radii[k];
    pts.push(...turnPath(along(P[k], u, -r), u, along(P[k], v, r), v, false));
  }
  pts.push(P[P.length - 1]);
  return makeLine(pts, null, 0.01);
}
/** A road's two lanes, cut where asked: `fwd(s0, s1)`, the lane going along the road, beside its middle from distance
 *  `s0` to `s1`; `bwd(s0, s1)`, the lane coming back past the same stretch. @param {Line} mid */
function lanesOf(mid) {
  const n = mid.pts.length;
  const F = offsetLeft(mid.pts, LANE), B = offsetLeft([...mid.pts].reverse(), LANE);
  /** @param {number} s @returns {[number, number]} */
  const locate = (s) => { const k = seek(mid, s), l = mid.lens[k + 1] - mid.lens[k]; return [k, l > 0 ? Math.max(0, Math.min(1, (s - mid.lens[k]) / l)) : 0]; };
  /** @param {Pt[]} P @param {number} k @param {number} t @returns {Pt} */
  const lerp = (P, k, t) => [P[k][0] + (P[k + 1][0] - P[k][0]) * t, P[k][1] + (P[k + 1][1] - P[k][1]) * t];
  /** @param {Pt[]} P @param {[number, number]} from @param {[number, number]} to */
  const cutOut = (P, [ka, ta], [kb, tb]) => {
    const pts = [lerp(P, ka, ta)];
    for (let k = ka + 1; k <= kb; k++) pts.push(P[k]);
    pts.push(lerp(P, kb, tb));
    return makeLine(pts, unit(sub(P[ka + 1], P[ka])));
  };
  return {
    fwd: (/** @type {number} */ s0, /** @type {number} */ s1) => cutOut(F, locate(s0), locate(s1)),
    bwd: (/** @type {number} */ s0, /** @type {number} */ s1) => {
      const [k1, t1] = locate(s1), [k0, t0] = locate(s0);
      return cutOut(B, [n - 2 - k1, 1 - t1], [n - 2 - k0, 1 - t0]);
    },
  };
}
/** Where a line runs through the tile at (x0, y0): its first and last distances inside. @param {Line} line
 *  @param {number} x0 @param {number} y0 */
function spanIn(line, x0, y0) {
  let first = Infinity, last = -Infinity;
  for (let k = 0; k < line.pts.length - 1; k++) {
    const [ax, ay] = line.pts[k], [bx, by] = line.pts[k + 1], dx = bx - ax, dy = by - ay;
    let t0 = 0, t1 = 1;
    for (const [p, q] of [[-dx, ax - x0], [dx, x0 + 1 - ax], [-dy, ay - y0], [dy, y0 + 1 - ay]]) {
      if (Math.abs(p) < 1e-12) { if (q < 0) t1 = -1; continue; }
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
    }
    if (t0 <= t1) { const l = line.lens[k + 1] - line.lens[k]; first = Math.min(first, line.lens[k] + t0 * l); last = Math.max(last, line.lens[k] + t1 * l); }
  }
  return [first, last];
}

/** A car park's frame: `at(u, w)` is `u` along it from level with its door's middle and `w` in from its mouth.
 *  @param {Place} p */
function lotFrame(p) {
  const inward = dirOf((p.o + 2) % 4), axis = dirOf(p.o % 2 ? 2 : 1);
  const edge = along(centre(p.door), dirOf(p.o), -0.5);
  return {
    inward, axis,
    at: (/** @type {number} */ u, /** @type {number} */ w) => /** @type {Pt} */ ([edge[0] + axis[0] * u + inward[0] * w, edge[1] + axis[1] * u + inward[1] * w]),
    uOf: (/** @type {Pt} */ q) => dot(sub(q, edge), axis),
  };
}

/** Whether two boxes overlap, each [middle x, middle y, heading x, heading y] with half its length and half its width
 *  given. @param {number[]} a @param {number} la @param {number} wa @param {number[]} b @param {number} lb @param {number} wb */
export function boxesTouch(a, la, wa, b, lb, wb) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (dx * dx + dy * dy > (la + wa + lb + wb) ** 2) return false;
  for (const [nx, ny] of [[a[2], a[3]], [-a[3], a[2]], [b[2], b[3]], [-b[3], b[2]]]) {
    const ra = la * Math.abs(a[2] * nx + a[3] * ny) + wa * Math.abs(-a[3] * nx + a[2] * ny);
    const rb = lb * Math.abs(b[2] * nx + b[3] * ny) + wb * Math.abs(-b[3] * nx + b[2] * ny);
    if (Math.abs(dx * nx + dy * ny) > ra + rb) return false;
  }
  return true;
}
/** Whether two cars' bodies overlap, each grown by `m` all round. @param {number[]} a @param {number[]} b @param {number} [m] */
export function bodiesTouch(a, b, m = 0) {
  return boxesTouch(a, CAR_L / 2 + m, CAR_W / 2 + m, b, CAR_L / 2 + m, CAR_W / 2 + m);
}
/** A car's body from its axles. @param {Pt} f @param {Pt} r */
export function bodyOf(f, r) {
  const u = unit(sub(f, r));
  return [(f[0] + r[0]) / 2, (f[1] + r[1]) / 2, u[0], u[1]];
}
/** Where a car's body goes along a move, every few hundredths of a tile. @param {Move} m */
function sweep(m) {
  const out = [];
  let r = m.rear0;
  for (let s = 0; s <= m.lead + 1e-9; s += SAMPLE * 1.5) { const f = pointAt(m.line, s); r = follow(r, f); out.push(bodyOf(f, r)); }
  if (m.rear) for (let s = 0; s <= m.rear.len + 1e-9; s += SAMPLE * 1.5) { const q = pointAt(m.rear, s); out.push(bodyOf(along(q, dirAt(m.rear, s), AXLES), q)); }
  return out;
}

/** The roads of the town as its cars drive them, with the spots of `extra` buildings too (ones that have come down with
 *  cars still parked there, which must drive out). @param {Town} T @param {Building[]} [extra] @returns {Roads} */
export function buildRoads(T, extra = []) {
  /** @type {Seg[]} */ const segs = [];
  /** @type {Move[]} */ const moves = [];
  /** @type {Box[]} */ const boxes = [];
  /** @type {Spot[]} */ const spots = [];
  /** @type {Map<string, Spot>} */ const spotOf = new Map();
  const f = T.flyover;
  const ringOn = (/** @type {number} */ i) => T.ring[i] === 1;
  const kindOf = (/** @type {number} */ i) => (ringOn(i) ? 'ring' : degree(T, i) >= 3 ? 'junction' : 'end');
  /** @param {Box['kind']} kind @param {number} tile */
  const newBox = (kind, tile) => { /** @type {Box} */ const b = { id: boxes.length, kind, tile, moves: [] }; boxes.push(b); return b; };
  /** @param {Line} line @param {Box | null} from @param {Box | null} to */
  const newSeg = (line, from, to, up = false) => {
    /** @type {Seg} */
    const s = { id: segs.length, line, from, to, outs: [], ins: [], noStop: line.len < CAR_L + GAP + 0.02, up, gateIn: !from, gateOut: !to, cars: [], incoming: 0 };
    segs.push(s);
    return s;
  };
  /**
   * @param {Box} box @param {Move['kind']} kind @param {Seg | Spot} from @param {Seg | Spot} to @param {Line} line
   * @param {{ lead?: number, rear?: Line | null, rear0?: Pt }} [o]
   */
  const newMove = (box, kind, from, to, line, o = {}) => {
    /** @type {Move} */
    const m = {
      id: moves.length, box, kind, from, to, line, lead: o.lead ?? line.len, rear: o.rear ?? null, rear0: o.rear0 ?? along(line.pts[0], line.u0, -AXLES),
      minor: kind === 'park' || kind === 'leave' || kind === 'ring-in', foes: [], held: 0, cost: line.len + (kind === 'uturn' ? UTURN : 0), sweep: [],
      clear: (CAR_L + AXLES) / 2 + 0.02,
    };
    moves.push(m);
    box.moves.push(m);
    from.outs.push(m);
    to.ins.push(m);
    return m;
  };

  // The spots: a drive for each home, four bays for each building, on the road tile each opens onto.
  /** @type {Map<number, Spot[]>} */
  const spotsAt = new Map();
  for (const b of [...T.buildings.values(), ...extra]) {
    const tile = doorOf(b);
    if (!T.isRoad[tile]) continue;
    const list = spotsAt.get(tile) ?? [];
    if (b.kind === 'home') {
      const u = dirOf((b.face + 2) % 4), mid = along(centre(b.front), u, DRIVE);
      list.push({ id: spots.length, b, slot: -1, box: null, R: along(mid, u, -AXLES / 2), u, ins: [], outs: [] });
      spots.push(list[list.length - 1]);
    } else {
      b.slots.forEach((q, slot) => {
        /** @type {Pt} */
        const u = [Math.cos(q.angle), Math.sin(q.angle)];
        list.push({ id: spots.length, b, slot, box: null, R: along([q.x, q.y], u, -AXLES / 2), u, ins: [], outs: [] });
        spots.push(list[list.length - 1]);
      });
    }
    spotsAt.set(tile, list);
  }
  for (const s of spots) spotOf.set(`${s.b.id}:${s.slot}`, s);

  // Into and out of a spot, from a lane's end at `p` heading `u`, or onto a lane's start.
  /** @param {Box} box @param {Seg} seg @param {Spot} spot */
  const parkMove = (box, seg, spot) => {
    const p = seg.line.pts[seg.line.pts.length - 1], u = seg.line.u1, r0 = along(p, u, -AXLES);
    let lead = makeLine([p], u), rStart = r0, uStart = u;
    if (spot.slot >= 0) {
      const lot = lotFrame(/** @type {Place} */ (spot.b)), ub = lot.uOf(along(spot.R, spot.u, AXLES / 2));
      /** @type {[Pt, Pt][]} */
      const ways = [[p, u], [lot.at(0, MOUTH), lot.inward]];
      if (Math.abs(ub) > 0.3) {
        // Along the aisle, then the back axle round into the bay, as wide as the aisle lets it.
        const sg = Math.sign(ub), au = along([0, 0], lot.axis, sg), rho = BAY - AXLES / 2 - AISLE;
        ways.push([lot.at(sg * 0.3, AISLE), au], [lot.at(ub - sg * (rho - AXLES), AISLE), au]);
      }
      lead = wayLine(ways);
      const t = trail(lead, r0);
      rStart = t.end;
      uStart = unit(sub(lead.pts[lead.pts.length - 1], rStart));
    }
    const rear = makeLine(turnPath(rStart, uStart, spot.R, spot.u));
    return newMove(box, 'park', seg, spot, joinLines(lead, makeLine(frontOf(rear))), { lead: lead.len, rear, rear0: r0 });
  };
  /** @param {Box} box @param {Spot} spot @param {Seg} seg */
  const leaveMove = (box, spot, seg) => {
    const out = seg.line.pts[0], ou = seg.line.u0;
    /** @type {[Pt, Pt][]} */
    const ways = [[spot.R, [-spot.u[0], -spot.u[1]]]];
    if (spot.slot >= 0) {
      const lot = lotFrame(/** @type {Place} */ (spot.b)), ub = lot.uOf(along(spot.R, spot.u, AXLES / 2));
      if (Math.abs(ub) > 0.3) ways.push([lot.at(Math.sign(ub) * 0.3, AISLE), along([0, 0], lot.axis, -Math.sign(ub))]);
      ways.push([lot.at(0, MOUTH), along([0, 0], lot.inward, -1)]);
    }
    ways.push([out, ou]);
    return newMove(box, 'leave', spot, seg, wayLine(ways), { rear0: along(spot.R, spot.u, AXLES) });
  };

  // Each road: its middle, cut where boxes begin and end, and a lane each way along every piece.
  const chains = roadChains(T, (i) => T.isRoad[i] === 1);
  /** Each node tile's roads, each with the way it leaves the node and its lanes either side of the box's edge.
   *  @type {Map<number, { d: number, inSeg: Seg, outSeg: Seg }[]>} */
  const ends = new Map();
  /** @type {Map<number, Box>} */
  const stopBox = new Map();
  /** @param {number} i @param {{ d: number, inSeg: Seg, outSeg: Seg }} e */
  const addEnd = (i, e) => { const list = ends.get(i) ?? []; list.push(e); ends.set(i, list); };
  /** How far into a road its node's box reaches: a junction's or a dead end's tile, or to where the ways onto a ring
   *  leave the road. @param {number} i */
  const reach = (i) => (kindOf(i) === 'ring' ? RING_IN - RING_R : 0.5);
  /** The node boxes, made as their roads are seen. @type {Map<number, Box>} */
  const nodeBox = new Map();
  /** @param {number} i */
  const boxAt = (i) => {
    let b = nodeBox.get(i);
    if (!b) { b = newBox(/** @type {Box['kind']} */ (kindOf(i)), i); nodeBox.set(i, b); }
    return b;
  };
  const dirFrom = (/** @type {Pt} */ a, /** @type {Pt} */ b) => { const u = unit(sub(b, a)); return Math.abs(u[0]) > Math.abs(u[1]) ? (u[0] > 0 ? 1 : 3) : u[1] > 0 ? 2 : 0; };

  for (const ch of chains) {
    const mid = middleOf(ch), lanes = lanesOf(mid);
    const first = ch.tiles[0], last = ch.tiles[ch.tiles.length - 1];
    const d0 = dirFrom(ch.pts[0], ch.pts[1]), d1 = dirFrom(ch.pts[ch.pts.length - 1], ch.pts[ch.pts.length - 2]);
    const c0 = Math.min(reach(first), mid.len);
    const c1 = last >= 0 ? Math.max(c0, mid.len - reach(last)) : mid.len;
    // The road's own tiles between its ends, each a box if a drive or a car park opens onto it.
    /** @type {number[]} */
    const inner = [];
    for (let k = 0; k < ch.tiles.length - 1; k++) {
      const a = ch.tiles[k], b = ch.tiles[k + 1];
      if (k > 0) inner.push(a);
      const dd = b >= 0 ? dirFrom(centre(a), centre(b)) : dirFrom(centre(a), ch.pts[k + 1]);
      for (let t = step(a, dd); t >= 0 && t !== b; t = step(t, dd)) inner.push(t);
    }
    /** @type {[number, number, number][]} */
    const stops = [];
    for (const t of inner) {
      if (!spotsAt.has(t)) continue;
      const [s0, s1] = spanIn(mid, xOf(t), yOf(t));
      if (s0 >= c0 - 1e-6 && s1 <= c1 + 1e-6 && s1 > s0) stops.push([s0, s1, t]);
    }
    stops.sort((p, q) => p[0] - q[0]);
    const cuts = [c0, ...stops.flatMap(([s0, s1]) => [s0, s1]), c1];
    /** The lanes between two of the cut points, both ways. @param {number} i0 @param {number} i1 */
    const piece = (i0, i1) => ({ f: lanes.fwd(cuts[i0], cuts[i1]), b: lanes.bwd(cuts[i0], cuts[i1]) });
    const fromBox = first >= 0 ? boxAt(first) : null, toBox = last >= 0 ? boxAt(last) : null;
    // The pieces in order: lane, stop box, lane, ..., lane; each lane piece a seg each way.
    /** @type {(Box | null)[]} */
    const inOrder = [fromBox, ...stops.map(([, , t]) => { let b = stopBox.get(t); if (!b) { b = newBox('stop', t); stopBox.set(t, b); } return b; }), toBox];
    /** @type {Seg[][]} */
    const laneSegs = [];
    for (let k = 0; k < inOrder.length - 1; k++) {
      const p = piece(2 * k, 2 * k + 1);
      laneSegs.push([newSeg(p.f, inOrder[k], inOrder[k + 1]), newSeg(p.b, inOrder[k + 1], inOrder[k])]);
    }
    // Across each stop box, the lanes straight on.
    stops.forEach((_, k) => {
      const box = /** @type {Box} */ (inOrder[k + 1]), p = piece(2 * k + 1, 2 * k + 2);
      newMove(box, 'through', laneSegs[k][0], laneSegs[k + 1][0], p.f);
      newMove(box, 'through', laneSegs[k + 1][1], laneSegs[k][1], p.b);
    });
    if (first >= 0) addEnd(first, { d: d0, inSeg: laneSegs[0][1], outSeg: laneSegs[0][0] });
    if (last >= 0) addEnd(last, { d: d1, inSeg: laneSegs[laneSegs.length - 1][0], outSeg: laneSegs[laneSegs.length - 1][1] });
  }

  // The flyover: one more road at the junction at each end, a lane each way from box to box, up on its deck all the
  // way (its ramps come down over open ground, where no road runs beneath).
  if (f && T.isRoad[f.a] && T.isRoad[f.b]) {
    const mid = makeLine(f.pts), lanes = lanesOf(mid), L = mid.len;
    const ba = boxAt(f.a), bb = boxAt(f.b);
    const up = newSeg(lanes.fwd(0.5, L - 0.5), ba, bb, true), down = newSeg(lanes.bwd(0.5, L - 0.5), bb, ba, true);
    addEnd(f.a, { d: f.da, inSeg: down, outSeg: up });
    addEnd(f.b, { d: f.db, inSeg: up, outSeg: down });
  }

  // Each node box's moves.
  for (const [tile, box] of nodeBox) {
    const list = ends.get(tile) ?? [];
    const here = spotsAt.get(tile) ?? [];
    if (box.kind === 'ring') {
      ringMoves(box, tile, list);
      continue;
    }
    // A junction: every road to every other; a dead end: round to go back. And into and out of the spots.
    for (const a of list) {
      for (const b of list) {
        if (a === b && box.kind !== 'end') continue;
        const pa = a.inSeg.line, pb = b.outSeg.line;
        const line = makeLine(turnPath(pa.pts[pa.pts.length - 1], pa.u1, pb.pts[0], pb.u0));
        newMove(box, a === b ? 'uturn' : dot(pa.u1, pb.u0) > 0.99 ? 'through' : 'turn', a.inSeg, b.outSeg, line);
      }
    }
    for (const s of here) {
      s.box = box;
      for (const a of list) parkMove(box, a.inSeg, s);
      for (const b of list) leaveMove(box, s, b.outSeg);
    }
  }
  // The stop boxes' spots, from and to the lanes either side.
  for (const [tile, box] of stopBox) {
    const ins = box.moves.map((m) => /** @type {Seg} */ (m.from)), outs = box.moves.map((m) => /** @type {Seg} */ (m.to));
    for (const s of spotsAt.get(tile) ?? []) {
      s.box = box;
      for (const seg of ins) parkMove(box, seg, s);
      for (const seg of outs) leaveMove(box, s, seg);
    }
  }

  /** A roundabout: a box where each of its roads meets the ring, holding the way onto the ring, the way off it and the
   *  ring itself past the road; between them, the ring's lane, which nobody stops on.
   *  @param {Box} first @param {number} tile @param {{ d: number, inSeg: Seg, outSeg: Seg }[]} roads */
  function ringMoves(first, tile, roads) {
    const c = centre(tile);
    const arms = roads.map((e) => ({ ...e, a: Math.atan2(DY[e.d], DX[e.d]) })).sort((p, q) => p.a - q.a);
    if (!arms.length) return;
    const ringPoint = (/** @type {number} */ a) => /** @type {Pt} */ ([c[0] + RING_LANE * Math.cos(a), c[1] + RING_LANE * Math.sin(a)]);
    const tangent = (/** @type {number} */ a) => /** @type {Pt} */ ([-Math.sin(a), Math.cos(a)]);
    /** @param {number} a0 @param {number} a1 */
    const arc = (a0, a1) => {
      const m = Math.max(2, Math.ceil((RING_LANE * (a1 - a0)) / SAMPLE));
      return makeLine(Array.from({ length: m + 1 }, (_, k) => ringPoint(a0 + ((a1 - a0) * k) / m)));
    };
    const armBoxes = arms.map((_, k) => (k ? newBox('ring', tile) : first));
    const ringSegs = arms.map((arm, k) => {
      const next = arms[(k + 1) % arms.length], a1 = next.a - RING_PHI + (k + 1 === arms.length ? 2 * Math.PI : 0);
      const seg = newSeg(arc(arm.a + RING_PHI, a1), armBoxes[k], armBoxes[(k + 1) % arms.length]);
      seg.noStop = true;
      return seg;
    });
    arms.forEach((arm, k) => {
      const box = armBoxes[k], before = ringSegs[(k + arms.length - 1) % arms.length], after = ringSegs[k];
      const pin = arm.inSeg.line, pout = arm.outSeg.line;
      newMove(box, 'ring', before, after, arc(arm.a - RING_PHI, arm.a + RING_PHI));
      newMove(box, 'ring-in', arm.inSeg, after, makeLine(turnPath(pin.pts[pin.pts.length - 1], pin.u1, ringPoint(arm.a + RING_PHI), tangent(arm.a + RING_PHI))));
      newMove(box, 'ring-out', before, arm.outSeg, makeLine(turnPath(ringPoint(arm.a - RING_PHI), tangent(arm.a - RING_PHI), pout.pts[0], pout.u0)));
    });
  }

  // Foes: moves of a box, from different lanes or spots, whose cars' bodies would touch; with more room to spare
  // round a car turning in or out of a drive or a car park, whose swing depends a little on how straight it came in.
  for (const box of boxes) {
    const sw = box.moves.map((m) => (m.sweep = sweep(m)));
    for (let i = 0; i < box.moves.length; i++) {
      for (let j = i + 1; j < box.moves.length; j++) {
        const a = box.moves[i], b = box.moves[j];
        if (a.from === b.from) continue;
        const m = a.kind === 'park' || a.kind === 'leave' || b.kind === 'park' || b.kind === 'leave' ? 0.04 : 0.01;
        if (sw[i].some((p) => sw[j].some((q) => bodiesTouch(p, q, m)))) { a.foes.push(b); b.foes.push(a); }
      }
    }
  }

  // How far past each move a car must go before it's out of its foes' way: along the lane after it, its back axle
  // pulled after its front.
  const margin = (/** @type {Move} */ a, /** @type {Move} */ b) => (a.kind === 'park' || a.kind === 'leave' || b.kind === 'park' || b.kind === 'leave' ? 0.04 : 0.01);
  for (const m of moves) {
    if (!m.foes.length || !('cars' in m.to)) continue;
    const seg = m.to, last = m.sweep[m.sweep.length - 1];
    let r = /** @type {Pt} */ ([last[0] - (last[2] * AXLES) / 2, last[1] - (last[3] * AXLES) / 2]);
    for (let d = SAMPLE; ; d += SAMPLE) {
      const f = pointAt(seg.line, Math.min(d, seg.line.len));
      r = follow(r, f);
      const body = bodyOf(f, r);
      if (!m.foes.some((o) => o.sweep.some((p) => bodiesTouch(body, p, margin(m, o)))) || d >= seg.line.len) { m.clear = Math.max(m.clear, Math.min(d, seg.line.len)); break; }
    }
  }
  return { segs, moves, boxes, spots, spotOf, gatesIn: segs.filter((s) => s.gateIn), gatesOut: segs.filter((s) => s.gateOut) };
}

/** How far it is from the end of every lane to `dest` (a spot, or 'out': any road out of town), the best way, in tiles;
 *  Infinity where it can't be reached. @param {Roads} roads @param {Spot | 'out'} dest */
export function costsTo(roads, dest) {
  const cost = new Float64Array(roads.segs.length).fill(Infinity);
  const heap = new Heap();
  if (dest === 'out') for (const g of roads.gatesOut) { cost[g.id] = 0; heap.push(0, g.id); }
  else for (const m of dest.ins) { const s = /** @type {Seg} */ (m.from); if (m.cost < cost[s.id]) { cost[s.id] = m.cost; heap.push(m.cost, s.id); } }
  while (heap.size) {
    const id = heap.pop(), c = heap.top;
    if (c > cost[id]) continue;
    const seg = roads.segs[id];
    for (const m of seg.ins) {
      if (!('line' in m.from) || !('cars' in m.from)) continue;
      const prev = /** @type {Seg} */ (m.from), nc = c + seg.line.len + m.cost;
      if (nc < cost[prev.id]) { cost[prev.id] = nc; heap.push(nc, prev.id); }
    }
  }
  return cost;
}
/** The best move on from the end of lane `seg` towards `dest`, given `costsTo` for it; null if there's none.
 *  @param {Seg} seg @param {Spot | 'out'} dest @param {Float64Array} cost */
export function nextMove(seg, dest, cost) {
  let best = null, top = Infinity;
  for (const m of seg.outs) {
    const c = m.to === dest ? m.cost : 'cars' in m.to ? m.cost + m.to.line.len + cost[m.to.id] : Infinity;
    if (c < top) { top = c; best = m; }
  }
  return best;
}
/** The moves from lane `seg`'s end (or from spot `from`) to `dest`, the best way; null if it can't be reached.
 *  @param {Seg | Spot} from @param {Spot | 'out'} dest @param {Float64Array} cost */
export function routeFrom(from, dest, cost) {
  /** @type {Move[]} */
  const out = [];
  let seg = null;
  if ('cars' in from) seg = from;
  else {
    let top = Infinity;
    for (const m of from.outs) {
      const to = /** @type {Seg} */ (m.to), c = m.cost + to.line.len + cost[to.id];
      if (c < top) { top = c; seg = to; out[0] = m; }
    }
    if (!seg) return null;
  }
  for (let guard = 0; guard < 4000; guard++) {
    if (dest === 'out' && seg.gateOut) return out;
    const m = nextMove(seg, dest, cost);
    if (!m) return null;
    out.push(m);
    if (m.to === dest) return out;
    seg = /** @type {Seg} */ (m.to);
  }
  return null;
}
