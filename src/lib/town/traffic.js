// Jack's Town's traffic. A car lives at each home, parked nose in on its drive. Now and then it drives to a building
// of its colour (more in the rush hours) and noses into a free bay, and later drives home again; sometimes it drives
// out of town and comes back a while later. Visitors come in along the roads out of town, park a while at any building
// with a bay free, and leave. A car has no front or back: it always drives forwards, whichever end leads, so it never
// reverses. A building takes no more cars than it has bays: a car sets off for one only with a bay free, and keeps it.
//
// How a car drives: its leading wheels follow the lane and its back wheels are pulled after them, as a real car's are,
// so the front turns first and the body swings round after it, never sliding sideways; into a bay or onto a drive its
// back wheels follow a curve that ends square in it, so it parks straight. It speeds up and slows down gently, slows
// for bends and keeps its distance.
//
// The rules that keep the town moving (roads.js lays the lanes and the boxes where they meet): a car crosses a box only
// on a move none of whose foes is in use, and only with room to stand beyond it, so it never stops inside a box; the
// first car in a lane asks for its way across as it comes up to the box, and cars are let across in the order they
// asked, a car turning in or out of a drive or a car park, or onto a roundabout, giving way to cars coming. A car that
// has waited long for room beyond goes another way. Runs in fixed steps from a seed; the page draws between steps.
// Tested by tests/town-traffic.test.js.
import { doorOf, H, homesOf, N, placesOf, seeded, W } from './map.js';
import { AXLES, boxesTouch, bodyOf, buildRoads, CAR_L, CAR_W, costsTo, dirAt, follow, GAP, makeLine, pointAt, routeFrom, turnPath } from './roads.js';

/** @typedef {import('./map.js').Town} Town @typedef {import('./map.js').Building} Building @typedef {import('./map.js').Home} Home */
/** @typedef {import('./roads.js').Roads} Roads @typedef {import('./roads.js').Seg} Seg @typedef {import('./roads.js').Move} Move
 *  @typedef {import('./roads.js').Spot} Spot @typedef {import('./roads.js').Line} Line @typedef {import('./roads.js').Pt} Pt
 *  @typedef {import('./roads.js').Box} Box */
/**
 * @typedef {{ kind: 'seg', seg: Seg, line: Line, from?: number } | { kind: 'move', move: Move, line: Line } | { kind: 'rear', move: Move, line: Line } | { kind: 'blend', line: Line }} Leg
 * A stretch of a car's way: along a lane (from distance `from` on it, if it joins part way), across a box, the last of
 * a move into a drive or a bay with its back wheels leading the way (`rear`), or onto the lanes again after the roads
 * changed under it (`blend`).
 * @typedef {{
 *   id: number, colour: number, home: Home | null, visitor: boolean, leaving: boolean,
 *   state: 'parked' | 'driving' | 'away', spot: Spot | null, timer: number,
 *   legs: Leg[], k: number, s: number, F: Pt, R: Pt, was: [Pt, Pt], v: number, braking: boolean, up: boolean,
 *   dest: Spot | 'out' | null, bay: Spot | null, holds: { move: Move, at: number }[], slots: Seg[], asked: number,
 *   waited: number, setOff: number,
 * }} Car
 * `F` and `R` are its leading and its back axle (on a drive or in a bay, `F` the one nearer the building); `was` where
 * they were a step ago. Driving, it's `s` along leg `k` of its way: its leading axle's distance, or its back axle's on
 * a `rear` leg. `dest` is the spot it's driving to, or 'out' of town. `bay` is the bay it's driving out of, still its
 * own until it's out. `holds` are the moves it has been let onto (with the leg each is), `slots` the lanes it has room
 * kept on, `asked` when it asked for its next way across, -1 when it hasn't.
 */

/** Town minutes a step moves on. */
export const STEP = 0.05;
/** Speeds in tiles a town minute (the page's 1x runs a town minute and a half a second): on the road; into and out of a
 *  drive or a car park. */
const TOP = 1.5, SLOW = 0.5;
/** How fast a car speeds up, brakes as it means to, and brakes when it must, in tiles a town minute each town minute. */
const ACCEL = 1.1, BRAKE = 1.4, HARD = 5;
/** How fast a car takes a bend: its speed squared over the bend's radius. */
const BEND = 1.2;
/** How far a car's body reaches past its axles. */
const OVER = (CAR_L - AXLES) / 2;
/** A car asks for its way across a box this much before it would have to start braking for it. */
const ASK = 0.35;
/** A car that has stood this many town minutes with no room beyond the box ahead goes another way. */
const DETOUR = 6;
/** At most this many visitors in town at once. */
const VISITORS = 10;
/** The back wheels are pulled along at least this often, in tiles. */
const PULL = 0.04;

const bump = (/** @type {number} */ h, /** @type {number} */ mu, /** @type {number} */ sd) => Math.exp(-0.5 * ((h - mu) / sd) ** 2);
/** How likely a car at home is to set off, a town minute, at hour `h`: most in the morning rush, and never so seldom
 *  that the roads go quiet, night or day. */
const leaveHome = (/** @type {number} */ h) => (1.5 + 7 * bump(h, 7.9, 0.7) + 1.5 * bump(h, 13, 2.2)) / 300;
/** How likely a car at a building is to head home: most in the evening rush, and late at night. */
const leavePlace = (/** @type {number} */ h) => ((1 + 4 * bump(h, 17.8, 0.8)) * (h >= 21 || h < 6 ? 3 : 1)) / 70;
/** How likely a visitor is to come in by each road out of town. */
const visit = (/** @type {number} */ h) => (1 + 2 * bump(h, 12.5, 2.5)) / 35;

const along = (/** @type {Pt} */ a, /** @type {Pt} */ u, /** @type {number} */ k) => /** @type {Pt} */ ([a[0] + u[0] * k, a[1] + u[1] * k]);
/** @param {Pt} f @param {Pt} r @returns {Pt} */
const headingOf = (f, r) => { const dx = f[0] - r[0], dy = f[1] - r[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
/** Whether body `a`, stretched ahead by `gap`, touches body `b`. @param {number[]} a @param {number[]} b @param {number} gap */
const touchAhead = (a, b, gap) => boxesTouch([a[0] + (a[2] * gap) / 2, a[1] + (a[3] * gap) / 2, a[2], a[3]], CAR_L / 2 + gap / 2, CAR_W / 2, b, CAR_L / 2, CAR_W / 2);
const touches = (/** @type {number[]} */ a, /** @type {number[]} */ b) => boxesTouch(a, CAR_L / 2, CAR_W / 2, b, CAR_L / 2, CAR_W / 2);

/** The fastest a car may go at each point of a line, for its bends. @type {WeakMap<Line, Float32Array>} */
const limits = new WeakMap();
/** @param {Line} line */
function limOf(line) {
  let lim = limits.get(line);
  if (lim) return lim;
  const { pts, lens } = line, n = pts.length;
  lim = new Float32Array(n).fill(TOP);
  for (let k = 1; k < n - 1; k++) {
    const ux = pts[k][0] - pts[k - 1][0], uy = pts[k][1] - pts[k - 1][1], vx = pts[k + 1][0] - pts[k][0], vy = pts[k + 1][1] - pts[k][1];
    const turn = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)), l = (lens[k + 1] - lens[k - 1]) / 2;
    if (turn > 1e-4) lim[k] = Math.min(TOP, Math.sqrt((BEND * l) / turn));
  }
  limits.set(line, lim);
  return lim;
}

/**
 * The traffic of town `T`, starting at town clock `clock` (minutes from Sunday midnight). `trips` scales how often cars
 * set off, for checks.
 * @param {Town} T @param {number} seed @param {{ clock?: number, trips?: number }} [opts]
 */
export function startTraffic(T, seed, opts = {}) {
  const random = seeded((seed ^ 0x2545f491) >>> 0);
  const trips = opts.trips ?? 1;
  let clock = opts.clock ?? 7 * 60;
  let roads = buildRoads(T);
  /** @type {Car[]} */
  const cars = [];
  /** The bays taken, each by the car driving to it, parked in it or driving out of it. @type {Map<string, Car>} */
  const taken = new Map();
  /** @type {Map<Spot | 'out', Float64Array>} */
  let costs = new Map();
  /** The cars on each box's moves. @type {Map<Box, Set<Car>>} */
  let inBox = new Map();
  let nextId = 0;
  const stats = { trips: 0, arrived: 0, guarded: 0, detours: 0, dropped: 0 };

  const keyOf = (/** @type {Spot} */ s) => `${s.b.id}:${s.slot}`;
  const isSeg = (/** @type {Seg | Spot} */ x) => 'cars' in x;
  const costTo = (/** @type {Spot | 'out'} */ dest) => { let c = costs.get(dest); if (!c) { c = costsTo(roads, dest); costs.set(dest, c); } return c; };
  const boxSet = (/** @type {Box} */ box) => { let s = inBox.get(box); if (!s) { s = new Set(); inBox.set(box, s); } return s; };
  const homeSpot = (/** @type {Home | null} */ h) => (h && T.buildings.has(h.id) ? roads.spotOf.get(`${h.id}:-1`) ?? null : null);

  /** @param {number} colour @param {Home | null} home @returns {Car} */
  function newCar(colour, home, visitor = false) {
    return {
      id: nextId++, colour, home, visitor, leaving: false, state: 'away', spot: null, timer: 0, legs: [], k: 0, s: 0, F: [0, 0], R: [0, 0],
      was: [[0, 0], [0, 0]], v: 0, braking: false, up: false, dest: null, bay: null, holds: [], slots: [], asked: -1, waited: 0, setOff: 0,
    };
  }
  /** @param {Car} car @param {Spot} spot */
  function parkAt(car, spot) {
    Object.assign(car, { state: 'parked', spot, legs: [], k: 0, s: 0, v: 0, dest: null, braking: false, up: false, waited: 0, asked: -1 });
    car.R = spot.R;
    car.F = along(spot.R, spot.u, AXLES);
    car.was = [car.F, car.R];
    if (car.visitor) car.timer = clock + 20 + random() * 70;
    if (spot.slot >= 0) taken.set(keyOf(spot), car);
  }
  for (const h of homesOf(T)) { const s = homeSpot(h); if (s) { const car = newCar(h.colour, h); parkAt(car, s); cars.push(car); } }

  /** A free bay at a building of `colour` (any colour if none), picked at random; not one off the box `not` (where the
   *  car already is: it can't drive from a spot to another off the same box); null if every one is full.
   *  @param {number} [colour] @param {Box | null} [not] */
  function freeBay(colour, not = null) {
    const open = [];
    for (const p of placesOf(T, colour)) {
      const bays = [0, 1, 2, 3].map((k) => roads.spotOf.get(`${p.id}:${k}`)).filter((s) => s && s.box && s.box !== not && !taken.has(keyOf(s)));
      if (bays.length) open.push(bays[0]);
    }
    return open.length ? /** @type {Spot} */ (open[Math.floor(random() * open.length)]) : null;
  }
  /** The legs of a way: along lane `seg` if given, then each move and the lane after it. @param {Move[]} moves @param {Seg | null} seg */
  function legsOf(moves, seg) {
    /** @type {Leg[]} */
    const legs = seg ? [{ kind: 'seg', seg, line: seg.line }] : [];
    for (const m of moves) { legs.push({ kind: 'move', move: m, line: m.line }); if (isSeg(m.to)) legs.push({ kind: 'seg', seg: /** @type {Seg} */ (m.to), line: /** @type {Seg} */ (m.to).line }); }
    return legs;
  }
  /** A parked car sets off for `dest` (a bay it has taken, its home's drive, or 'out'); false, nothing changed, if it
   *  has no way there. @param {Car} car @param {Spot | 'out'} dest */
  function leaveSpot(car, dest) {
    const spot = /** @type {Spot} */ (car.spot);
    const route = routeFrom(spot, dest, costTo(dest));
    if (!route) return false;
    Object.assign(car, { state: 'driving', legs: legsOf(route, null), k: 0, s: 0, v: 0, dest, asked: clock, waited: 0, setOff: clock, spot: null, bay: spot.slot >= 0 ? spot : null });
    // It drives off with the other end leading.
    car.F = spot.R;
    car.R = along(spot.R, spot.u, AXLES);
    car.was = [car.F, car.R];
    stats.trips++;
    return true;
  }
  /** A car comes into town along the road out of town `gate`, heading for `dest`, if there's room there. @param {Car} car
   *  @param {Seg} gate @param {Spot | 'out'} dest */
  function enterAt(car, gate, dest) {
    const last = gate.cars[gate.cars.length - 1];
    if (gate.incoming || (last && last.s - AXLES - OVER < CAR_L + GAP + 0.8)) return false;
    const route = routeFrom(gate, dest, costTo(dest));
    if (!route) return false;
    Object.assign(car, { state: 'driving', legs: legsOf(route, gate), k: 0, s: 0, v: TOP * 0.8, dest, asked: -1, waited: 0, setOff: clock, spot: null, up: false });
    car.F = gate.line.pts[0];
    car.R = along(car.F, gate.line.u0, -AXLES);
    car.was = [car.F, car.R];
    gate.cars.push(car);
    stats.trips++;
    return true;
  }
  /** Where a car goes when the building it was driving to has gone: another of the colour with a bay free (taking it),
   *  home, or out of town. @param {Car} car @param {number} colour @returns {Spot | 'out'} */
  function elsewhere(car, colour) {
    const bay = car.visitor ? freeBay(colour) : null;
    if (bay) { taken.set(keyOf(bay), car); return bay; }
    return homeSpot(car.home) ?? 'out';
  }

  /** Everything letting go of a car: its moves, its room ahead, its place in a lane, its bays. @param {Car} car */
  function letGo(car) {
    for (const h of car.holds) h.move.held--;
    car.holds = [];
    for (const set of inBox.values()) set.delete(car);
    for (const seg of car.slots) seg.incoming--;
    car.slots = [];
    const leg = car.legs[car.k];
    if (car.state === 'driving' && leg?.kind === 'seg') { const i = leg.seg.cars.indexOf(car); if (i >= 0) leg.seg.cars.splice(i, 1); }
    car.asked = -1;
  }
  /** @param {Car} car */
  function remove(car) {
    letGo(car);
    for (const [key, c] of taken) if (c === car) taken.delete(key);
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
    car.state = 'away';
  }

  // ---- Asking for a way across.

  /** The leg of the next move a car hasn't been let onto, or -1. @param {Car} car */
  function nextUnheld(car) {
    for (let j = car.k; j < car.legs.length; j++) if (car.legs[j].kind === 'move' && !car.holds.some((h) => h.at === j)) return j;
    return -1;
  }
  /** What a car asks for now, if anything: the next move, with the moves after it up to a lane it can stand on (and
   *  room kept there), as it comes up to the box; only the first car in a lane asks. @param {Car} car */
  function wanted(car) {
    const j = nextUnheld(car);
    if (j < 0) return null;
    const leg = car.legs[car.k], next = car.legs[car.k + 1];
    if (leg.kind === 'seg') {
      if (j !== car.k + 1 || leg.seg.cars[0] !== car) return null;
      if (leg.line.len - car.s - OVER > (car.v * car.v) / (2 * BRAKE) + ASK) return null;
    } else if (leg.kind === 'move' && j === car.k && car.k === 0 && car.s === 0) {
      // In its spot, about to drive out.
    } else if (j === car.k + 2 && next.kind === 'seg' && !next.seg.cars.length && !(leg.kind === 'move' && behindIn(car, leg.move))) {
      // Still crossing a box (one it was in when the roads changed), with the lane after it empty and nobody ahead of
      // it in the box: it asks from here.
      if (leg.line.len - car.s + next.line.len - OVER > (car.v * car.v) / (2 * BRAKE) + ASK) return null;
    } else return null;
    /** @type {Move[]} */
    const chain = [];
    let at = j;
    for (;;) {
      const m = /** @type {{ move: Move }} */ (car.legs[at]).move;
      chain.push(m);
      // On past a lane it can't stand on out of the way of the move's foes.
      const to = /** @type {Seg} */ (m.to);
      if (!isSeg(to) || !(to.noStop || to.line.len < m.clear + GAP + OVER) || car.legs[at + 2]?.kind !== 'move') break;
      at += 2;
    }
    const last = chain[chain.length - 1].to;
    return { chain, at: j, slot: isSeg(last) && !(/** @type {Seg} */ (last).noStop) ? /** @type {Seg} */ (last) : null };
  }
  /** Whether another car is ahead of `car` on its way across the box of move `m`. @param {Car} car @param {Move} m */
  function behindIn(car, m) {
    for (const o of inBox.get(m.box) ?? []) {
      if (o === car) continue;
      const ol = o.legs[o.k];
      if (ol?.kind === 'move' && (ol.move === m || ol.move.from === m.from) && o.s > car.s) return true;
    }
    return false;
  }
  /** How far a lane's start is clear: to the back of its last car. @param {Seg} seg */
  function freeAt(seg) {
    const last = seg.cars[seg.cars.length - 1];
    return last ? last.s - AXLES - OVER : seg.line.len;
  }
  /** Whether a car coming along the road is about to take a move that `m` (a minor move) crosses: then `m` waits.
   *  @param {Car} car @param {Move} m */
  function coming(car, m) {
    for (const f of m.foes) {
      if (f.minor || !isSeg(f.from)) continue;
      const seg = /** @type {Seg} */ (f.from), o = seg.cars[0];
      if (!o || o === car || o.v < 0.1) continue;
      const next = o.legs[o.k + 1];
      if (next?.kind === 'move' && next.move === f && seg.line.len - o.s < Math.max(0.8, o.v * 1.8)) return true;
    }
    return false;
  }
  /** @param {Car} car @param {{ chain: Move[], at: number, slot: Seg | null }} w */
  function canGo(car, w) {
    for (const m of w.chain) {
      // Not counting the car's own moves: they're behind it.
      if (m.foes.some((f) => f.held > car.holds.filter((h) => h.move === f).length)) return false;
      if (m.minor && coming(car, m)) return false;
    }
    // Room to stop past the box, out of the way of its foes.
    return !w.slot || freeAt(w.slot) >= w.chain[w.chain.length - 1].clear + GAP + OVER + w.slot.incoming * (CAR_L + GAP);
  }
  /** @param {Car} car @param {{ chain: Move[], at: number, slot: Seg | null }} w */
  function letOn(car, w) {
    w.chain.forEach((m, i) => { m.held++; car.holds.push({ move: m, at: w.at + 2 * i }); });
    if (w.slot) { w.slot.incoming++; car.slots.push(w.slot); }
    car.asked = -1;
  }
  /** Every car that asks is let across in the order they asked, if its way is free. */
  function letAcross() {
    /** @type {[Car, { chain: Move[], at: number, slot: Seg | null }][]} */
    const asks = [];
    for (const car of cars) {
      if (car.state !== 'driving') continue;
      const w = wanted(car);
      if (!w) continue;
      if (car.asked < 0) car.asked = clock;
      asks.push([car, w]);
    }
    asks.sort((p, q) => p[0].asked - q[0].asked || p[0].id - q[0].id);
    for (const [car, w] of asks) if (canGo(car, w)) letOn(car, w);
  }

  // ---- Driving.

  /** The point a car's leading axle will be at `d` further along its way. @param {Car} car @param {number} d */
  function frontAhead(car, d) {
    let k = car.k, s = car.s + d;
    while (k < car.legs.length - 1 && s > car.legs[k].line.len) { s -= car.legs[k].line.len; k++; }
    return pointAt(car.legs[k].line, s);
  }
  /** Where a car's axles will be `d` further on, its back axle pulled from `r`. @param {Car} car @param {number} d @param {Pt} r
   *  @returns {[Pt, Pt]} */
  function predict(car, d, r) {
    const leg = car.legs[car.k];
    if (leg.kind === 'rear') { const s = Math.min(leg.line.len, car.s + d), q = pointAt(leg.line, s); return [along(q, dirAt(leg.line, s), AXLES), q]; }
    const f = frontAhead(car, d);
    return [f, follow(r, f)];
  }
  /** How far it is along a car's way to its end, if it ends parked; Infinity if it drives off the map. @param {Car} car */
  function toEnd(car) {
    const last = car.legs[car.legs.length - 1];
    if (last.kind === 'seg' && last.seg.gateOut) return Infinity;
    let d = -car.s;
    for (let i = car.k; i < car.legs.length; i++) d += car.legs[i].line.len;
    return d;
  }
  /** How far a car's leading axle may go before the box of the next move it hasn't been let onto. @param {Car} car */
  function toStop(car) {
    const j = nextUnheld(car);
    if (j < 0) return Infinity;
    let d = -car.s;
    for (let i = car.k; i < j; i++) d += car.legs[i].line.len;
    return Math.max(0, d - OVER - 0.01);
  }
  /** The fastest a car may go now, for the bends ahead and the stretches into and out of drives and car parks.
   *  @param {Car} car @param {number} look */
  function bendSpeed(car, look) {
    let want = TOP, d = -car.s;
    for (let i = car.k; i < car.legs.length && d < look; i++) {
      const leg = car.legs[i];
      if (leg.kind === 'rear' || (leg.kind === 'move' && (leg.move.kind === 'park' || leg.move.kind === 'leave'))) want = Math.min(want, Math.sqrt(SLOW * SLOW + 2 * BRAKE * Math.max(0, d)));
      else {
        const lim = limOf(leg.line), lens = leg.line.lens;
        for (let k = 0; k < lim.length; k++) {
          const x = d + lens[k];
          if (x < -0.15) continue;
          if (x > look) break;
          if (lim[k] < TOP) want = Math.min(want, Math.sqrt(lim[k] * lim[k] + 2 * BRAKE * Math.max(0, x)));
        }
      }
      d += leg.line.len;
    }
    return want;
  }
  /** How far a car can go before its body, with its room ahead, would touch a car on its way: one ahead in its lane, in
   *  a box it's crossing or in the lanes after. @param {Car} car @param {number} look */
  function roomAhead(car, look) {
    /** @type {Set<Car>} */
    const others = new Set();
    let d = -car.s;
    for (let i = car.k; i < car.legs.length && d < look + CAR_L; i++) {
      const leg = car.legs[i];
      if (leg.kind === 'seg') { for (const o of leg.seg.cars) if (o !== car && (i !== car.k || o.s > car.s)) others.add(o); }
      else if (leg.kind !== 'blend') {
        // In a box, only cars on its own way through it or crossing it: one passing on a way clear of its own isn't
        // in its way, even close by.
        const mine = leg.move;
        for (const o of inBox.get(mine.box) ?? []) {
          if (o === car) continue;
          const ol = o.legs[o.k], om = ol?.kind === 'move' || ol?.kind === 'rear' ? ol.move : o.holds.find((h) => h.move.box === mine.box)?.move;
          if (!om || om === mine || om.from === mine.from || om.to === mine.to || mine.foes.includes(om)) others.add(o);
        }
      }
      d += leg.line.len;
    }
    if (!others.size) return Infinity;
    const me = bodyOf(car.F, car.R);
    // One already touching it (they met when the roads changed) doesn't stop it moving on and apart.
    const bodies = [...others].map((o) => bodyOf(o.F, o.R)).filter((b) => !touches(me, b));
    if (!bodies.length) return Infinity;
    let r = car.R;
    for (let x = 0; x <= look; x += 0.06) {
      const [f, rr] = predict(car, x, r);
      r = rr;
      const b = bodyOf(f, r);
      if (bodies.some((o) => touchAhead(b, o, GAP))) return Math.max(0, x - 0.06);
    }
    return Infinity;
  }
  /** The most of `ds` a car can move without its body coming to touch any car near it, whatever the rules missed.
   *  @param {Car} car @param {number} ds */
  function guard(car, ds) {
    if (ds <= 1e-6) return 0;
    const me = bodyOf(car.F, car.R);
    const near = cars.filter((o) => o !== car && o.state !== 'away' && o.up === car.up && Math.abs(o.F[0] - car.F[0]) + Math.abs(o.F[1] - car.F[1]) < 1.6);
    const bodies = near.map((o) => bodyOf(o.F, o.R)).filter((b) => !touches(me, b));
    if (!bodies.length) return ds;
    for (let n = 0, t = ds; n < 4; n++, t /= 2) {
      const [f, r] = predict(car, t, car.R);
      if (!bodies.some((o) => touches(bodyOf(f, r), o))) return t;
      if (!n) stats.guarded++;
    }
    return 0;
  }
  /** Moves a car's leading axle from `s0` to `s1` along `line`, pulling its back axle after it. @param {Car} car
   *  @param {Line} line @param {number} s0 @param {number} s1 */
  function pull(car, line, s0, s1) {
    let r = car.R;
    for (let s = s0 + PULL; s < s1; s += PULL) r = follow(r, pointAt(line, s));
    car.F = pointAt(line, s1);
    car.R = follow(r, car.F);
  }
  /** Onto a car's next leg. @param {Car} car */
  function nextLeg(car) {
    const leg = car.legs[car.k];
    if (leg.kind === 'seg') { const i = leg.seg.cars.indexOf(car); if (i >= 0) leg.seg.cars.splice(i, 1); }
    car.k++;
    const next = car.legs[car.k];
    car.s = next.kind === 'seg' ? next.from ?? 0 : 0;
    // Off the flyover's deck it's still up there till its back is on the ramp.
    car.up = next.kind === 'seg' ? next.seg.up : leg.kind === 'seg' && leg.seg.up;
    if (next.kind === 'seg') {
      const list = next.seg.cars;
      let i = list.length;
      while (i > 0 && list[i - 1].s < car.s) i--;
      list.splice(i, 0, car);
      const kept = car.slots.indexOf(next.seg);
      if (kept >= 0) { next.seg.incoming--; car.slots.splice(kept, 1); }
    } else if (next.kind === 'move') boxSet(next.move.box).add(car);
  }
  /** At the end of a move's lead into a drive or a bay, the car's back wheels take over: from where they are, easing
   *  onto the move's curve, which ends square in the spot. Easing onto it, not a curve of their own: a car that comes
   *  in not yet straight (just round a bend) still keeps to the move's way, clear of its neighbours'. @param {Car} car */
  function toRear(car) {
    const leg = /** @type {{ move: Move }} */ (car.legs[car.k]), plan = /** @type {Line} */ (leg.move.rear);
    const on = Math.min(0.3, plan.len / 2);
    const join = turnPath(car.R, headingOf(car.F, car.R), pointAt(plan, on), dirAt(plan, on));
    const line = makeLine([...join, ...plan.pts.filter((_, k) => plan.lens[k] > on + 1e-6)]);
    car.legs[car.k] = { kind: 'rear', move: leg.move, line };
    car.s = 0;
  }
  /** @param {Car} car @param {number} ds */
  function advance(car, ds) {
    // Reaching the end of a leg, a car goes on to the next even with no way left to go this step, so one that has
    // stopped right at its spot is parked.
    while (car.state === 'driving') {
      const leg = car.legs[car.k];
      if (leg.kind === 'rear') {
        const st = Math.max(0, Math.min(ds, leg.line.len - car.s));
        car.s += st;
        ds -= st;
        const q = pointAt(leg.line, car.s);
        car.R = q;
        car.F = along(q, dirAt(leg.line, car.s), AXLES);
        if (car.s >= leg.line.len - 1e-6) arrive(car);
        else if (ds <= 1e-9) return;
        continue;
      }
      const end = leg.kind === 'move' && leg.move.kind === 'park' ? leg.move.lead : leg.line.len;
      const st = Math.max(0, Math.min(ds, end - car.s));
      if (st > 0) pull(car, leg.line, car.s, car.s + st);
      car.s += st;
      ds -= st;
      if (car.s >= end - 1e-6) {
        if (leg.kind === 'move' && leg.move.kind === 'park') toRear(car);
        else if (car.k === car.legs.length - 1) arrive(car);
        else nextLeg(car);
      } else if (ds <= 1e-9) return;
    }
  }
  /** At the end of its way: parked in its spot, or out of town. @param {Car} car */
  function arrive(car) {
    const leg = car.legs[car.k];
    stats.arrived++;
    if (leg.kind === 'rear') {
      letGo(car);
      parkAt(car, /** @type {Spot} */ (leg.move.to));
      return;
    }
    if (car.visitor || car.leaving || !car.home || !T.buildings.has(car.home.id)) { remove(car); return; }
    letGo(car);
    Object.assign(car, { state: 'away', legs: [], k: 0, s: 0, v: 0, timer: clock + 60 + random() * 240 });
  }
  /** Lets go of the moves a car has crossed (once its back is out of the box) and of the bay it has driven out of.
   *  @param {Car} car */
  function release(car) {
    for (let i = car.holds.length - 1; i >= 0; i--) {
      const h = car.holds[i];
      if (h.at >= car.k) continue;
      let past = car.s;
      for (let j = h.at + 1; j < car.k; j++) past += car.legs[j].line.len;
      if (past < h.move.clear) continue;
      h.move.held--;
      car.holds.splice(i, 1);
      if (!car.holds.some((o) => o.move.box === h.move.box)) inBox.get(h.move.box)?.delete(car);
    }
    if (car.bay && (car.k > 0 || car.s > CAR_L)) { taken.delete(keyOf(car.bay)); car.bay = null; }
  }
  /** A car that has stood too long with no room beyond the box ahead goes another way, if one is free now.
   *  @param {Car} car */
  function detour(car) {
    const leg = car.legs[car.k];
    if (leg.kind !== 'seg' || leg.seg.cars[0] !== car || !car.dest || nextUnheld(car) !== car.k + 1) return;
    const planned = /** @type {{ move: Move }} */ (car.legs[car.k + 1]).move, cost = costTo(car.dest);
    for (const m of leg.seg.outs) {
      if (m === planned || !isSeg(m.to)) continue;
      const to = /** @type {Seg} */ (m.to);
      if (to.noStop || !Number.isFinite(cost[to.id]) || !canGo(car, { chain: [m], at: car.k + 1, slot: to })) continue;
      const rest = routeFrom(to, car.dest, cost);
      if (!rest) continue;
      car.legs = [...car.legs.slice(0, car.k + 1), ...legsOf([m, ...rest], null)];
      car.waited = 0;
      stats.detours++;
      return;
    }
  }
  /** One step of a car: as fast as it may go for the bends, the end of its way, the box it must wait at and the cars
   *  ahead; speeding up and slowing down gently, and never into another car. @param {Car} car */
  function drive(car) {
    car.was = [car.F, car.R];
    const look = (car.v * car.v) / (2 * BRAKE) + 0.6;
    let want = bendSpeed(car, look);
    const end = toEnd(car), stop = toStop(car), free = roomAhead(car, look + 0.3);
    if (end < Infinity) want = Math.min(want, Math.sqrt(2 * BRAKE * Math.max(0, end)) + 0.03);
    if (stop < Infinity) want = Math.min(want, Math.sqrt(2 * BRAKE * stop));
    if (free < Infinity) want = Math.min(want, Math.sqrt(2 * BRAKE * free));
    const was = car.v;
    car.v = car.v < want ? Math.min(want, car.v + ACCEL * STEP) : Math.max(want, car.v - HARD * STEP);
    const ds = guard(car, Math.min(car.v * STEP, stop, free, Math.max(0, end)));
    car.v = Math.min(car.v, ds / STEP);
    car.braking = car.v < was - 1e-3 || (car.v < 0.05 && stop < 0.5);
    advance(car, ds);
    if (car.state !== 'driving') return;
    // Turning up onto the flyover, it's up as its nose reaches the ramp; coming down, it's down once its back is off
    // the ramp, in the junction.
    const now = car.legs[car.k];
    if (now.kind === 'move') {
      const m = now.move;
      if (isSeg(m.to) && /** @type {Seg} */ (m.to).up && car.s > m.line.len - OVER - 0.05) car.up = true;
      else if (car.up && car.s > CAR_L - OVER) car.up = false;
    }
    release(car);
    car.waited = car.v < 0.02 ? car.waited + STEP : 0;
    if (car.waited > DETOUR) detour(car);
  }

  // ---- Who sets off.

  /** @param {number} h */
  function decide(h) {
    let visitors = 0;
    for (const c of cars) if (c.visitor) visitors++;
    for (const gate of roads.gatesIn) {
      if (visitors >= VISITORS || random() >= visit(h) * trips * STEP) continue;
      const bay = freeBay();
      if (!bay) continue;
      const car = newCar(bay.b.colour, null, true);
      taken.set(keyOf(bay), car);
      if (enterAt(car, gate, bay)) { cars.push(car); visitors++; } else taken.delete(keyOf(bay));
    }
    for (const car of [...cars]) {
      if (car.state === 'away') {
        if (clock < car.timer) continue;
        const home = homeSpot(car.home), gates = roads.gatesIn;
        if (!home) { remove(car); continue; }
        if (!gates.length || !enterAt(car, gates[Math.floor(random() * gates.length)], home)) car.timer = clock + 5;
        continue;
      }
      if (car.state !== 'parked') continue;
      const spot = /** @type {Spot} */ (car.spot);
      // Parked where the building has gone: off at once.
      const gone = !T.buildings.has(spot.b.id);
      if (car.visitor || car.leaving || (gone && spot.b !== car.home)) {
        if (car.leaving || gone || clock >= car.timer) { const home = car.visitor ? null : homeSpot(car.home); if (!leaveSpot(car, home ?? 'out')) car.timer = clock + 2; }
        continue;
      }
      if (spot.b === car.home) {
        if (gone) { car.leaving = true; continue; }
        if (random() >= leaveHome(h) * trips * STEP) continue;
        if (random() < 0.15) { leaveSpot(car, 'out'); continue; }
        const bay = freeBay(car.colour, spot.box);
        if (bay) { taken.set(keyOf(bay), car); if (!leaveSpot(car, bay)) taken.delete(keyOf(bay)); }
      } else if (random() < leavePlace(h) * STEP) {
        // Home off the same box (it came along since the car parked): round by the roads out of town.
        const home = homeSpot(car.home);
        leaveSpot(car, home && home.box !== spot.box ? home : 'out');
      }
    }
  }

  /** Moves the town on by one step. */
  function step() {
    clock += STEP;
    decide((clock / 60) % 24);
    letAcross();
    for (const car of [...cars]) if (car.state === 'driving' && cars.includes(car)) drive(car);
  }

  // ---- When the town changes.

  /** Where on the new roads a car is: the lane, or the move across a box, its leading axle is on, heading its way.
   *  @param {Car} car @returns {{ seg: Seg, s: number } | { move: Move, s: number } | null} */
  function locate(car) {
    const u = headingOf(car.F, car.R), p = car.F;
    /** @param {Line} line */
    const onLine = (line) => {
      let best = -1, top = 0.03;
      for (let k = 0; k < line.pts.length - 1; k++) {
        const a = line.pts[k], b = line.pts[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
        const d = Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t), l = Math.sqrt(l2);
        if (d < top && (dx * u[0] + dy * u[1]) / l > 0.8) { top = d; best = line.lens[k] + t * l; }
      }
      return best;
    };
    for (const seg of roads.segs) { const s = onLine(seg.line); if (s >= 0) return { seg, s }; }
    for (const move of roads.moves) { if (move.kind === 'park' && move.lead < 1e-6) continue; const s = onLine(move.line); if (s >= 0 && (move.kind !== 'park' || s <= move.lead)) return { move, s }; }
    return null;
  }
  /** A name for a move that's the same on the old roads and the new, while its box and its ends stay as they were.
   *  @param {Move} m */
  const moveKey = (m) => {
    const end = (/** @type {Seg | Spot} */ x, /** @type {boolean} */ first) => {
      if (!isSeg(x)) return 'S' + keyOf(/** @type {Spot} */ (x));
      const pts = /** @type {Seg} */ (x).line.pts, p = first ? pts[pts.length - 1] : pts[0];
      return `L${p[0].toFixed(3)},${p[1].toFixed(3)}`;
    };
    return `${m.box.tile}|${end(m.from, true)}|${end(m.to, false)}`;
  };
  /**
   * A driving car's way again on the new roads, from where it is, keeping the moves it had been let onto where they're
   * still there and on its way (`kept`: their names, and the name of the move it's on).
   * @param {Car} car @param {{ holds: Set<string>, on: string | null }} kept @param {Map<string, Move>} byKey
   */
  function replan(car, kept, byKey) {
    const old = car.legs[car.k];
    car.holds = [];
    car.slots = [];
    let dest = car.dest;
    if (dest && dest !== 'out') {
      const s = roads.spotOf.get(keyOf(dest));
      if (s) dest = s;
      else { taken.delete(keyOf(dest)); dest = elsewhere(car, dest.b.colour); }
    }
    car.dest = dest;
    if (!dest) return false;
    // Still in its spot, waiting to drive out: its way from there.
    if (old.kind === 'move' && old.move.kind === 'leave' && car.s < 1e-6) {
      const spot = roads.spotOf.get(keyOf(/** @type {Spot} */ (old.move.from)));
      const route = spot && routeFrom(spot, dest, costTo(dest));
      if (!route) return false;
      car.legs = legsOf(route, null);
      car.k = 0;
      return true;
    }
    car.asked = -1;
    // Parking already, its back wheels on their way into the spot: it carries on.
    if (old.kind === 'rear' && dest !== 'out') {
      let m = (kept.on && byKey.get(kept.on)) || null;
      if (!m || m.to !== dest) {
        // The move it came in by is gone: the one into its spot that passes nearest.
        let top = Infinity;
        for (const c of dest.ins) for (const q of c.line.pts) { const d = Math.hypot(q[0] - car.F[0], q[1] - car.F[1]); if (d < top) { top = d; m = c; } }
      }
      if (!m) return false;
      car.legs = [{ kind: 'rear', move: m, line: old.line }];
      car.k = 0;
      m.held++;
      car.holds.push({ move: m, at: 0 });
      boxSet(m.box).add(car);
      return true;
    }
    const same = old.kind === 'move' && kept.on ? byKey.get(kept.on) : null;
    const at = same ? { move: same, s: car.s } : locate(car);
    const cost = costTo(dest);
    if (at && 'seg' in at) {
      const route = routeFrom(at.seg, dest, cost);
      if (!route) return false;
      car.legs = legsOf(route, at.seg);
      car.s = at.s;
    } else if (at) {
      const m = at.move, rest = isSeg(m.to) ? routeFrom(/** @type {Seg} */ (m.to), dest, cost) : m.to === dest ? [] : null;
      if (!rest) return false;
      car.legs = [{ kind: 'move', move: m, line: m.line }, ...(isSeg(m.to) ? legsOf(rest, /** @type {Seg} */ (m.to)) : [])];
      car.s = at.s;
      boxSet(m.box).add(car);
    } else {
      // Off the new lanes (a bend reshaped by a new junction beside it, or a junction gone to a bend as a road off it
      // went): back onto the nearest lane ahead that runs its way, as sharply as a corner turns.
      const u = headingOf(car.F, car.R);
      let best = null, top = 1.5;
      for (const seg of roads.segs) {
        seg.line.pts.forEach((q, k) => {
          const dx = q[0] - car.F[0], dy = q[1] - car.F[1], d = Math.hypot(dx, dy);
          if (d >= top || d <= 0.3 || (dx * u[0] + dy * u[1]) / d <= 0.5 || k >= seg.line.pts.length - 1) return;
          const v = dirAt(seg.line, seg.line.lens[k]);
          if (v[0] * u[0] + v[1] * u[1] > 0) { top = d; best = { seg, s: seg.line.lens[k] }; }
        });
      }
      if (!best) return false;
      const route = routeFrom(best.seg, dest, cost);
      if (!route) return false;
      const target = pointAt(best.seg.line, best.s), line = makeLine(turnPath(car.F, u, target, dirAt(best.seg.line, best.s)));
      car.legs = [{ kind: 'blend', line }, { kind: 'seg', seg: best.seg, line: best.seg.line, from: best.s }, ...legsOf(route, null)];
      car.s = 0;
    }
    car.k = 0;
    // The moves it had been let onto, from here on, as far as they run unbroken; the move it's on, whatever.
    let last = -1;
    for (let j = 0; j < car.legs.length; j++) {
      const leg = car.legs[j];
      if (leg.kind !== 'move') continue;
      if (!(j === 0 && at && 'move' in at) && !kept.holds.has(moveKey(leg.move))) break;
      leg.move.held++;
      car.holds.push({ move: leg.move, at: j });
      last = j;
    }
    const after = last >= 0 ? car.legs[last + 1] : null;
    if (after?.kind === 'seg' && !after.seg.noStop) { after.seg.incoming++; car.slots.push(after.seg); }
    return true;
  }
  /** After the town has changed: the roads again, with every car on them; a new home's car comes into town, and the
   *  car of a home that came down leaves. */
  function after() {
    /** The buildings gone with cars still to drive out of them, or into them now. @type {Building[]} */
    const extra = [];
    /** What each driving car had been let onto, by name, on the old roads. @type {Map<Car, { holds: Set<string>, on: string | null }>} */
    const kept = new Map();
    for (const car of cars) {
      const leg = car.legs[car.k];
      /** @type {Building[]} */
      const here = [];
      if (car.state === 'parked' && car.spot) here.push(car.spot.b);
      if (car.state === 'driving' && (leg.kind === 'move' || leg.kind === 'rear')) {
        if (leg.move.kind === 'park') here.push(/** @type {Spot} */ (leg.move.to).b);
        if (leg.move.kind === 'leave') here.push(/** @type {Spot} */ (leg.move.from).b);
      }
      if (car.bay) here.push(car.bay.b);
      for (const b of here) if (!T.buildings.has(b.id) && !extra.includes(b)) extra.push(b);
      if (car.state === 'driving') kept.set(car, { holds: new Set(car.holds.map((h) => moveKey(h.move))), on: leg.kind === 'move' || leg.kind === 'rear' ? moveKey(leg.move) : null });
    }
    roads = buildRoads(T, extra);
    costs = new Map();
    inBox = new Map();
    const byKey = new Map(roads.moves.map((m) => [moveKey(m), m]));
    for (const car of [...cars]) {
      if (car.state === 'parked') {
        const s = roads.spotOf.get(keyOf(/** @type {Spot} */ (car.spot)));
        if (s) car.spot = s; else { stats.dropped++; remove(car); }
        continue;
      }
      if (car.state === 'driving' && !replan(car, /** @type {{ holds: Set<string>, on: string | null }} */ (kept.get(car)), byKey)) { stats.dropped++; remove(car); }
      if (car.bay) { const s = roads.spotOf.get(keyOf(car.bay)); car.bay = s ?? null; }
    }
    for (const car of cars) {
      if (car.state !== 'driving') continue;
      const leg = car.legs[car.k];
      if (leg.kind === 'seg') leg.seg.cars.push(car);
      car.up = leg.kind === 'seg' && leg.seg.up;
    }
    for (const seg of roads.segs) seg.cars.sort((p, q) => q.s - p.s);
    for (const car of [...cars]) if (car.home && !T.buildings.has(car.home.id)) { car.home = null; car.leaving = true; if (car.state === 'away') remove(car); }
    for (const h of homesOf(T)) if (!cars.some((c) => c.home === h)) { const car = newCar(h.colour, h); car.timer = clock; cars.push(car); }
  }

  /** The tiles the traffic needs, for the town's next change: those a car is on or on its way along, and where cars
   *  are parked (`route`); those a car stands on (`body`). */
  function inUse() {
    const route = new Uint8Array(N), body = new Uint8Array(N);
    /** @param {Uint8Array} a @param {Pt} p */
    const mark = (a, p) => { const x = Math.floor(p[0]), y = Math.floor(p[1]); if (x >= 0 && y >= 0 && x < W && y < H) a[y * W + x] = 1; };
    for (const car of cars) {
      if (car.state === 'away') continue;
      const [cx, cy, ux, uy] = bodyOf(car.F, car.R);
      for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        /** @type {Pt} */
        const p = [cx + (ux * a * CAR_L) / 2 - (uy * b * CAR_W) / 2, cy + (uy * a * CAR_L) / 2 + (ux * b * CAR_W) / 2];
        mark(body, p);
        mark(route, p);
      }
      if (car.state === 'parked') { route[doorOf(/** @type {Spot} */ (car.spot).b)] = 1; continue; }
      for (let j = car.k; j < car.legs.length; j++) {
        const line = car.legs[j].line;
        for (let s = j === car.k ? car.s : 0; s < line.len; s += 0.25) mark(route, pointAt(line, s));
        mark(route, line.pts[line.pts.length - 1]);
      }
    }
    return { route, body };
  }
  /** Where to draw a car, `t` of the way from its last step to this one: its middle, the way it faces, and whether
   *  it's up on the flyover. @param {Car} car @param {number} t */
  function pose(car, t) {
    const [wf, wr] = car.was, f = along(wf, [car.F[0] - wf[0], car.F[1] - wf[1]], t), r = along(wr, [car.R[0] - wr[0], car.R[1] - wr[1]], t);
    return { x: (f[0] + r[0]) / 2, y: (f[1] + r[1]) / 2, a: Math.atan2(f[1] - r[1], f[0] - r[0]), up: car.up };
  }

  return {
    get cars() { return cars; },
    get roads() { return roads; },
    get clock() { return clock; },
    stats,
    step,
    after,
    inUse,
    pose,
  };
}
