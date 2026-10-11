// Jack's Town's thought bubbles. Now and then a car that's driving thinks of where it's going, in a comic thought
// cloud beside it: the building it's heading to, its home, or leaving town; a car held up long on the road is angry.
// A tap on a car asks it what it's thinking, whatever the limit. Each bubble pops up and fades on the page's own clock
// (real seconds), so it reads the same at any speed. This only watches the traffic, with a seed of its own, so the
// traffic plays out exactly as it would without it. A bubble sits beside its car as the car is seen on the screen,
// up and to the right of it, so the page says where each car is on the screen (the town may lie turned), measured in
// tiles. src/worlds/town.js draws the bubbles; tested by tests/town-thoughts.test.js.
import { seeded } from './map.js';

/** Seconds a thought lasts, from its first small circle to the end of its fade; how long the fade takes. */
export const THINK = 5;
export const FADE = 0.35;
/** Town minutes a driving car stands still on the road before it's angry: longer than it waits before it tries another
 *  way, so only a car that found none; about once a town hour on a busy day. */
export const ANGRY = 8;
/** At most this many thoughts at once, asked ones aside; and this many angry cars. */
export const MOST = 4;
const ANGRY_AT_ONCE = 3;
/** The chance in a second that a driving car with no thought yet this trip starts one, while there's room. */
const RATE = 0.05;
/** How much of its trip a car must still have ahead, in tiles, to start a thought: enough to finish it driving. */
const AHEAD = 6;
/** A new bubble starts only this far clear of the others, in tiles; of two that come this close, one fades out, early
 *  enough that they never touch while it does (two cars close in at most 3 tiles a second at real speed). */
const START_CLEAR = 1.6;
const FADE_CLEAR = 1.1;

/**
 * @typedef {import('./traffic.js').Car} Car @typedef {import('./map.js').Building} Building
 * @typedef {{ car: Car, kind: 'place' | 'home' | 'away' | 'angry', b: Building | null, colour: number, from: number, until: number, flip: { x: number, y: number }, trip: number, dest: Car['dest'], asked: boolean }} Bubble
 * What a car thinks of: the building it's driving to (`b`, in its colour), its home, leaving town, or its anger.
 * `from` and `until` are the seconds it pops up and is gone; an angry one lasts until its car moves on, then fades.
 * `flip` puts the cloud below (y -1) or to the left (x -1) of its car near the screen's edges. `trip` is when the car
 * set off on the trip it thought on, and `dest` where that trip went; `asked` marks one a tap asked for.
 * @typedef {{ x: number, y: number }} Place where a car is on the screen, in tiles from its top left
 * @typedef {{ left: number, top: number, right: number, bottom: number }} Box
 * @typedef {{ width: number, height: number, dx: number, dy: number }} Cloud a cloud's size, and where its middle is
 *   from its car's (up and to the right, unflipped), in tiles
 */

/** A cloud `width` tiles wide, in the old town's proportions. @param {number} width @returns {Cloud} */
export const cloudOf = (width) => ({ width, height: width * 0.62, dx: width * 0.4, dy: -width * 0.85 });

/** The box a bubble takes beside its car: from the car's middle out to the far edges of its cloud.
 *  @param {Bubble} bubble @param {Place} place @param {Cloud} cloud @returns {Box} */
export function boxOf(bubble, place, cloud) {
  const x = place.x + cloud.dx * bubble.flip.x;
  const y = place.y + cloud.dy * bubble.flip.y;
  return { left: Math.min(place.x, x - cloud.width / 2), right: Math.max(place.x, x + cloud.width / 2), top: Math.min(place.y, y - cloud.height / 2), bottom: Math.max(place.y, y + cloud.height / 2) };
}

/** How far apart two boxes are: 0 or less where they touch. @param {Box} a @param {Box} b */
export const apart = (a, b) => Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom);

/** What a car's trip is for: a building, its home, or out of town. @param {Car} car */
export function thoughtOf(car) {
  if (!car.dest || car.dest === 'out') return { kind: /** @type {const} */ ('away'), b: null, colour: car.colour };
  const b = car.dest.b;
  return { kind: b === car.home ? /** @type {const} */ ('home') : /** @type {const} */ ('place'), b, colour: b.colour };
}

/** Whether a car is going somewhere it can think of: driving, with somewhere to go. @param {Car} car */
export const goingSomewhere = (car) => car.state === 'driving' && car.dest !== null;

/** Whether a driving car is still in its drive or bay, waiting to pull out. @param {Car} car */
export const pullingOut = (car) => car.k === 0 && car.s === 0 && car.legs[0]?.kind === 'move' && car.legs[0].move.kind === 'leave';

/**
 * Thought bubbles over a town's traffic: call `step` once a frame, and `think` when a car is tapped.
 * @param {{ cars: Car[] }} traffic
 * @param {number} seed
 * @param {{ where: (car: Car) => Place, bounds: () => { w: number, h: number, top?: number }, cloud: () => Cloud }} screen
 *   where each car is on the screen, how big the screen is (and how far down from its top the page's own buttons
 *   reach), and how big a cloud is, all in tiles
 */
export function startThoughts(traffic, seed, screen) {
  const random = seeded(seed ^ 0x2c1b3c6d);
  /** @type {Bubble[]} */
  const bubbles = [];
  /** The trip each car last thought on: a car thinks of itself at most once a trip. @type {WeakMap<Car, number>} */
  const thoughtOn = new WeakMap();

  /** How much of its trip a car has still ahead, in tiles. @param {Car} car */
  const ahead = (car) => {
    let d = car.legs[car.k] ? car.legs[car.k].line.len - car.s : 0;
    for (let i = car.k + 1; i < car.legs.length; i++) { const leg = car.legs[i]; d += leg.line.len - (leg.kind === 'seg' ? leg.from ?? 0 : 0); }
    return d;
  };
  /** Where each car is this step, worked out once. @type {Map<Car, Place>} */
  let places = new Map();
  /** @param {Car} car */
  const placeOf = (car) => {
    let p = places.get(car);
    if (!p) { p = screen.where(car); places.set(car, p); }
    return p;
  };
  /** @param {Bubble} b */
  const boxNow = (b) => boxOf(b, placeOf(b.car), screen.cloud());
  /** On the screen, a little in from its edges. @param {Place} p */
  const onScreen = (p) => { const { w, h } = screen.bounds(); return p.x > 0.5 && p.x < w - 0.5 && p.y > 0.5 && p.y < h - 0.5; };
  /** Where a cloud goes: up and to the right, unless that would cross the screen's right edge, or go up under the
   *  page's buttons along its top. @param {Place} p */
  const flipFor = (p) => { const c = screen.cloud(), b = screen.bounds(); return { x: p.x + c.dx + c.width / 2 > b.w ? -1 : 1, y: p.y + c.dy - c.height / 2 < (b.top ?? 0) ? -1 : 1 }; };
  /** Which of two bubbles stays when they come close: an asked one over the rest (the latest asked first), otherwise
   *  the older one. @param {Bubble} b */
  const rank = (b) => (b.asked ? 1e9 + b.from : -b.from);
  /** A bubble for `car` thinking `what`, from `now` until `until`. @param {Car} car @param {ReturnType<typeof thoughtOf> | { kind: 'angry', b: null, colour: number }} what
   *  @param {number} now @param {number} until @param {boolean} asked @returns {Bubble} */
  const bubbleOf = (car, what, now, until, asked) => ({ car, ...what, from: now, until, flip: flipFor(placeOf(car)), trip: car.setOff, dest: car.dest, asked });
  /** Starts a thought or anger on its own, if it would be clear of the others; whether it did. @param {Bubble} bubble */
  const start = (bubble) => {
    const box = boxNow(bubble);
    if (bubbles.some((b) => apart(boxNow(b), box) < START_CLEAR)) return false;
    bubbles.push(bubble);
    return true;
  };

  /** Asks a car what it's thinking, at second `now`: a bubble of where it's going shows at once, whatever the limit,
   *  in place of any it has, and the bubbles too near it go at once. A parked car thinks of nothing; returns whether
   *  it thought. @param {Car} car @param {number} now */
  const think = (car, now) => {
    if (!traffic.cars.includes(car) || !goingSomewhere(car)) return false;
    places = new Map();
    const bubble = bubbleOf(car, thoughtOf(car), now, now + THINK, true);
    const box = boxNow(bubble);
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].car === car || apart(boxNow(bubbles[i]), box) < FADE_CLEAR) bubbles.splice(i, 1);
    bubbles.push(bubble);
    thoughtOn.set(car, car.setOff);
    return true;
  };

  /** The bubbles at second `now`, `dt` seconds on from the last step. @param {number} now @param {number} dt */
  const step = (now, dt) => {
    places = new Map();
    const cars = new Set(traffic.cars);
    // A bubble goes at once when its car has nowhere to go any more (it parked, left town or is gone), set off on
    // another trip or was sent somewhere else, and at the end of its time; an angry one starts to fade as soon as its
    // car moves on.
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (!cars.has(b.car) || !goingSomewhere(b.car) || b.car.setOff !== b.trip || b.car.dest !== b.dest || now >= b.until) bubbles.splice(i, 1);
      else if (b.kind === 'angry' && b.car.waited === 0) b.until = Math.min(b.until, now + FADE);
    }
    // Of two bubbles coming close, the one that ranks lower fades out before they touch.
    for (let i = 1; i < bubbles.length; i++) {
      for (let j = 0; j < i; j++) {
        const [a, b] = [bubbles[i], bubbles[j]];
        if (apart(boxNow(a), boxNow(b)) >= FADE_CLEAR) continue;
        const lower = rank(a) < rank(b) ? a : b;
        lower.until = Math.min(lower.until, now + FADE);
      }
    }
    const driving = traffic.cars.filter((c) => goingSomewhere(c) && !pullingOut(c));
    // A car held up long on the road is angry, a few at once.
    let angry = bubbles.filter((b) => b.kind === 'angry').length;
    for (const car of driving) {
      if (angry >= ANGRY_AT_ONCE) break;
      if (car.waited <= ANGRY || bubbles.some((b) => b.car === car) || !onScreen(placeOf(car))) continue;
      if (start(bubbleOf(car, { kind: 'angry', b: null, colour: car.colour }, now, Infinity, false))) angry++;
    }
    // Now and then a driving car thinks of where it's going: once a trip, while there's room.
    let thinking = bubbles.filter((b) => !b.asked && b.kind !== 'angry').length;
    for (const car of driving) {
      if (thinking >= MOST) break;
      if (thoughtOn.get(car) === car.setOff || bubbles.some((b) => b.car === car)) continue;
      if (random() >= RATE * dt || !onScreen(placeOf(car)) || ahead(car) < AHEAD) continue;
      if (start(bubbleOf(car, thoughtOf(car), now, now + THINK, false))) {
        thoughtOn.set(car, car.setOff);
        thinking++;
      }
    }
  };

  return { bubbles, step, think };
}
