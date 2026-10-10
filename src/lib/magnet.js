// The magnet under Magnetic Liquid's dish (src/effects/magnetic-liquid.js): how its field falls away across the
// liquid, how far past the point of rising into spikes that takes the liquid, how strong the magnet is turned up for
// each way it's being moved, and where it wanders when nobody moves it. In the dish's own units: the inside of its rim
// is 1 from the middle. The shaders work the field out with these same numbers (FIELD_GLSL).

/** How far below the liquid the magnet sits. The crown is about as wide as this is deep. */
export const DEPTH = 0.5;
/** At strength 1 the spikes reach out to where the field's square has fallen to 1 / GAIN of its most. */
export const GAIN = 2.4;
/** How fast the liquid goes past its onset as the field grows, and the most it goes: much further and the spikes
 * would join up into ridges instead of standing apart. */
export const ONSET_RISE = 1;
export const ONSET_MOST = 0.22;
/** The magnet's everyday strength, and held down. Holding sends the field's square up by nearly twice. */
export const REST = 1;
export const HELD = 1.4;
/** Seconds the strength takes to go most of the way (63 %) up, and down. */
export const RISE = 0.2;
export const FALL = 0.15;
/** Seconds after a finger lifts that the field stays off, before the magnet wanders again: the stage's own wait. */
export const LIFTED = 2.5;
/** CSS pixels the magnet sits above a fingertip, so the finger doesn't hide the spikes. */
export const FINGER_LIFT = 40;
/** How far from the middle the magnet goes, as a share of the dish: the crown keeps clear of the wall. */
export const REACH = 0.7;

/**
 * The square of the field of a small magnet `z` below, at a distance whose square is `r2` from the point right over
 * it: |H|² ∝ (r² + 4z²) / (r² + z²)⁴, which is 4 / z⁶ right over it. The pull on the liquid goes with this square.
 * @param {number} r2 @param {number} [z]
 */
export function fieldSq(r2, z = DEPTH) {
  const s = r2 + z * z;
  return (r2 + 4 * z * z) / (s * s * s * s);
}

/** The field's square as a share of its most (1 right over the magnet). @param {number} r2 @param {number} [z] */
export const fieldShare = (r2, z = DEPTH) => (fieldSq(r2, z) * z ** 6) / 4;

/**
 * Which way the field's square grows, and how fast, at (x, y) from the point over the magnet: the way the liquid is
 * pulled, always towards the magnet. As a share, like fieldShare.
 * @param {number} x @param {number} y @param {number} [z] @returns {[number, number]}
 */
export function fieldPull(x, y, z = DEPTH) {
  const r2 = x * x + y * y;
  const s = r2 + z * z;
  // The square's slope along r² is −3(r² + 5z²) / s⁵; along x it's 2x times that.
  const k = ((-6 * (r2 + 5 * z * z)) / s ** 5) * (z ** 6 / 4);
  return [k * x, k * y];
}

/**
 * How far past its onset the liquid is where the field's share is `share` at strength `m`: below 0 it lies flat, above
 * it rises into spikes, the more so the further past. It eases off towards ONSET_MOST, and never sinks below −1.
 * @param {number} share @param {number} m
 */
export function onset(share, m) {
  const e = ONSET_RISE * (m * m * GAIN * share - 1);
  return e > 0 ? ONSET_MOST * Math.tanh(e / ONSET_MOST) : Math.max(-1, e);
}

/** The same field and onset for the shaders, from the same numbers. */
export const FIELD_GLSL = `
const float MAGNET_DEPTH = ${DEPTH.toFixed(6)};
const float FIELD_GAIN = ${GAIN.toFixed(6)};
float fieldShare(float r2) {
  float z2 = MAGNET_DEPTH * MAGNET_DEPTH;
  float s = r2 + z2;
  return (r2 + 4.0 * z2) * z2 * z2 * z2 / (4.0 * s * s * s * s);
}
float onset(float share, float m) {
  float e = ${ONSET_RISE.toFixed(6)} * (m * m * FIELD_GAIN * share - 1.0);
  return e > 0.0 ? ${ONSET_MOST.toFixed(6)} * tanh(min(e / ${ONSET_MOST.toFixed(6)}, 8.0)) : max(-1.0, e);
}`;

/**
 * The strength the magnet heads for: turned up while a button or finger is held, off for LIFTED seconds after a
 * finger lifts (so the crown slumps back into the puddle), and otherwise its everyday strength.
 * @param {{ down: boolean, touch: boolean, sinceLift: number }} input `touch`: the last pointer was a finger;
 * `sinceLift`: seconds since it lifted
 */
export function strengthGoal({ down, touch, sinceLift }) {
  if (down) return HELD;
  if (touch && sinceLift < LIFTED) return 0;
  return REST;
}

/** The strength `dt` seconds on, heading for `goal`: up at RISE's pace, down at FALL's. @param {number} m @param {number} goal @param {number} dt */
export function easeStrength(m, goal, dt) {
  return goal + (m - goal) * Math.exp(-dt / (goal > m ? RISE : FALL));
}

/**
 * Where the magnet wanders at time `t` (seconds) with nobody moving it, as [x, y] in the dish: a slow figure from
 * waves whose lengths never line up, so it never quite repeats. It starts out on the left, heading right, so the
 * crown is seen walking from the first seconds.
 * @param {number} t @returns {[number, number]}
 */
export function wander(t) {
  const x = 0.5 * Math.sin(0.43 * t - 1.25) * (0.85 + 0.15 * Math.cos(0.19 * t));
  const y = 0.34 * Math.sin(0.61 * t + 0.35) + 0.12 * Math.sin(0.23 * t + 2.1);
  return [x, y];
}

/**
 * A point kept inside REACH of the middle: anything further is drawn back onto the circle, easing in over its last
 * fifth so the magnet slides along the edge rather than stopping dead.
 * @param {number} x @param {number} y @returns {[number, number]}
 */
export function keepInside(x, y) {
  const r = Math.hypot(x, y);
  const knee = REACH * 0.8;
  if (r <= knee) return [x, y];
  const kept = knee + (REACH - knee) * Math.tanh((r - knee) / (REACH - knee));
  return [(x * kept) / r, (y * kept) / r];
}
