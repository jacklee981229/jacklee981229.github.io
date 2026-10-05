// Jack's Town's thought bubbles (D86 to D91 in docs/plan/done/little-worlds-town.md). Now and then a car that's
// driving thinks of where it's going, in a comic thought cloud beside it: the place it's heading to, home, or a
// waving hand when it's leaving town; a car stuck in a jam is angry. A click on a car (or sending it out of town)
// asks it what it's thinking, whatever the limit. Each bubble pops up and fades on the town's own clock. This only
// watches the traffic, with a seed of its own, so the traffic plays out exactly as it would without it.
// src/worlds/town.js draws the bubbles; tested by tests/town.test.js.
import { seeded } from './layout.js';
import { carPlace, LONGEST_RED, STEP } from './sim.js';

/** Seconds a thought lasts, from its first small circle to the end of its fade; how long the fade takes. */
export const THINK = 5;
export const FADE = 0.35;
/** A driving car standing still longer than the longest red light is stuck in a jam, and angry (D88). */
export const ANGRY = LONGEST_RED + 1;
/** At most this many angry cars show it at once. */
const ANGRY_AT_ONCE = 3;
/** The chance in a second that a driving car with no thought yet this trip starts one, while there's room. */
const RATE = 0.05;
/** How much of its trip a car must still have ahead, in blocks, to start a thought: enough to finish it driving. */
const AHEAD = 2.4;
/** The cloud, in blocks: its size, and where its middle is from the car's (up and to the right, unflipped). */
export const CLOUD = { width: 0.26, height: 0.17, dx: 0.1, dy: -0.22 };
/** A new bubble starts only this far clear of the others; of two that come this close, one fades out, early enough
 *  that they never touch while it does (two cars close in at most 0.84 blocks a second). */
const START_CLEAR = 0.45;
const FADE_CLEAR = 0.35;

/**
 * @typedef {import('./sim.js').Car} Car
 * @typedef {{ car: Car, kind: 'place' | 'home' | 'away' | 'angry', colour: number, from: number, until: number, flip: { x: number, y: number }, trip: any, asked: boolean }} Bubble
 * What a car thinks of: the place it's driving to (in that place's colour), its home (in its colour), leaving town,
 * or its anger. `from` and `until` are the town times it pops up and is gone; an angry one lasts until its car moves
 * on, then fades. `flip` puts the cloud below (y -1) or to the left (x -1) of its car near the town's edge. `trip` is
 * the route the car was on when the bubble started; `asked` marks one a click (or sending the car away) asked for.
 * @typedef {{ left: number, top: number, right: number, bottom: number }} Box
 */

/**
 * The box a bubble takes beside its car: from the car's middle out to the far edges of its cloud.
 * @param {Bubble} bubble @param {{ x: number, y: number }} place the car's middle @returns {Box}
 */
export function boxOf(bubble, place) {
  const x = place.x + CLOUD.dx * bubble.flip.x;
  const y = place.y + CLOUD.dy * bubble.flip.y;
  return { left: Math.min(place.x, x - CLOUD.width / 2), right: Math.max(place.x, x + CLOUD.width / 2), top: Math.min(place.y, y - CLOUD.height / 2), bottom: Math.max(place.y, y + CLOUD.height / 2) };
}

/** How far apart two boxes are: 0 or less where they touch. @param {Box} a @param {Box} b */
export const apart = (a, b) => Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom);

/** What a car's trip is for: a place, home, or out of town. @param {Car} car */
export function thoughtOf(car) {
  if (car.exit) return { kind: /** @type {const} */ ('away'), colour: car.colour };
  const building = car.to.building;
  return building === car.home ? { kind: /** @type {const} */ ('home'), colour: building.colour } : { kind: /** @type {const} */ ('place'), colour: building.colour };
}

/** Whether a car is going somewhere it can think of: driving or backing out, or parked with a trip about to start. */
export const goingSomewhere = (car) => (car.mode === 'driving' || car.mode === 'backing' || car.mode === 'parked') && Boolean(car.to || car.exit);

/**
 * Thought bubbles over a town's traffic: call `step` after each of the traffic's steps, and `think` when a car is
 * asked what it's thinking.
 * @param {ReturnType<typeof import('./sim.js').startTraffic>} traffic @param {number} seed
 */
export function startThoughts(traffic, seed) {
  const random = seeded(seed ^ 0x2c1b3c6d);
  const { town } = traffic;
  /** At most one thought at a time for every eight homes, at least one and at most four (D87); asked ones aside. */
  const most = Math.min(4, Math.max(1, Math.floor(town.buildings.filter((b) => b.kind === 'home').length / 8)));
  /** @type {Bubble[]} */
  const bubbles = [];
  /** The trip each car last thought on: a car thinks of itself at most once a trip. */
  const thoughtOn = new WeakMap();

  /** How much of its trip a car has still ahead, in blocks. @param {Car} car */
  const ahead = (car) => {
    let d = car.route[car.part].len - car.s;
    for (let i = car.part + 1; i < car.route.length; i++) d += car.route[i].len;
    return d;
  };
  const inTown = (p) => p.x > 0 && p.x < town.cols && p.y > 0 && p.y < town.rows;
  /** Where a cloud goes: up and to the right, unless that would cross the town's top or right edge. */
  const flipFor = (place) => ({ x: place.x + CLOUD.dx + CLOUD.width / 2 > town.cols ? -1 : 1, y: place.y + CLOUD.dy - CLOUD.height / 2 < 0 ? -1 : 1 });
  /** Which of two bubbles stays when they come close: an asked one over the rest (the latest asked first), otherwise
   *  the older one. */
  const rank = (b) => (b.asked ? 1e9 + b.from : -b.from);
  /** Where each car of a bubble is, and each driving car, this step. */
  let places = new Map();
  const placeOf = (car) => {
    if (!places.has(car)) places.set(car, carPlace(car));
    return places.get(car);
  };

  /** Starts a thought or anger on its own, if it would be clear of the others; whether it did. */
  const start = (car, what, until) => {
    const place = placeOf(car);
    /** @type {Bubble} */
    const bubble = { car, ...what, from: traffic.time, until, flip: flipFor(place), trip: car.route, asked: false };
    const box = boxOf(bubble, place);
    if (bubbles.some((b) => apart(boxOf(b, placeOf(b.car)), box) < START_CLEAR)) return false;
    bubbles.push(bubble);
    return true;
  };

  /** Asks a car what it's thinking: a bubble of where it's going shows at once, whatever the limit, in place of any it
   *  has, and the bubbles too near it give way at once. A car parked with nowhere to go yet thinks of nothing; returns
   *  whether it thought. */
  const think = (car) => {
    if (!traffic.cars.includes(car) || !goingSomewhere(car)) return false;
    places = new Map();
    /** @type {Bubble} */
    const bubble = { car, ...thoughtOf(car), from: traffic.time, until: traffic.time + THINK, flip: flipFor(placeOf(car)), trip: car.route, asked: true };
    const box = boxOf(bubble, placeOf(car));
    for (let i = bubbles.length - 1; i >= 0; i--) {
      if (bubbles[i].car === car || apart(boxOf(bubbles[i], placeOf(bubbles[i].car)), box) < FADE_CLEAR) bubbles.splice(i, 1);
    }
    bubbles.push(bubble);
    thoughtOn.set(car, car.route);
    return true;
  };

  const step = () => {
    const now = traffic.time;
    places = new Map();
    const cars = new Set(traffic.cars);
    // A bubble goes at once when its car has nowhere to go any more (it parked at the end of its trip, has left town
    // or is gone) and at the end of its time; an angry one starts to fade as soon as its car moves on.
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (!cars.has(b.car) || !goingSomewhere(b.car) || now >= b.until) bubbles.splice(i, 1);
      else if (b.kind === 'angry' && b.car.still === 0) b.until = Math.min(b.until, now + FADE);
    }
    // Of two bubbles coming close, the one that ranks lower fades out before they touch.
    for (let i = 1; i < bubbles.length; i++) {
      for (let j = 0; j < i; j++) {
        const [a, b] = [bubbles[i], bubbles[j]];
        if (apart(boxOf(a, placeOf(a.car)), boxOf(b, placeOf(b.car))) >= FADE_CLEAR) continue;
        const lower = rank(a) < rank(b) ? a : b;
        lower.until = Math.min(lower.until, now + FADE);
      }
    }
    const driving = traffic.cars.filter((c) => c.mode === 'driving');
    // A car stuck in a jam is angry, a few at once.
    let angry = bubbles.filter((b) => b.kind === 'angry').length;
    for (const car of driving) {
      if (angry >= ANGRY_AT_ONCE) break;
      if (car.still <= ANGRY || !inTown(placeOf(car)) || bubbles.some((b) => b.car === car)) continue;
      if (start(car, { kind: 'angry', colour: car.colour }, Infinity)) angry++;
    }
    // Now and then a driving car thinks of where it's going: once a trip, while there's room.
    let thinking = bubbles.filter((b) => !b.asked && b.kind !== 'angry').length;
    for (const car of driving) {
      if (thinking >= most) break;
      if (thoughtOn.get(car) === car.route || bubbles.some((b) => b.car === car)) continue;
      if (random() >= RATE * STEP || !inTown(placeOf(car)) || ahead(car) < AHEAD) continue;
      if (start(car, thoughtOf(car), now + THINK)) {
        thoughtOn.set(car, car.route);
        thinking++;
      }
    }
  };

  return { bubbles, most, step, think };
}
