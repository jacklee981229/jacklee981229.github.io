// Jack's Town's traffic (D60 to D62 in docs/plan/todo/little-worlds-town.md): every car lives at a home, parked nose
// in on its drive. When its wait is over it backs out onto the lane, drives to a free bay at a place of its home's
// colour, turns in and parks there a while, then backs out again and drives home. Now and then it drives out of town
// instead, and comes back a while later. Visitors come in along the roads out of town, park at a place of their
// colour and drive out again, so the number of cars in town keeps changing. The lights answer the traffic: a road
// keeps its green while nobody waits on the other one, and gives it over as soon as nobody's coming (D96). Add car brings one more in from outside,
// to live in an empty home or else to stay, driving from place to place; Remove car sends a parked car, picked at
// random, out of town for good (D92). Each car decides every step for
// itself: keep its distance, slow for a turn, stop at the line for red, and cross a junction only when no path that
// crosses its own is in use and there's room for it beyond; a car that has waited long at a junction, with its way
// on still blocked, takes another way that's free and finds its way from there, so queues can't lock up. A car backing out waits for a clear stretch of lane;
// while it backs out or turns in, the stretch of lane it needs is kept clear behind it. The town runs in fixed steps
// from a seed, so the same seed always plays out the same; the page draws it between steps. Tested by
// tests/town.test.js.
import { BACK_OUT, BAY_WIDTH, CAR_LENGTH, COLOURS, pointOn, seeded, TURN_IN } from './layout.js';

/** Seconds of town time a step moves on. */
export const STEP = 0.05;
/** The space a car keeps behind the car in front, standing still. */
const GAP = 0.05;
/** Top speeds in blocks a second: on a lane, on a turn across a junction, turning into a bay, and backing out. */
const TOP = 0.42;
const TURN = 0.24;
const INTO_BAY = 0.14;
const BACKING = 0.12;
/** How fast a car speeds up, how hard it plans to brake, and how hard it can brake when it must, in blocks a second
 *  each second: gently, so a car takes about two seconds to get up to speed and a second to slow to a stop (D98). */
const SPEED_UP = 0.2;
const BRAKE = 0.35;
const HARD_BRAKE = 4;
/** A car that hasn't moved for this many seconds is taken off the road (D62); its trip starts again later. */
export const STUCK = 60;
/** A car that has waited this long at a junction with its way on blocked goes another way: longer than a red light,
 *  so nobody turns off just for a red. */
const DETOUR = 20;
/** How often a car leaving home drives out of town instead of to a place. */
const AWAY = 0.2;
/** At most this many visitors in town for each home. */
const VISITORS = 0.5;
/** Add car brings in at most this many cars for each home on top of one a home. */
const EXTRA = 0.5;
/** The lights, in seconds: a green lasts at least MIN_GREEN, and no longer than MAX_GREEN while cars wait on the
 *  other road; then amber, then red for everyone a moment. */
const MIN_GREEN = 4;
const MAX_GREEN = 9;
const AMBER = 2;
const ALL_RED = 1.5;
/** A car this near its stop line, on its way across, asks for green, or keeps it. */
const CALL = 0.45;
/** The longest a light stays red for a lane: a car standing still longer than this is stuck in a jam. */
export const LONGEST_RED = ALL_RED + MAX_GREEN + AMBER + ALL_RED;

/**
 * @typedef {import('./layout.js').Town} Town
 * @typedef {import('./layout.js').Lane} Lane
 * @typedef {import('./layout.js').Path} Path
 * @typedef {import('./layout.js').Bay} Bay
 * @typedef {import('./layout.js').Track} Track
 * @typedef {{
 *   id: number, colour: number, home: import('./layout.js').Building | null, visitor: boolean, stays: boolean, leaving: boolean,
 *   mode: 'parked' | 'backing' | 'driving' | 'away', bay: Bay | null, to: Bay | null, exit: Lane | null,
 *   route: (Lane | Path | Track)[], part: number, s: number, back: number,
 *   speed: number, front: number, length: number, still: number, waiting: number, leaves: number, pause: number,
 *   braking: boolean, signal: number,
 * }} Car
 * A visitor has no home: it comes into town, parks at a place and leaves, unless it `stays` (Add car brought it in
 * with no empty home for it): then it drives on from place to place. A car `leaving` is out of town for good once it
 * gets there (Remove car). A resident that's `away` is out of town.
 * `bay` is the bay the car is parked in or backing out of; `to` the bay it's driving to, or `exit` the road out of
 * town it's leaving by. `route` is the lanes and paths of its trip, ending with the way into its bay or that road; `part` is the one it's on and `s` how far along that its
 * front is. `back` is how far it has backed out. On a lane, `front` and `length` are the stretch of the lane it
 * keeps for itself: its own front and length while it drives, more while it turns in or backs out.
 */

/**
 * The light facing a lane's traffic at its junction: 'go', 'wait' (amber) or 'stop'; null where there's no light.
 * A junction's light shows green, then amber, to one road (`axis`) at a time, then red to both for a moment.
 * @param {Lane} lane
 */
export function lightFor(lane) {
  const light = lane.to.light;
  if (!light) return null;
  if (light.axis !== lane.axis) return 'stop';
  return light.phase === 'green' ? 'go' : light.phase === 'amber' ? 'wait' : 'stop';
}

/**
 * Traffic on a town. `seed` decides the waits and which bay each car picks.
 * @param {Town} town @param {number} seed
 */
export function startTraffic(town, seed) {
  const random = seeded(seed ^ 0x5bd1e995);
  const between = (a, b) => a + random() * (b - a);
  const homes = town.buildings.filter((b) => b.kind === 'home');
  const places = town.buildings.filter((b) => b.kind === 'place');
  /** @type {Car[]} */
  const cars = homes.map((home, id) => {
    const bay = home.bays[0];
    /** @type {Car} */
    const car = { id, colour: home.colour, home, visitor: false, stays: false, leaving: false, mode: 'parked', bay, to: null, exit: null, route: [], part: 0, s: 0, back: 0, speed: 0, front: 0, length: CAR_LENGTH, still: 0, waiting: 0, leaves: random() * 15, pause: 0, braking: false, signal: 0 };
    bay.car = car;
    return car;
  });
  const traffic = {
    town,
    cars,
    time: 0,
    /** What happened so far: trips set off and finished, cars taken off the road, visitors come into town and cars
     *  driven out of it, the longest a driving car stood still and the longest a car waited to back out, and the
     *  light each car had as it crossed into a junction (none should ever cross on 'stop'). */
    stats: { trips: 0, done: 0, removed: 0, visitors: 0, left: 0, longestStill: 0, longestWait: 0, crossed: { go: 0, wait: 0, none: 0, stop: 0 } },
  };
  let nextId = cars.length;

  // The lights: each starts green for one road, and from then on answers the traffic.
  const lit = town.junctions.filter((j) => j.light);
  for (const j of lit) Object.assign(j.light, { axis: j.light.offset % 2 < 1 ? 'h' : 'v', phase: 'green', since: -MIN_GREEN });
  /** Whether a car is coming up to a junction's stop line along one of its roads, near enough to want the light. */
  const calling = (j, axis) => j.lanesIn.some((lane) => lane.axis === axis && lane.cars.some((c) => c.mode === 'driving' && c.route[c.part] === lane && c.route[c.part + 1]?.kind === 'path' && lane.len - c.s < CALL));
  /** A green goes over to the other road once someone waits there and it has lasted long enough: at once if nobody's
   *  coming on its own road, after MAX_GREEN if they keep coming. With nobody waiting it stays. */
  const switchLights = () => {
    for (const j of lit) {
      const light = j.light;
      const age = traffic.time - light.since;
      if (light.phase === 'green') {
        if (age >= MIN_GREEN && calling(j, light.axis === 'h' ? 'v' : 'h') && (age >= MAX_GREEN || !calling(j, light.axis))) Object.assign(light, { phase: 'amber', since: traffic.time });
      } else if (light.phase === 'amber') {
        if (age >= AMBER) Object.assign(light, { phase: 'clear', since: traffic.time });
      } else if (age >= ALL_RED) Object.assign(light, { axis: light.axis === 'h' ? 'v' : 'h', phase: 'green', since: traffic.time });
    }
  };
  /** When each road into town next brings a visitor. */
  const nextVisitor = new Map(town.gates.map((g) => [g, between(2, 8)]));
  const anyGate = () => town.gates[Math.floor(random() * town.gates.length)];

  const rearOf = (c) => c.front - c.length;
  const stopping = (c) => c.speed * c.speed / (2 * BRAKE);
  /** A car onto a lane's list, which stays in order, front first. */
  const insert = (lane, car) => {
    const i = lane.cars.findIndex((c) => c.front < car.front);
    lane.cars.splice(i < 0 ? lane.cars.length : i, 0, car);
  };
  const drop = (list, car) => {
    const i = list.indexOf(car);
    if (i >= 0) list.splice(i, 1);
  };

  /** The lanes and paths from a spot on a lane to a bay, ending with the way into the bay, or to a road out of
   *  town; null if there's none. @param {Lane} from @param {number} s @param {Bay | Lane} to */
  const routeTo = (from, s, to) => {
    const bay = 'in' in to ? to : null;
    const goal = bay ? bay.lane : /** @type {Lane} */ (to);
    if (from === goal) return bay && bay.s - TURN_IN > s + 0.02 ? [from, bay.in] : null;
    /** @type {(Lane | Path | Track)[]} */
    const route = [from];
    let lane = from;
    for (let guard = 0; lane !== goal && guard < 500; guard++) {
      const step = town.next.get(lane)?.get(goal);
      if (!step || step === lane) return null;
      route.push(/** @type {Path} */ (lane.out.find((p) => p.to === step)), step);
      lane = step;
    }
    return bay ? [...route, bay.in] : route;
  };

  /** Whether a junction path is in use: a car on it, or one just off it whose back is still across the junction. */
  const busy = (path) => {
    if (path.cars.length) return true;
    const out = path.to.cars;
    for (let i = out.length - 1; i >= 0 && out[i].front < CAR_LENGTH; i--) if (out[i].mode === 'driving' && out[i].route[out[i].part - 1] === path) return true;
    return false;
  };

  /** Whether a car at the end of `lane` may cross onto `path` now. */
  const mayCross = (lane, path) => {
    if (lightFor(lane) === 'stop') return false;
    for (const other of path.crosses) if (busy(other)) return false;
    const last = path.cars[path.cars.length - 1];
    if (last && last.s < CAR_LENGTH + GAP) return false;
    const rear = path.to.cars[path.to.cars.length - 1];
    const room = rear ? rearOf(rear) : path.to.len;
    return room >= (path.cars.length + 1) * (CAR_LENGTH + GAP);
  };

  /** The stretch of a bay's lane a car needs to back out: from behind where it ends up to just past the bay. */
  const backingStretch = (bay) => ({ front: bay.s + BAY_WIDTH / 2, rear: bay.s - BACK_OUT - CAR_LENGTH });

  /** Whether that stretch is clear, and everything coming can stop short of it. */
  const clearToBack = (bay) => {
    const { front, rear } = backingStretch(bay);
    for (const c of bay.lane.cars) {
      if (rearOf(c) >= front + GAP) continue;
      if (c.front <= rear - GAP - stopping(c) - 0.02) continue;
      return false;
    }
    for (const path of bay.lane.into) for (const c of path.cars) if (path.len - c.s + rear < GAP + stopping(c) + 0.02) return false;
    return true;
  };

  /** The free bays at places of a colour: none parked there, none on the way. */
  const freeBays = (colour) => places.filter((p) => p.colour === colour).flatMap((p) => p.bays).filter((b) => !b.car && !b.coming);

  /** A parked car whose wait is over picks where it's going (a place, home, or out of town), then backs out once the
   *  lane is clear. */
  const leave = (car) => {
    if (!car.to && !car.exit) {
      const atHome = car.bay.building === car.home;
      let to = null;
      let exit = null;
      if (car.leaving || (car.visitor && !car.stays) || (atHome && town.gates.length && random() < AWAY)) exit = anyGate().out;
      else if (car.stays) {
        const free = freeBays(car.colour).filter((b) => b.building !== car.bay.building);
        to = free[Math.floor(random() * free.length)] ?? null;
      } else if (atHome) {
        const free = freeBays(car.colour);
        to = free[Math.floor(random() * free.length)] ?? null;
      } else to = car.home.bays[0];
      const route = (to || exit) && routeTo(car.bay.lane, car.bay.s - BACK_OUT, to ?? exit);
      if (!route) return void (car.leaves = traffic.time + between(2, 6));
      Object.assign(car, { to, exit, route });
      if (to) to.coming = car;
    }
    if (!clearToBack(car.bay)) {
      car.waiting += STEP;
      traffic.stats.longestWait = Math.max(traffic.stats.longestWait, car.waiting);
      return;
    }
    const { front, rear } = backingStretch(car.bay);
    Object.assign(car, { mode: 'backing', back: 0, speed: 0, waiting: 0, front, length: front - rear, pause: traffic.time + 0.4 });
    insert(car.bay.lane, car);
    traffic.stats.trips++;
  };

  const backOut = (car) => {
    if (traffic.time < car.pause) return;
    const track = car.bay.out;
    const want = Math.min(BACKING, Math.sqrt(2 * BRAKE * Math.max(0, track.len - car.back)));
    car.speed = car.speed < want ? Math.min(want, car.speed + SPEED_UP * STEP) : want;
    car.back = Math.min(track.len, car.back + car.speed * STEP);
    if (car.back < track.len - 0.002) return;
    // Out on the lane, facing the right way: a moment's pause, then off.
    const s = car.bay.s - BACK_OUT;
    car.bay.car = null;
    Object.assign(car, { mode: 'driving', bay: null, part: 0, s, front: s, length: CAR_LENGTH, speed: 0, pause: traffic.time + 0.35 });
  };

  /** Whether the bay a car is heading for has its mouth clear: the car ahead on the lane is past it. */
  const mouthClear = (car, lane) => {
    const i = lane.cars.indexOf(car);
    return i <= 0 || rearOf(lane.cars[i - 1]) >= car.to.s + BAY_WIDTH / 2;
  };

  /** How far ahead the car's way is clear, and how far before it must be down to `slowTo` (a turn ahead). */
  const clearAhead = (car) => {
    const part = car.route[car.part];
    if (part.kind === 'bay') return { free: part.len - car.s, slowFor: Infinity, slowTo: 0 };
    const i = part.cars.indexOf(car);
    if (part.kind === 'path') {
      if (i > 0) return { free: part.cars[i - 1].s - CAR_LENGTH - GAP - car.s, slowFor: Infinity, slowTo: 0 };
      const lane = /** @type {Lane} */ (car.route[car.part + 1]);
      const rear = lane.cars[lane.cars.length - 1];
      return { free: part.len - car.s + (rear ? rearOf(rear) - GAP : lane.len), slowFor: Infinity, slowTo: 0 };
    }
    let free = i > 0 ? rearOf(part.cars[i - 1]) - GAP - car.s : Infinity;
    if (car.exit && car.part === car.route.length - 1) return { free, slowFor: Infinity, slowTo: 0 };
    if (car.to && car.part === car.route.length - 2) {
      // The lane with the bay: on to where the turn in starts, and on into the bay once its mouth is clear.
      const turn = car.to.s - TURN_IN - car.s;
      if (!mouthClear(car, part)) return { free: Math.min(free, turn), slowFor: Infinity, slowTo: 0 };
      return { free: Math.min(free, turn + car.to.in.len), slowFor: turn, slowTo: INTO_BAY };
    }
    if (i > 0) return { free, slowFor: Infinity, slowTo: 0 };
    // The car that last crossed into the junction from here may still have its back on this lane.
    for (const p of part.out) if (p.cars.length) free = Math.min(free, part.len + p.cars[p.cars.length - 1].s - CAR_LENGTH - GAP - car.s);
    const toEnd = part.len - car.s;
    const path = /** @type {Path} */ (car.route[car.part + 1]);
    if (!mayCross(part, path)) return { free: Math.min(free, toEnd), slowFor: Infinity, slowTo: 0 };
    const last = path.cars[path.cars.length - 1];
    const rear = path.to.cars[path.to.cars.length - 1];
    const beyond = last ? last.s - CAR_LENGTH - GAP : path.len + (rear ? rearOf(rear) - GAP : path.to.len);
    return { free: Math.min(free, toEnd + beyond), slowFor: path.turn ? toEnd : Infinity, slowTo: TURN };
  };

  const park = (car) => {
    drop(car.route[car.route.length - 2].cars, car);
    const bay = car.to;
    Object.assign(car, { mode: 'parked', bay, to: null, route: [], part: 0, s: 0, speed: 0, braking: false, signal: 0, still: 0 });
    bay.car = car;
    bay.coming = null;
    car.leaves = traffic.time + (bay.building === car.home ? between(5, 18) : between(4, 10));
    traffic.stats.done++;
  };

  /** The way a car is signalling: -1 left, 1 right, 0 not at all. */
  const signalFor = (car) => {
    const part = car.route[car.part];
    if (part.kind === 'bay') return -1;
    if (part.kind === 'path') return part.side;
    if (car.exit && car.part === car.route.length - 1) return 0;
    if (car.to && car.part === car.route.length - 2) return car.to.s - TURN_IN - car.s < 0.4 ? -1 : 0;
    const path = /** @type {Path} */ (car.route[car.part + 1]);
    return part.len - car.s < 0.35 ? path.side : 0;
  };

  /** A car waiting at the end of a lane whose way on is blocked: if another way across is free and leads on to where
   *  it's going, it takes that one instead (the rest of its route found again from there). */
  const detour = (car) => {
    const lane = /** @type {Lane} */ (car.route[car.part]);
    const blocked = /** @type {Path} */ (car.route[car.part + 1]);
    for (const path of lane.out) {
      if (path === blocked || !mayCross(lane, path)) continue;
      const rest = routeTo(path.to, 0, car.to ?? car.exit);
      if (!rest) continue;
      // The same route, changed from here on, so it's still the same trip.
      car.route.splice(car.part + 1, Infinity, path, ...rest);
      return;
    }
  };

  const drive = (car) => {
    if (traffic.time < car.pause) return;
    const at = car.route[car.part];
    const crossing = at.kind === 'lane' && !(car.exit && car.part === car.route.length - 1) && !(car.to && car.part === car.route.length - 2);
    if (crossing && car.still > DETOUR && car.s >= at.len - 0.001 && !mayCross(at, car.route[car.part + 1])) detour(car);
    const part = car.route[car.part];
    const { free, slowFor, slowTo } = clearAhead(car);
    let want = Math.min(part.kind === 'bay' ? INTO_BAY : part.kind === 'path' && part.turn ? TURN : TOP, Math.sqrt(2 * BRAKE * Math.max(0, free)));
    if (slowFor < Infinity) want = Math.min(want, Math.sqrt(slowTo * slowTo + 2 * BRAKE * Math.max(0, slowFor)));
    const was = car.speed;
    car.speed = car.speed < want ? Math.min(want, car.speed + SPEED_UP * STEP) : Math.max(want, car.speed - HARD_BRAKE * STEP);
    let ds = car.speed * STEP;
    // Never further than the way is clear, however hard that brakes.
    if (ds > free) {
      ds = Math.max(0, free);
      car.speed = ds / STEP;
    }
    car.braking = car.speed < was - 1e-4 || car.speed < 0.02;
    car.s += ds;

    // Across the end of a lane or a path onto the next, or off the lane into the bay.
    let here = car.route[car.part];
    for (;;) {
      if (car.exit && car.part === car.route.length - 1) {
        if (car.s >= here.len) return goAway(car);
        break;
      }
      if (here.kind === 'lane' && car.to && car.part === car.route.length - 2) {
        const turn = car.to.s - TURN_IN;
        if (car.s < turn) break;
        if (!mouthClear(car, here)) {
          car.s = turn;
          car.speed = 0;
          break;
        }
        // Turning in: until it's parked, the car keeps the lane clear from behind where the turn began to past the bay.
        car.front = car.to.s + BAY_WIDTH / 2;
        car.length = car.front - (turn - CAR_LENGTH);
        car.s -= turn;
        here = car.route[++car.part];
        continue;
      }
      if (car.s <= here.len || here.kind === 'bay') break;
      const next = car.route[car.part + 1];
      if (here.kind === 'lane') {
        if (!mayCross(here, /** @type {Path} */ (next))) {
          car.s = here.len;
          car.speed = 0;
          break;
        }
        traffic.stats.crossed[lightFor(here) ?? 'none']++;
      }
      drop(here.cars, car);
      /** @type {any} */ (next).cars.push(car);
      car.s -= here.len;
      here = car.route[++car.part];
    }
    if (here.kind === 'lane') car.front = car.s;
    car.signal = signalFor(car);
    if (here.kind === 'bay' && car.s >= here.len - 0.002) return park(car);

    car.still = car.speed < 0.02 ? car.still + STEP : 0;
    traffic.stats.longestStill = Math.max(traffic.stats.longestStill, car.still);
    if (car.still > STUCK) takeOff(car);
  };

  /** A car at the end of a road out of town has left: a visitor for good, a resident until it comes back. */
  const goAway = (car) => {
    drop(/** @type {Lane} */ (car.route[car.part]).cars, car);
    traffic.stats.done++;
    traffic.stats.left++;
    if (car.visitor || car.leaving) return void cars.splice(cars.indexOf(car), 1);
    Object.assign(car, { mode: 'away', exit: null, route: [], part: 0, s: 0, speed: 0, braking: false, signal: 0, still: 0, leaves: traffic.time + between(25, 70) });
  };

  /** A car comes into town along a road from outside, heading for its bay, if there's room on the road for it. */
  const comeIn = (car, gate) => {
    const lane = gate.in;
    const rear = lane.cars[lane.cars.length - 1];
    const speed = 0.3;
    if (rear && rearOf(rear) - GAP - CAR_LENGTH < speed * speed / (2 * BRAKE) + 0.05) return false;
    const route = routeTo(lane, CAR_LENGTH, car.to);
    if (!route) return false;
    Object.assign(car, { mode: 'driving', route, part: 0, s: CAR_LENGTH, front: CAR_LENGTH, length: CAR_LENGTH, speed, still: 0, pause: 0 });
    lane.cars.push(car);
    traffic.stats.trips++;
    return true;
  };

  /** A visitor along a road into town, now and then, while there's room in town and a free bay in its colour. */
  const visit = (gate) => {
    nextVisitor.set(gate, traffic.time + between(5, 14));
    if (cars.filter((c) => c.visitor && !c.stays).length >= Math.max(3, Math.round(homes.length * VISITORS))) return;
    const colour = Math.floor(random() * COLOURS);
    const free = freeBays(colour);
    if (!free.length) return;
    const to = free[Math.floor(random() * free.length)];
    /** @type {Car} */
    const car = { id: nextId++, colour, home: null, visitor: true, stays: false, leaving: false, mode: 'driving', bay: null, to, exit: null, route: [], part: 0, s: 0, back: 0, speed: 0, front: 0, length: CAR_LENGTH, still: 0, waiting: 0, leaves: 0, pause: 0, braking: false, signal: 0 };
    if (!comeIn(car, gate)) return void nextVisitor.set(gate, traffic.time + 1);
    to.coming = car;
    cars.push(car);
    traffic.stats.visitors++;
  };

  /** A resident out of town comes back along any road in, to its own drive. */
  const comeHome = (car) => {
    car.to = car.home.bays[0];
    if (comeIn(car, anyGate())) car.to.coming = car;
    else Object.assign(car, { to: null, leaves: traffic.time + 0.5 });
  };

  /** A car stuck too long is taken off the road (D62): a resident is back on its drive and sets off again later, a
   *  visitor is gone. */
  const takeOff = (car) => {
    const here = car.route[car.part];
    drop(here.kind === 'bay' ? /** @type {Lane} */ (car.route[car.part - 1]).cars : /** @type {any} */ (here).cars, car);
    if (car.to) car.to.coming = null;
    traffic.stats.removed++;
    if (car.visitor) return void cars.splice(cars.indexOf(car), 1);
    const bay = car.home.bays[0];
    Object.assign(car, { mode: 'parked', bay, to: null, exit: null, route: [], part: 0, s: 0, speed: 0, braking: false, signal: 0, still: 0, leaves: traffic.time + between(10, 20) });
    bay.car = car;
  };

  /** Cars Add car asked for that are still to drive in. */
  let arriving = 0;
  /** Cars that live in town (residents, away ones too, and those that stay), not counting any on their way out. */
  const living = () => cars.filter((c) => (!c.visitor || c.stays) && !c.leaving).length;
  /** Whether Add car can bring in one more: up to half as many again as there are homes. */
  const canAdd = () => living() + arriving < homes.length + Math.round(homes.length * EXTRA);
  /** The parked cars Remove car can send away. */
  const leavable = () => cars.filter((c) => c.mode === 'parked' && !c.leaving);

  /** Add car: one more car will come in along a road from outside, as soon as there's room on it. */
  const addCar = () => {
    if (!canAdd()) return false;
    arriving++;
    return true;
  };

  /** Brings in a car Add car asked for, to an empty home (one whose car has left town for good: it lives there from
   *  now on), or else to a free bay at a place (it stays, in that place's colour); false if a road in has no room or
   *  there's nowhere to go. */
  const bringIn = () => {
    const empty = homes.find((h) => !cars.some((c) => c.home === h));
    let to = empty ? empty.bays[0] : null;
    if (!to) {
      const free = places.flatMap((p) => p.bays).filter((b) => !b.car && !b.coming);
      to = free[Math.floor(random() * free.length)] ?? null;
      if (!to) return false;
    }
    /** @type {Car} */
    const car = { id: nextId++, colour: to.building.colour, home: empty ?? null, visitor: !empty, stays: !empty, leaving: false, mode: 'driving', bay: null, to, exit: null, route: [], part: 0, s: 0, back: 0, speed: 0, front: 0, length: CAR_LENGTH, still: 0, waiting: 0, leaves: 0, pause: 0, braking: false, signal: 0 };
    if (!comeIn(car, anyGate())) return false;
    to.coming = car;
    cars.push(car);
    return true;
  };

  /** Remove car: a parked car, picked at random, leaves town for good, backing out as soon as there's a gap. A
   *  resident's home stays empty until Add car brings someone to live there. Returns the car, or null if none can. */
  const removeCar = () => {
    const pick = leavable();
    if (!pick.length) return null;
    const car = pick[Math.floor(random() * pick.length)];
    const exit = anyGate().out;
    const route = routeTo(car.bay.lane, car.bay.s - BACK_OUT, exit);
    if (!route) return null;
    if (car.to) car.to.coming = null;
    Object.assign(car, { leaving: true, to: null, exit, route, leaves: traffic.time });
    return car;
  };

  /** One step of town time. */
  const step = () => {
    traffic.time += STEP;
    switchLights();
    if (arriving > 0 && bringIn()) arriving--;
    for (const gate of town.gates) if (traffic.time >= nextVisitor.get(gate)) visit(gate);
    // A copy: cars leave the list as they drive out of town.
    for (const car of [...cars]) {
      if (car.mode === 'driving') drive(car);
      else if (car.mode === 'backing') backOut(car);
      else if (traffic.time < car.leaves) continue;
      else if (car.mode === 'away') comeHome(car);
      else leave(car);
    }
  };

  return Object.assign(traffic, { step, addCar, removeCar, canAdd, canRemove: () => leavable().length > 0 });
}

/** A point `s` along a car's route, walking back onto the parts before when `s` is behind the one it's on. */
function along(car, s) {
  let part = car.part;
  while (s < 0 && part > 0) {
    // The way into a bay leaves its lane partway along, where the turn in starts.
    if (car.route[part].kind === 'bay') return pointOn(car.route[part - 1], car.to.s - TURN_IN + s);
    s += car.route[--part].len;
  }
  return pointOn(car.route[part], Math.max(0, s));
}

/** A point `d` along a bay's way out, or past its end, straight on (backwards along the lane). @param {Track} track */
function beyond(track, d) {
  if (d <= track.len) return pointOn(track, d);
  const end = track.points[track.points.length - 1];
  const before = track.points[track.points.length - 2];
  const k = (d - track.len) / Math.hypot(end.x - before.x, end.y - before.y);
  return { x: end.x + (end.x - before.x) * k, y: end.y + (end.y - before.y) * k };
}

/**
 * Where a car is: the middle of its body and the way it faces. Its front and back both follow its way, so on a
 * curve the body cuts across it as a real car's does; backing out, its back leads.
 * @param {import('./sim.js').Car} car
 */
export function carPlace(car) {
  if (car.mode === 'parked') return { x: car.bay.x, y: car.bay.y, angle: car.bay.angle };
  const front = car.mode === 'backing' ? pointOn(car.bay.out, car.back) : along(car, car.s);
  const back = car.mode === 'backing' ? beyond(car.bay.out, car.back + CAR_LENGTH) : along(car, car.s - CAR_LENGTH);
  return { x: (front.x + back.x) / 2, y: (front.y + back.y) / 2, angle: Math.atan2(front.y - back.y, front.x - back.x) };
}
