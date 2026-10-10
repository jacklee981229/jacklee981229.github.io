// How the fireflies of Jack's Firefly River (src/worlds/fireflies.js) fall into step. Each firefly is a clock that
// flashes once a turn, after Ermentrout's adaptive model of the synchronous fireflies of South East Asia (1991): a
// flash it sees late in its turn hurries it on, one seen early holds it back, and its own pace drifts towards the pace
// of the flashes it sees, then back to its own over a few seconds once they stop. Fireflies see each other through a
// coarse picture of the light, blurred as far as a firefly can see, so neighbours fall into step first and the step
// spreads from tree to tree. A faint pull towards true time (this site's server's clock) then gathers the whole bank
// onto a flash every half second, so two screens side by side end up flashing together; a beat tapped on the river
// takes its place for a while, spreading out from the finger.
// The GPU runs these rules for thousands of fireflies (src/worlds/fireflies/shaders.js); this copy runs them on the
// CPU for the tests, which check the GPU's numbers against it.

/** Flashes a second on true time: one on each half second. */
export const BEAT = 2;
/** A firefly's pace is kept between these (flashes a second): never more than 2.67 a second, so the bank stays well
 *  under three flashes a second, and a tapped beat of 90 to 160 a minute can still be learned. */
export const SLOWEST = 1.5;
export const FASTEST = 8 / 3;
/** Each firefly's own pace, and how much they differ. */
export const NATURAL = 2;
export const SPREAD = 0.08;
/** The simulation's step, in seconds, whatever the screen's rate. */
export const STEP = 1 / 60;
/** A flash swells over RISE seconds to its peak and fades over FALL: soft enough that two screens a few hundredths of a
 *  second apart still look together. */
export const RISE = 0.07;
export const FALL = 0.15;
/** Taps closer together than this (seconds) are ignored, so a tapped beat never flashes more than 2.67 times a second. */
export const TAP_GAP = 0.375;
/** A tap's light fades over this long (seconds), from its peak at the tap. */
export const TAP_FADE = 0.15;
/** A steady beat: this many taps in a row, each gap within STEADY of their average. */
export const BEAT_TAPS = 3;
export const STEADY = 0.2;
/** After the last tap the bank keeps the tapped beat for HOLD seconds, then hands it back to true time over LET_GO. */
export const HOLD = 4;
export const LET_GO = 3;
/** How fast a tapped beat spreads out from the finger, in shares of the stage's width a second, and how soft the edge
 *  of where it has reached is. */
export const FRONT = 0.3;
export const FEATHER = 0.12;
/** True time's pull grows in over the opening, between these seconds after the river opens: until then the bank finds
 *  its own step, in knots and waves round the lanterns, before the whole of it gathers onto the beat. */
export const GATHER = [12, 37];

/**
 * The model's strengths. `couple`: how hard a flash seen hurries or holds back a firefly's clock. `learn`: how fast its
 * pace follows the flashes it sees. `forget`: seconds for its pace to settle back to its own. `drive`: true time's pull
 * on a firefly's clock (turns a second, for a firefly a quarter turn off the beat), and `keep` its pull on the pace
 * (flashes a second, a second); `follow` and `followKeep` are the same for a tapped beat, which pulls harder. `halo`:
 * how much light a firefly with no neighbours counts as seeing, so a lone one isn't jolted by a faint flash far off.
 * `sight`: how far a firefly sees, in cells of the light's picture (a gaussian's spread). `lantern`, `tap`: how bright
 * a lantern's flash and a tap are, in fireflies' worth, and `lanternReach`, `tapReach` how far their light spreads
 * before the blur (cells).
 */
export const MODEL = {
  couple: 0.3,
  learn: 0.3,
  forget: 6,
  drive: 0.012,
  keep: 0.016,
  follow: 0.4,
  followKeep: 0.12,
  halo: 0.08,
  sight: 2.2,
  lantern: 160,
  lanternReach: 3.5,
  tap: 520,
  tapReach: 7,
};

/** How many cells the light's picture has: about 12,800 on a laptop, fewer on a phone. */
export const CELLS = { wide: 12800, phone: 4608 };

const TAU = Math.PI * 2;
const fract = (/** @type {number} */ x) => x - Math.floor(x);
const clamp = (/** @type {number} */ x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smooth = (/** @type {number} */ x) => x * x * (3 - 2 * x);

/**
 * How bright a firefly is (0 to 1) at phase `theta` of its turn, at `pace` flashes a second: a swell to the peak at the
 * turn's start (phase 0), then a fade. The curve is in seconds, so a faster firefly's flash isn't shorter.
 * @param {number} theta 0 to 1 @param {number} pace
 */
export function flash(theta, pace) {
  const since = theta / pace;
  const until = (1 - theta) / pace;
  const fall = since < FALL ? 0.5 + 0.5 * Math.cos((Math.PI * since) / FALL) : 0;
  const rise = until < RISE ? 0.5 - 0.5 * Math.cos(Math.PI * (1 - until / RISE)) : 0;
  return Math.max(fall, rise);
}

/** Where the true-time beat is in its turn (0 to 1) at `ms` milliseconds of true time: 0 on every half second. @param {number} ms */
export const truePhase = (ms) => fract(ms / (1000 / BEAT));

/** How bright a tap's light is `since` seconds after the tap: at its peak at once, then fading. @param {number} since */
export const tapLight = (since) => (since >= 0 && since < TAP_FADE ? 0.5 + 0.5 * Math.cos((Math.PI * since) / TAP_FADE) : 0);

/** How hard true time pulls, `seconds` after the river opened: nothing at first, all of it once the bank has gathered. @param {number} seconds */
export const pullAt = (seconds) => smooth(clamp((seconds - GATHER[0]) / (GATHER[1] - GATHER[0])));

/**
 * Where in its turn a seen flash has no effect. A flash fades for longer than it swells, so the light a firefly sees
 * from neighbours flashing with it lies mostly just after its own peak; centring the response on that light, rather
 * than on the peak, means a bank in step neither hurries nor holds itself back.
 */
export const CENTRE = (() => {
  let s = 0;
  let c = 0;
  for (let i = 0; i < 2000; i++) {
    const theta = (i + 0.5) / 2000;
    const b = flash(theta, BEAT);
    s += b * Math.sin(TAU * theta);
    c += b * Math.cos(TAU * theta);
  }
  return Math.atan2(s, c) / TAU;
})();

/**
 * The response to a flash seen at phase `theta`: positive (hurry on) late in the turn, negative (hold back) early.
 * @param {number} theta
 */
export const respond = (theta) => -Math.sin(TAU * (theta - CENTRE));

/**
 * @typedef {{ phase: number, x: number, y: number, reach: number, weight: number }} Beat
 * A tapped beat as the bank follows it: where it is in its turn (0 at each tap), where it started (shares of the
 * stage), how far it has spread (shares of the stage's width), and how much it still counts (1, falling to 0 as it's
 * handed back to true time).
 */

/**
 * The taps: which count (none closer than TAP_GAP), the light each makes, and the beat they make when steady. Times
 * are in seconds on the simulation's clock, places in shares of the stage.
 */
export function keeper() {
  /** @type {number[][]} */
  const taps = [];
  /** @type {{ start: number, last: number, interval: number, x: number, y: number } | null} */
  let beat = null;
  /** @param {number} t @returns {Beat | null} */
  const at = (t) => {
    if (!beat) return null;
    const quiet = t - beat.last - HOLD;
    const weight = quiet <= 0 ? 1 : 1 - smooth(clamp(quiet / LET_GO));
    if (weight <= 0) {
      beat = null;
      return null;
    }
    return { phase: fract((t - beat.last) / beat.interval), x: beat.x, y: beat.y, reach: FRONT * (t - beat.start), weight };
  };
  return {
    /** A tap at `t` seconds and (x, y); false if it came too soon after the last one and doesn't count. @param {number} t @param {number} x @param {number} y */
    tap(t, x, y) {
      const last = taps[taps.length - 1];
      if (last && t - last[0] < TAP_GAP) return false;
      taps.push([t, x, y]);
      if (taps.length > BEAT_TAPS) taps.shift();
      if (taps.length < BEAT_TAPS) return true;
      const gaps = taps.slice(1).map((tap, i) => tap[0] - taps[i][0]);
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      if (mean > 1 / SLOWEST || gaps.some((g) => Math.abs(g - mean) > STEADY * mean)) return true;
      // A beat still being followed carries on from where it has spread to; otherwise it starts here.
      if (!at(t)) beat = { start: t, last: t, interval: mean, x, y };
      const following = /** @type {NonNullable<typeof beat>} */ (beat);
      following.last = t;
      following.interval = mean;
      return true;
    },
    /** The tapped beat at `t` seconds, or null when there's none (or it has been handed back). */
    at,
    /** The taps' glows at `t` seconds, as lights for the light's picture. @param {number} t */
    lights(t) {
      return taps.filter(([when]) => t >= when && t - when < TAP_FADE).map(([when, x, y]) => [x, y, MODEL.tap * tapLight(t - when), MODEL.tapReach]);
    },
  };
}

/**
 * A blur's weights, a gaussian of spread `sigma` cells, adding up to 1.
 * @param {number} sigma
 */
export function kernel(sigma) {
  const r = Math.ceil(sigma * 2.5);
  const w = new Float32Array(r * 2 + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += w[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < w.length; i++) w[i] /= sum;
  return w;
}

/**
 * The light's picture's size for a stage, `cells` cells shaped like it.
 * @param {number} width @param {number} height @param {number} cells
 */
export function gridFor(width, height, cells) {
  const w = Math.max(8, Math.round(Math.sqrt((cells * width) / height)));
  return [w, Math.max(8, Math.round(cells / w))];
}

/**
 * Natural paces for `n` fireflies, NATURAL give or take SPREAD (a bell curve), from `rand`.
 * @param {number} n @param {() => number} rand
 */
export function paces(n, rand) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const g = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(TAU * rand());
    out[i] = NATURAL + SPREAD * Math.max(-3, Math.min(3, g));
  }
  return out;
}

/**
 * A bank of fireflies at `x`, `y` (shares of the stage, 0 to 1), each with its own pace (`natural`), starting at
 * random places in their turns unless given `theta`. `grid` is the light's picture's size, shaped like the stage.
 * @param {{ x: ArrayLike<number>, y: ArrayLike<number>, natural: ArrayLike<number>, grid: number[], theta?: ArrayLike<number> }} o
 * @param {() => number} [rand]
 */
export function createBank({ x, y, natural, grid, theta }, rand = Math.random) {
  const n = x.length;
  const [gw, gh] = grid;
  const cell = new Int32Array(n);
  for (let i = 0; i < n; i++) cell[i] = Math.min(gh - 1, Math.max(0, Math.floor(y[i] * gh))) * gw + Math.min(gw - 1, Math.max(0, Math.floor(x[i] * gw)));
  return {
    n,
    x: Float64Array.from(x),
    y: Float64Array.from(y),
    natural: Float64Array.from(natural),
    theta: theta ? Float64Array.from(theta) : Float64Array.from({ length: n }, () => rand()),
    pace: Float64Array.from(natural),
    /** Seconds since each firefly's last flash. */
    since: new Float64Array(n).fill(1),
    /** Turns completed so far, for measuring each firefly's real pace. */
    turns: new Float64Array(n),
    cell,
    grid: [gw, gh],
    weights: kernel(MODEL.sight),
    light: new Float64Array(gw * gh),
    count: new Float64Array(gw * gh),
    scratch: new Float64Array(gw * gh),
    counted: false,
  };
}

/** @typedef {ReturnType<typeof createBank>} Bank */

/** Blurs `field` in place, across then down, with nothing beyond the edges. Only the rows the light can reach are
 *  worked on: the sky and the water hold none, and skipping them keeps the tests quick. @param {Bank} bank
 *  @param {Float64Array} field */
function blur(bank, field) {
  const [gw, gh] = bank.grid;
  const w = bank.weights;
  const r = (w.length - 1) / 2;
  const tmp = bank.scratch;
  let first = gh;
  let last = -1;
  for (let y = 0; y < gh; y++) {
    for (let x = y * gw; x < (y + 1) * gw; x++) {
      if (field[x] === 0) continue;
      first = Math.min(first, y);
      last = y;
      break;
    }
  }
  if (last < 0) return;
  for (let y = first; y <= last; y++) {
    const row = y * gw;
    for (let x = 0; x < gw; x++) {
      let s = 0;
      const lo = Math.max(-r, -x);
      const hi = Math.min(r, gw - 1 - x);
      for (let k = lo; k <= hi; k++) s += field[row + x + k] * w[k + r];
      tmp[row + x] = s;
    }
  }
  for (let y = Math.max(0, first - r); y <= Math.min(gh - 1, last + r); y++) {
    const lo = Math.max(-r, first - y);
    const hi = Math.min(r, last - y);
    for (let x = 0; x < gw; x++) {
      let s = 0;
      for (let k = lo; k <= hi; k++) s += tmp[(y + k) * gw + x] * w[k + r];
      field[y * gw + x] = s;
    }
  }
}

/** Adds a light's glow to the picture: `power` fireflies' worth, spread as a gaussian of `reach` cells round (x, y). @param {Bank} bank @param {number[]} light [x, y, power, reach] */
function shine(bank, [lx, ly, power, reach]) {
  if (!power) return;
  const [gw, gh] = bank.grid;
  const cx = lx * gw - 0.5;
  const cy = ly * gh - 0.5;
  const r = Math.ceil(reach * 2.5);
  const norm = power / (TAU * reach * reach);
  for (let y = Math.max(0, Math.round(cy) - r); y <= Math.min(gh - 1, Math.round(cy) + r); y++) {
    for (let x = Math.max(0, Math.round(cx) - r); x <= Math.min(gw - 1, Math.round(cx) + r); x++) {
      bank.light[y * gw + x] += norm * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * reach * reach));
    }
  }
}

/**
 * One step of `h` seconds. `phase` is the true-time beat's phase at the step's start and `pull` how hard it pulls (0 to
 * 1, see pullAt); `lights` are the lanterns' and taps' glows for this step, each [x, y, power, reach]; `beat` is a
 * tapped beat being followed, if any. Each firefly's flash is drawn into the light's picture, the picture is blurred,
 * then each firefly reads what it sees there, less its own light, and its clock and pace move on.
 * @param {Bank} bank @param {{ phase: number, pull?: number, lights?: number[][], beat?: Beat | null }} o @param {number} [h]
 */
export function stepBank(bank, { phase, pull = 1, lights = [], beat = null }, h = STEP) {
  const { n, theta, pace, natural, cell, light, count, turns, since, x, y } = bank;
  const [gw, gh] = bank.grid;
  const tall = gh / gw;
  const w0 = bank.weights[(bank.weights.length - 1) / 2];
  const own = w0 * w0;
  light.fill(0);
  const b = new Float64Array(n);
  for (let i = 0; i < n; i++) light[cell[i]] += b[i] = flash(theta[i], pace[i]);
  for (const l of lights) shine(bank, l);
  blur(bank, light);
  // How many fireflies each cell sees doesn't change while they're all awake: worked out once.
  if (!bank.counted) {
    count.fill(0);
    for (let i = 0; i < n; i++) count[cell[i]] += 1;
    blur(bank, count);
    bank.counted = true;
  }
  for (let i = 0; i < n; i++) {
    const c = cell[i];
    const seen = Math.max(0, light[c] - b[i] * own) / (Math.max(0, count[c] - own) + MODEL.halo);
    const z = respond(theta[i]);
    // How far behind the beat it follows this firefly is (positive when behind): true time's, or a tapped beat's
    // where that has spread to.
    const reached = beat ? beat.weight * smooth(clamp((beat.reach - Math.hypot(x[i] - beat.x, (y[i] - beat.y) * tall)) / FEATHER)) : 0;
    const behindTrue = Math.sin(TAU * (phase - theta[i]));
    const behindTapped = beat ? Math.sin(TAU * (beat.phase - theta[i])) : 0;
    const drive = (1 - reached) * pull * MODEL.drive * behindTrue + reached * MODEL.follow * behindTapped;
    const keep = (1 - reached) * pull * MODEL.keep * behindTrue + reached * MODEL.followKeep * behindTapped;
    // The flash seen stretches or shrinks the time the firefly spends at this point of its turn, rather than adding to
    // its speed: a firefly held back would otherwise linger in the part of its turn that holds it back, and a bank in
    // step would drag itself slow.
    const speed = Math.max(0, pace[i] / Math.max(0.35, 1 - MODEL.couple * seen * z) + drive);
    let next = theta[i] + h * speed;
    since[i] += h;
    if (next >= 1) {
      // Never two flashes closer than 1 / FASTEST seconds: it waits at the brink instead.
      if (since[i] < 1 / FASTEST) next = 0.99999;
      else {
        next -= 1;
        since[i] = 0;
        turns[i] += 1;
      }
    }
    theta[i] = next;
    // The pace follows the flashes seen (per turn rather than per second, for the same reason) and drifts back to its
    // own; the beat pulls on it too, which takes up whatever small bias the rest leaves, so the bank settles on the
    // beat itself rather than a little to one side of it.
    const learn = (MODEL.learn * seen * z * speed) / pace[i];
    pace[i] = clamp(pace[i] + h * ((natural[i] - pace[i]) / MODEL.forget + learn + keep), SLOWEST, FASTEST);
  }
}

/** The bank's average phase (0 to 1), averaged round the circle. @param {{ n: number, theta: ArrayLike<number> }} bank */
export function meanPhase(bank) {
  let s = 0;
  let c = 0;
  for (let i = 0; i < bank.n; i++) {
    s += Math.sin(TAU * bank.theta[i]);
    c += Math.cos(TAU * bank.theta[i]);
  }
  return fract(Math.atan2(s, c) / TAU);
}

/**
 * The share of fireflies flashing within `ms` milliseconds of the bank's average flash.
 * @param {{ n: number, theta: ArrayLike<number>, pace: ArrayLike<number> }} bank @param {number} [ms]
 */
export function inStep(bank, ms = 60) {
  const mean = meanPhase(bank);
  let near = 0;
  for (let i = 0; i < bank.n; i++) {
    const off = fract(bank.theta[i] - mean + 0.5) - 0.5;
    if (Math.abs(off / bank.pace[i]) * 1000 <= ms) near++;
  }
  return near / bank.n;
}

/**
 * How far the bank's average flash is from the true-time beat's, in milliseconds (positive when the bank is late).
 * @param {{ n: number, theta: ArrayLike<number> }} bank @param {number} phase the true-time beat's phase now
 */
export function lagOf(bank, phase) {
  return -(fract(meanPhase(bank) - phase + 0.5) - 0.5) * (1000 / BEAT);
}
