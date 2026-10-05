// Jack's Train World's trains (D77 to D100 in docs/plan/done/little-worlds-trains.md). Signals cut every track into
// blocks; a train may only go where it has booked, one train to a block. It books the block ahead while it's still
// far enough back to stop, so the lamps ahead turn amber before it arrives, red as it passes and green again behind
// it. At a look-ahead signal it books its whole way through the junction, and on until there's room for all of it, or
// nothing at all, so no train ever waits inside a junction. Where stations stand close, that way can cross several
// junctions; so the train that has waited longest at a look-ahead signal goes next: no other train may book a junction
// way on its stretch (or one crossing it) until it has, unless it's already on that stretch, and can clear it. Drop-offs use up their stock; whenever another load
// would fit, the dispatcher sends the nearest free train from the depot: empty to a pickup of that colour, load,
// deliver, back to the depot. No more than two trains head for one station at once (at a busy one the second waits its
// turn on the straight before the platform), but a colour has up to four at work: two at or on their way to its
// pickup, two to its drop-off; a loaded train waits at the pickup's platform while its drop-off has two coming. Add
// train brings one more onto the railway along the line from outside, to a free siding; Remove train sends a parked
// one, picked at random, out along it and off the railway (D97). Trains pick up speed and slow down where you can see it, run fastest along the main
// line, and slow down well before a red. It runs in fixed steps from a seed, so the same seed always plays out the
// same. Tested by tests/trains.test.js.
import { seeded } from '../town/layout.js';
import { pointAt, TRAIN } from './layout.js';

/** Seconds of time a step moves on. */
export const STEP = 0.05;
/** How fast trains go, in pixels a second at scale 1: on the main line (straight on through its junctions too),
 *  turning off it or onto it, and on the branches. */
export const TOP = 210;
const JUNCTION = 138;
const BRANCH = 156;
/** How hard they speed up and brake, in pixels a second each second at scale 1: gently enough that you see a train
 *  pick up speed for about three seconds after it starts, and slow down for two before it stops. */
const SPEED_UP = 70;
const BRAKE = 100;
const HARD_BRAKE = 270;
/** How far short of the end of its booking a train stops, at scale 1. */
const SHORT = 2;
/** Seconds loading or unloading at a platform. */
const DWELL = 5;
/** A drop-off's stock: how fast it's used (of a full stock, a second) and what one train brings. */
const USE = 1 / 80;
const LOAD = 0.2;
/** No more than this many trains head for one station at once, and this many work for one colour. */
const LIMIT = 2;
const JOBS = 4;
/** A train waiting this many seconds is taken off the network and comes back at the depot (D80). */
export const STUCK = 120;
/** A train waiting longer than this at a look-ahead signal, the longest of any, goes next. */
const FIRST_AFTER = 8;

/**
 * @typedef {import('./layout.js').Network} Network
 * @typedef {import('./layout.js').Track} Track
 * @typedef {import('./layout.js').Path} Path
 * @typedef {import('./layout.js').Station} Station
 * @typedef {{ id: number, kind: 'block' | 'path', part: Track | Path, s0: number, s1: number, owner: Train | null, taken: boolean, crosses: Piece[] }} Piece
 * A block (the stretch of a track from one signal to the next) or a way across a junction: what trains book.
 * @typedef {{ part: Track | Path, at: number }} Leg
 * @typedef {{
 *   id: number, phase: 'parked' | 'out' | 'loading' | 'over' | 'unloading' | 'home' | 'leaving', length: number,
 *   route: (Track | Path)[], starts: number[], pieces: { piece: Piece, a: number, b: number }[], ahead: number, behind: number,
 *   head: number, stop: number, speed: number, colour: number, cargo: number, still: number, until: number,
 *   job: null | { drop: any, pickup: any, platform: import('./layout.js').Stretch }, siding: Track, wants: Piece[] | null,
 * }} Train
 * A train's route is the tracks and ways it follows; `head` is how far along it its front is, `stop` where it will
 * stop. `pieces` are the route's blocks and ways in order, with where each starts and ends along it; the train has
 * booked those from `behind` to just before `ahead`. `wants` is the stretch it's waiting to book at a look-ahead
 * signal, if it is.
 */

/**
 * Trains on a network. `seed` decides the drop-offs' first stock.
 * @param {Network} network @param {number} seed
 */
export function startTrains(network, seed) {
  const random = seeded(seed ^ 0x2545f491);
  const { k } = network;
  const L = network.trainLength;

  // The pieces: each track's blocks, from one block signal to the next, and each way across a junction.
  /** @type {Map<Track, Piece[]>} */
  const blocksOf = new Map();
  /** @type {Map<Path, Piece>} */
  const wayOf = new Map();
  /** @type {Piece[]} */
  const pieces = [];
  for (const t of network.tracks) {
    const starts = t.signals.filter((s) => s.kind === 'block').map((s) => s.s);
    const blocks = starts.map((s0, i) => ({ id: pieces.length + i, kind: /** @type {const} */ ('block'), part: t, s0, s1: starts[i + 1] ?? t.len, owner: null, taken: false, crosses: [] }));
    pieces.push(...blocks);
    blocksOf.set(t, blocks);
  }
  for (const p of network.paths) {
    const piece = { id: pieces.length, kind: /** @type {const} */ ('path'), part: p, s0: 0, s1: p.len, owner: null, taken: false, crosses: [] };
    pieces.push(piece);
    wayOf.set(p, piece);
  }
  for (const p of network.paths) wayOf.get(p).crosses = p.crosses.map((c) => wayOf.get(c));

  // Stations and their stock; the depot's sidings.
  // A pickup's `heading` are the trains at it or on their way there; a drop-off's are all those with a load for it
  // (loaded or not yet), and its `coming` those on their way with one, or unloading.
  const stations = network.stations.map((st) => ({ ...st, stock: st.kind === 'drop' ? 0.2 + 0.4 * random() : 1, heading: 0, coming: 0, using: new Set() }));
  const pickupOf = (colour) => stations.find((s) => s.kind === 'pickup' && s.colour === colour);

  /** The quickest way from a track to another, as a list of tracks and the ways between them; null if there's none. */
  const routeTo = (from, to) => {
    if (from === to) return [from];
    const best = new Map([[from, 0]]);
    const via = new Map();
    const todo = [from];
    while (todo.length) {
      todo.sort((a, b) => best.get(a) - best.get(b));
      const t = todo.shift();
      for (const p of t.to?.paths ?? []) {
        if (p.from !== t) continue;
        const d = best.get(t) + p.len + p.to.len;
        if (d < (best.get(p.to) ?? Infinity)) {
          best.set(p.to, d);
          via.set(p.to, p);
          if (!todo.includes(p.to)) todo.push(p.to);
        }
      }
    }
    if (!via.has(to)) return null;
    const route = [to];
    for (let t = to; t !== from; t = via.get(t).from) route.unshift(via.get(t).from, via.get(t));
    return route;
  };

  /** Lays a train's new route out: where each part starts along it, and its pieces in order. */
  const setRoute = (train, route, from, stop) => {
    const starts = [];
    let at = 0;
    for (const part of route) {
      starts.push(at);
      at += part.len;
    }
    const list = [];
    route.forEach((part, i) => {
      if (part.kind === 'path') list.push({ piece: wayOf.get(part), a: starts[i], b: starts[i] + part.len });
      else for (const b of blocksOf.get(part)) list.push({ piece: b, a: starts[i] + b.s0, b: starts[i] + b.s1 });
    });
    // It keeps what it stands on and lets go of the rest of its old booking.
    const head = from;
    const tail = head - L;
    const keep = new Set(list.filter((p) => p.b > tail + 1e-6 && p.a < head - 1e-6).map((p) => p.piece));
    for (const { piece } of train.pieces.slice(train.behind, train.ahead)) if (!keep.has(piece) && piece.owner === train) piece.owner = null;
    const first = list.findIndex((p) => keep.has(p.piece));
    let last = first;
    while (last + 1 < list.length && keep.has(list[last + 1].piece)) last++;
    Object.assign(train, { route, starts, pieces: list, behind: first, ahead: last + 1, head, stop, wants: null });
  };

  // Trains start in the depot, one to a siding, the last siding left free.
  /** @type {Train[]} */
  const trains = Array.from({ length: network.trains }, (_, id) => {
    const siding = network.depot.sidings[id];
    const block = blocksOf.get(siding)[0];
    const train = { id, phase: /** @type {Train['phase']} */ ('parked'), length: L, route: [], starts: [], pieces: [{ piece: block, a: 0, b: siding.len }], ahead: 1, behind: 0, head: 0, stop: 0, speed: 0, colour: 0, cargo: 0, still: 0, until: 0, job: null, siding, wants: null };
    block.owner = train;
    setRoute(train, [siding], siding.len - padAt(k), siding.len - padAt(k));
    return train;
  });

  const traffic = {
    network,
    trains,
    stations,
    pieces,
    time: 0,
    /** What happened so far: loads picked up and delivered, trains taken off, the longest any train waited, the
     *  lowest any stock fell, how often a train went where it hadn't booked (never, if the rules hold), and trains
     *  that came onto the railway and left it. */
    stats: { loaded: 0, delivered: 0, removed: 0, longestWait: 0, lowestStock: 1, unbooked: 0, joined: 0, left: 0 },
  };

  /** Where a train stands in its route: the part and how far along it, for a distance along the route. */
  const partAt = (train, d) => {
    let i = train.starts.length - 1;
    while (i > 0 && train.starts[i] > d) i--;
    return { part: train.route[i], s: d - train.starts[i] };
  };

  /** The free sidings: no train on its way to them, and none in them (one pulling out still holds its siding). */
  const freeSidings = () => network.depot.sidings.filter((s) => !trains.some((t) => t.siding === s) && !blocksOf.get(s).some((b) => b.owner));

  /** Sends a train on: to a station's platform, or to a siding. */
  const send = (train, track, s) => {
    const here = partAt(train, train.head);
    // From partway across a junction, on along that way first.
    const onward = here.part.kind === 'path' ? routeTo(here.part.to, track) : null;
    const route = here.part.kind === 'path' ? onward && [here.part, ...onward] : routeTo(here.part, track);
    if (!route) return false;
    // A route that starts partway along a track: the train's distance along it is its place on that track.
    setRoute(train, route, here.s, 0);
    let at = 0;
    for (let i = 0; i < route.length - 1; i++) at += route[i].len;
    train.stop = at + s;
    return true;
  };

  /** The train that goes next (it has waited longest at a look-ahead signal), and the junction ways no other train
   *  may book meanwhile: those on its stretch and those crossing them. */
  let first = null;
  let stretch = [];
  let held = new Set();
  /** Whether a train stands on any of some pieces. */
  const standsOn = (train, pieces) => train.pieces.slice(train.behind, train.ahead).some((p) => p.a < train.head && p.b > train.head - L && pieces.includes(p.piece));

  /** The way through a junction, and on until there's room for the whole train beyond it (or its stop), booked
   *  all together or not at all. */
  const bookThrough = (train) => {
    const list = train.pieces;
    const run = [];
    let i = train.ahead;
    let beyond = 0;
    let lastWayEnd = 0;
    for (; i < list.length; i++) {
      const { piece, a, b } = list[i];
      run.push(piece);
      if (piece.kind === 'path') {
        beyond = 0;
        lastWayEnd = b;
        continue;
      }
      beyond += b - a;
      if (beyond >= L + 4 * k) break;
      if (train.stop >= a && train.stop <= b && train.stop - L >= lastWayEnd) break;
    }
    const free = run.every((piece) => (!piece.owner || piece.owner === train) && piece.crosses.every((c) => !c.owner || c.owner === train));
    const giveWay = first && first !== train && run.some((piece) => held.has(piece)) && !standsOn(train, stretch);
    if (!free || giveWay) {
      train.wants = run;
      return false;
    }
    for (const piece of run) piece.owner = train;
    train.ahead += run.length;
    train.wants = null;
    return true;
  };

  /** Books ahead while the train is close enough to need it: far enough back to stop if it can't. */
  const book = (train) => {
    const look = train.speed * train.speed / (2 * BRAKE * k) + 40 * k;
    while (train.ahead < train.pieces.length && train.pieces[train.ahead - 1].b - train.head < look && train.pieces[train.ahead - 1].b < train.stop + 1e-6) {
      const next = train.pieces[train.ahead];
      if (next.piece.kind === 'path') {
        if (!bookThrough(train)) return;
      } else {
        if (next.piece.owner && next.piece.owner !== train) return;
        next.piece.owner = train;
        train.ahead++;
      }
    }
  };

  /** The top speed where a piece is: slower turning off or onto the main line, and on the branches. */
  const main = (t) => t.name === 'inner' || t.name === 'outer';
  const topOn = (piece) => k * (piece.kind === 'path' ? (main(piece.part.from) && main(piece.part.to) ? TOP : JUNCTION) : main(piece.part) ? TOP : BRANCH);

  const move = (train) => {
    book(train);
    const end = Math.min(train.pieces[train.ahead - 1].b, train.stop) - (train.pieces[train.ahead - 1].b < train.stop ? SHORT * k : 0);
    const room = end - train.head;
    let want = Math.sqrt(2 * BRAKE * k * Math.max(0, room));
    // Slow for slower pieces ahead in time to reach their speed as it gets there.
    for (let i = train.behind; i < train.ahead; i++) {
      const p = train.pieces[i];
      if (p.b < train.head - train.length) continue;
      const to = Math.max(0, p.a - train.head);
      want = Math.min(want, Math.sqrt(topOn(p.piece) ** 2 + 2 * BRAKE * k * to));
    }
    const was = train.speed;
    train.speed = was < want ? Math.min(want, was + SPEED_UP * k * STEP) : Math.max(want, was - HARD_BRAKE * k * STEP);
    let ds = train.speed * STEP;
    if (ds > room) {
      ds = Math.max(0, room);
      train.speed = ds / STEP;
    }
    train.head += ds;
    // Let go of what the tail has left.
    while (train.behind < train.ahead && train.pieces[train.behind].b <= train.head - L + 1e-6) {
      const { piece } = train.pieces[train.behind];
      if (piece.owner === train) piece.owner = null;
      train.behind++;
    }
    train.still = train.speed < 0.5 * k ? train.still + STEP : 0;
  };

  /** A drop-off asks for another load whenever one would fit on top of its stock and the loads on their way: the
   *  nearest free train in the depot goes, if the pickup has room. */
  const dispatch = () => {
    for (const drop of stations) {
      if (drop.kind !== 'drop' || drop.heading >= JOBS || drop.stock + LOAD * (drop.heading + 1) > 1) continue;
      const pickup = pickupOf(drop.colour);
      if (pickup.heading >= LIMIT) continue;
      const parked = trains.filter((t) => t.phase === 'parked');
      if (!parked.length) return;
      // The platform at the pickup no other train is heading for.
      const platform = pickup.platforms.find((p) => !pickup.using.has(p.track)) ?? pickup.platforms[0];
      const near = parked.map((t) => [routeTo(t.siding, platform.track)?.reduce((sum, part) => sum + part.len, 0) ?? Infinity, t]).sort((a, b) => a[0] - b[0])[0];
      if (!Number.isFinite(near[0])) continue;
      const train = near[1];
      if (!send(train, platform.track, platform.s1 - padAt(k))) continue;
      Object.assign(train, { phase: 'out', colour: drop.colour, cargo: 0, job: { drop, pickup, platform }, siding: null });
      drop.heading++;
      pickup.heading++;
      pickup.using.add(platform.track);
    }
  };

  /** What a train does when it has stopped where it was going: out of sight on the line out, it has left. */
  const arrive = (train) => {
    const job = train.job;
    if (train.phase === 'leaving') {
      for (const { piece } of train.pieces) if (piece.owner === train) piece.owner = null;
      trains.splice(trains.indexOf(train), 1);
      traffic.stats.left++;
    } else if (train.phase === 'out') {
      Object.assign(train, { phase: 'loading', until: traffic.time + DWELL });
    } else if (train.phase === 'over') {
      Object.assign(train, { phase: 'unloading', until: traffic.time + DWELL });
    } else if (train.phase === 'home') {
      Object.assign(train, { phase: 'parked', job: null });
    }
    return job;
  };

  /** A train done at a platform goes on: from the pickup to the drop-off (once fewer than two are coming there; till
   *  then it waits, loaded, at the platform), or from the drop-off to a free siding. */
  const leave = (train) => {
    const job = train.job;
    if (train.phase === 'loading') {
      if (job.drop.coming >= LIMIT) return;
      train.cargo = 1;
      traffic.stats.loaded++;
      job.pickup.heading--;
      job.pickup.using.delete(job.platform.track);
      job.drop.coming++;
      const platform = job.drop.platforms[0];
      if (send(train, platform.track, platform.s1 - padAt(k))) train.phase = 'over';
    } else if (train.phase === 'unloading') {
      train.cargo = 0;
      job.drop.heading--;
      job.drop.coming--;
      traffic.stats.delivered++;
      const siding = freeSidings()[0];
      train.siding = siding;
      if (send(train, siding, siding.len - padAt(k))) train.phase = 'home';
    }
  };

  /** A train waiting too long is taken off and put back in a free siding (D80); its job is dropped. */
  const takeOff = (train) => {
    for (const { piece } of train.pieces) if (piece.owner === train) piece.owner = null;
    const job = train.job;
    // A train on its way home has delivered: its job no longer counts at either station.
    if (job && train.phase !== 'home') {
      if (train.phase === 'out' || train.phase === 'loading') {
        job.pickup.heading--;
        job.pickup.using.delete(job.platform.track);
      } else job.drop.coming--;
      job.drop.heading--;
    }
    const siding = train.phase === 'home' ? train.siding : freeSidings()[0];
    const block = blocksOf.get(siding)[0];
    block.owner = train;
    Object.assign(train, { phase: 'parked', job: null, siding, cargo: 0, speed: 0, still: 0, pieces: [{ piece: block, a: 0, b: siding.len }], behind: 0, ahead: 1 });
    setRoute(train, [siding], siding.len - padAt(k), siding.len - padAt(k));
    traffic.stats.removed++;
  };

  // Add train and Remove train, along the line out of the picture.
  const { line } = network;
  let nextId = trains.length;
  /** Trains Add train asked for that are still to come in. */
  let joining = 0;
  /** Whether Add train can bring one more: while the depot keeps a siding spare. */
  const canAdd = () => Boolean(line) && trains.length + joining < network.depot.sidings.length - 1;
  /** The trains Remove train can send away: parked ones, and empty ones on their way back to the depot. */
  const idle = () => trains.filter((t) => t.phase === 'parked' || t.phase === 'home');
  const canRemove = () => Boolean(line) && idle().length > 0;

  /** Add train: one more train will come in along the line from outside, as soon as the line is clear. */
  const addTrain = () => {
    if (!canAdd()) return false;
    joining++;
    return true;
  };

  /** Brings in a train Add train asked for: on the line in, out of sight, bound for a free siding; false if the line
   *  in isn't clear yet. */
  const bringIn = () => {
    const block = blocksOf.get(line.in)[0];
    const siding = freeSidings()[0];
    if (block.owner || !siding) return false;
    /** @type {Train} */
    const train = { id: nextId++, phase: 'home', length: L, route: [], starts: [], pieces: [{ piece: block, a: 0, b: line.in.len }], ahead: 1, behind: 0, head: 0, stop: 0, speed: 0, colour: 0, cargo: 0, still: 0, until: 0, job: null, siding, wants: null };
    block.owner = train;
    setRoute(train, [line.in], L + padAt(k), L + padAt(k));
    if (!send(train, siding, siding.len - padAt(k))) {
      block.owner = null;
      return false;
    }
    trains.push(train);
    traffic.stats.joined++;
    return true;
  };

  /** Remove train: a train with no work, picked at random, leaves along the line out: out of the depot if it's
   *  parked, straight there if it was on its way back. Returns the train, or null if none can. */
  const removeTrain = () => {
    const free = idle();
    if (!line || !free.length) return null;
    const train = free[Math.floor(random() * free.length)];
    if (!send(train, line.out, line.out.len - padAt(k))) return null;
    Object.assign(train, { phase: 'leaving', siding: null });
    return train;
  };

  /** One step of time. */
  const step = () => {
    traffic.time += STEP;
    if (joining > 0 && bringIn()) joining--;
    for (const st of stations) {
      if (st.kind !== 'drop') continue;
      st.stock = Math.max(0, st.stock - USE * STEP);
      traffic.stats.lowestStock = Math.min(traffic.stats.lowestStock, st.stock);
    }
    dispatch();
    first = null;
    for (const t of trains) if (t.wants && t.still > FIRST_AFTER && (!first || t.still > first.still)) first = t;
    stretch = first ? first.wants : [];
    held = new Set(stretch.filter((p) => p.kind === 'path').flatMap((p) => [p, ...p.crosses]));
    // A copy: trains leave the list as they leave the railway.
    for (const train of [...trains]) {
      if (train.phase === 'parked') continue;
      if (train.phase === 'loading' || train.phase === 'unloading') {
        // Wagons fill (or empty) one after another while it stands at the platform; a drop-off's stock fills as
        // they empty, not all at once at the end.
        const done = Math.max(0, Math.min(1, 1 - (train.until - traffic.time) / DWELL));
        if (train.phase === 'unloading') {
          const was = train.cargo;
          train.cargo = 1 - done;
          train.job.drop.stock = Math.min(1, train.job.drop.stock + LOAD * (was - train.cargo));
        } else train.cargo = done;
        if (traffic.time >= train.until) leave(train);
        continue;
      }
      move(train);
      if (train.head >= train.stop - 0.5 * k && train.speed < 0.5 * k) {
        arrive(train);
        continue;
      }
      traffic.stats.longestWait = Math.max(traffic.stats.longestWait, train.still);
      if (train.still > STUCK) takeOff(train);
    }
    // Which pieces trains' bodies are on: their lamps show red.
    for (const piece of pieces) piece.taken = false;
    for (const train of trains) {
      for (let i = train.behind; i < train.ahead; i++) {
        const p = train.pieces[i];
        if (p.a < train.head && p.b > train.head - L) p.piece.taken = true;
        if (p.piece.owner !== train && p.a < train.head && p.b > train.head - L) traffic.stats.unbooked++;
      }
    }
  };

  return Object.assign(traffic, { step, partAt, addTrain, removeTrain, canAdd, canRemove });
}

/** A train's stopping room at each end of a platform or siding, at scale `k`. */
const padAt = (k) => 8 * k;

/**
 * The point `d` along a train's route, and the way the track runs there.
 * @param {import('./sim.js').Train} train @param {number} d
 */
export function placeOn(train, d) {
  let i = train.starts.length - 1;
  while (i > 0 && train.starts[i] > d) i--;
  return pointAt(train.route[i], Math.max(0, d - train.starts[i]));
}

/**
 * Where each of a train's engine and wagons is, `head` along its route: the middle of each, the way it faces, and its
 * size. Each one's front and back both follow the track, so on a curve it cuts across it as a real wagon does.
 * @param {import('./sim.js').Train} train @param {number} head @param {number} k
 */
export function carsOf(train, head, k) {
  const cars = [];
  let front = head;
  for (let i = 0; i <= TRAIN.wagons; i++) {
    const len = (i ? TRAIN.wagon : TRAIN.engine) * k;
    const a = placeOn(train, front);
    const b = placeOn(train, front - len);
    cars.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, angle: Math.atan2(a.y - b.y, a.x - b.x), length: len, width: TRAIN.width * k, engine: i === 0 });
    front -= len + TRAIN.coupling * k;
  }
  return cars;
}

/**
 * What a signal's lamp shows: 'stop' (red) where a train is on what it guards, 'wait' (amber) where one has booked
 * it, 'go' (green) where it's free. A look-ahead signal guards the ways across its junction.
 * @param {ReturnType<typeof startTrains>} traffic @param {import('./layout.js').Track} track @param {import('./layout.js').Signal} signal
 */
export function lampOf(traffic, track, signal) {
  const guarded = signal.kind === 'chain'
    ? traffic.pieces.filter((p) => p.kind === 'path' && p.part.from === track)
    : traffic.pieces.filter((p) => p.kind === 'block' && p.part === track && p.s0 === signal.s);
  if (guarded.some((p) => p.taken)) return 'stop';
  if (guarded.some((p) => p.owner)) return 'wait';
  return 'go';
}
