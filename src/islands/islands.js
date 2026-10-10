// Jack's Writing Islands (/lab/writing-islands/), on the effects' stage (src/effects/stage.js) with WebGL2: Jack's
// posts rising out of the sea as islands, one for each topic and one ridge for each post, each built from the post's own
// parts (src/lib/islands.js works out the land from the posts while the site is built), then weathered by years of
// rain (erosion.js) and drawn (terrain.js). A date runs from the first post to the day the site was built: each post's
// ridge rises on its day and weathers for as long as it has been there. Then the forests spread as far as each post's
// visits reach, a mist settles on the old island, and the islands rest in a slow swell with their topics' names over
// them; a tap on a ridge, or a post focused in the list under the card, shows that post.
// The weather runs a fixed number of steps a second whatever the screen's rate, at most a few a frame: a slow device
// takes longer over the years (its date shows it) rather than stuttering. With less motion asked for, the whole
// replay is worked out unseen, a few hundred steps a frame, and the finished islands are shown still.
import { caps, governor, stepper, tokens } from '../effects/gl.js';
import { formatDate } from '../lib/dates.js';
import { stampMaps } from '../lib/islands.js';
import { createWeather, STORMS, stormAt } from './erosion.js';
import { createTerrain, LIFT } from './terrain.js';

export const options = { context: 'webgl2', antialias: true, depth: true };

/** Weather steps a simulated day, and the most in a replay however long the site has been going. */
const PER_DAY = 3;
const MOST_STEPS = 6000;
/** Steps a second, whatever the screen's rate: about thirty seconds from the first post to today. */
const RATE = 138;
/** Seconds of calm sea before the first island rises; steps after the last day, the rain over, while the land drains. */
const CALM = 1;
const DRAIN = 540;
/** Seconds the forests take to spread and the mist to settle, once the rain has stopped. */
const GREEN = 4;
/** The most steps worked out in one go while catching up unseen (less motion, or a context given back): small enough
 *  that no piece of the GPU's work is long enough for its driver to give up on it, and that the page never waits long
 *  for the GPU to take it. */
const CHUNK = 200;
/** Seconds without a touch before the camera eases back, and before the resting islands stop being drawn at all. */
const EASE_BACK = 8;
const IDLE = 60;
/** The camera: its usual angle (degrees; a tall card looks down more steeply, so the islands fill its height), how far
 *  it may be turned and tilted, and its field of view. */
const VIEW = { yaw: -18, pitch: 21, tallPitch: 40, yawRange: 40, pitchMin: 20, pitchMax: 55, fov: 44 };
/** Seconds a theme takes to fade into the next. */
const FADE = 2;
/** The quality ladder, best first: steps a frame, the canvas's scale, and how often the land's light is baked. */
const RUNGS = [
  { most: 3, scale: 1, bakeEvery: 2 },
  { most: 2, scale: 1, bakeEvery: 2 },
  { most: 1, scale: 1, bakeEvery: 2 },
  { most: 1, scale: 0.85, bakeEvery: 2 },
  { most: 1, scale: 0.7, bakeEvery: 2 },
  { most: 1, scale: 0.7, bakeEvery: 4 },
];
/** The --isle-* tokens the look is made of. */
const NAMES = ['sky-top', 'sky', 'light', 'sea', 'deep', 'shallow', 'sand', 'forest', 'rock', 'mist', 'foam', 'drop', 'star', 'aurora-1', 'aurora-2', 'aurora-3', 'aurora-4', 'aurora-5'];
/** Where the sun shines from by day (low, from the left and a little behind), and the moon by night (low, behind and
 *  to the right, so its path of light runs over the sea towards us). */
const SUN = norm([-0.82, 0.4, -0.42]);
const MOON = norm([0.5, 0.3, -0.81]);

/** @param {number[]} v */
function norm(v) {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l);
}
const clamp = (/** @type {number} */ x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smooth = (/** @type {number} */ x) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
const lerp = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ t) => a + (b - a) * t;
const mixed = (/** @type {number[]} */ a, /** @type {number[]} */ b, /** @type {number} */ t) => a.map((v, i) => v + (b[i] - v) * t);

// ---- A little matrix work for the camera: column-major 4×4, as WebGL takes them.

/** @param {number} fovY radians @param {number} aspect @param {number} near @param {number} far @param {number} shift moves the picture down, as a share of its height */
function perspective(fovY, aspect, near, far, shift) {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[9] = shift;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}
/** @param {number[]} eye @param {number[]} at */
function lookAt(eye, at) {
  const z = norm([eye[0] - at[0], eye[1] - at[1], eye[2] - at[2]]);
  const x = norm([z[2], 0, -z[0]]);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const m = new Float32Array(16);
  m.set([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0]);
  m[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
  m[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
  m[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
  m[15] = 1;
  return m;
}
/** @param {Float32Array} a @param {Float32Array} b */
function multiply(a, b) {
  const m = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    m[c * 4 + r] = s;
  }
  return m;
}
/** @param {Float32Array} m */
function invert(m) {
  const inv = new Float32Array(16);
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  inv.set([
    (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det, (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det, (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det, (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det, (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ]);
  return inv;
}
/** A point through a matrix, to the screen's -1..1 (and its depth's w). @param {Float32Array} m @param {number[]} p */
function project(m, p) {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [x / w, y / w, w];
}

/**
 * @param {import('../effects/stage.js').Stage} stage
 * @param {import('../lib/islands.js').Islands} data what islands-file.js worked out while the site was built
 * @param {HTMLElement} root the card: its date, island names and post chips are laid over the canvas
 */
export function createIslands(stage, data, root) {
  const { gl } = stage;
  const N = data.grid;
  /** @type {Record<string, { wide: string, tall: string }>} */
  const stills = JSON.parse(root.dataset.stills ?? '{}');
  const theme = () => (document.documentElement.dataset.sky === 'night' ? 'night' : document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  // A photo of the finished islands, in the theme's colours and the card's shape: where the islands can't be grown
  // here (no WebGL2, no float textures to grow them in), with the legend and the posts still under the card; and, with
  // less motion asked for, while the islands are worked out unseen.
  let photo = false;
  let showing = false;
  const showPhoto = () => {
    showing = true;
    const pick = stills[theme()];
    stage.showStill(pick ? pick[stage.width >= stage.height ? 'wide' : 'tall'] : null, root.querySelector('canvas')?.getAttribute('aria-label') ?? '');
  };
  const hidePhoto = () => {
    if (!showing) return;
    showing = false;
    stage.showStill(null);
  };
  const swap = new MutationObserver(() => { if (showing) showPhoto(); });
  swap.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-sky'] });
  const able = gl && caps(gl);
  let weather = gl && able?.float32 && able.float16 ? createWeather(gl, N) : null;
  if (!gl || !weather?.ok) {
    photo = true;
    // Nothing plays here: no date running, nothing to restart or pause (the card's CSS hides them).
    root.dataset.photo = '';
    showPhoto();
    return { frame: () => {}, resize: showPhoto, stop: () => swap.disconnect(), restart: () => {}, focus: () => {} };
  }
  if (stage.still) showPhoto();

  const steps = Math.min(MOST_STEPS, Math.round(data.days * PER_DAY));
  const perDay = steps / data.days;
  const end = steps + DRAIN;
  const when = /** @type {HTMLElement | null} */ (root.querySelector('[data-when]'));
  const names = /** @type {HTMLElement[]} */ ([...root.querySelectorAll('[data-name]')]);
  const chips = /** @type {HTMLElement[]} */ ([...root.querySelectorAll('[data-chip]')]);
  const startDay = Date.parse(`${data.from}T12:00:00+08:00`);
  const dateAt = (/** @type {number} */ k) => formatDate(new Date(startDay + Math.min(data.days, k / perDay) * 86400000));
  const legacy = data.islands.findIndex((i) => i.legacy);
  // With less motion asked for, the islands shown are the finished ones, of today, from the first (draw keeps it so).
  if (stage.still && when) when.textContent = dateAt(end);

  let terrain = createTerrain(gl, N);
  /** @type {{ lift: Float32Array, ground: Uint8Array, hollow: Float32Array, seaFloor: number } | null} */
  let maps = null;
  let building = stampMaps(data);
  /** Where the replay is: 'build' (the maps being worked out), 'calm', 'replay' (the years, then the drain), 'rest'. */
  let phase = 'build';
  let k = 0;
  let calm = CALM;
  /** Seconds since the rain stopped: the forests and the mist follow it. */
  let after = 0;
  let frames = 0;
  let needBake = true;
  /** Once the still islands (less motion asked for) have been replayed, by Restart or Play, they play as any do. */
  let replaying = false;
  /** The heights, read back from the GPU once the land rests (and when tapped before then), for taps and labels. */
  /** @type {Float32Array | null} */
  let heights = null;
  let heightsAt = -1;
  let rung = 0;
  let runFor = stepper(RATE, RUNGS[0].most);
  const ladder = governor(RUNGS.length, (r) => {
    rung = r;
    runFor = stepper(RATE, RUNGS[r].most);
  });

  // ---- The look: the theme's --isle-* tokens, mixed across a fade when the theme changes while playing.
  /** @type {Record<string, number[]>} */
  let palette = {};
  /** @type {{ from: Record<string, number[]>, night: number, aurora: number, start: number } | null} */
  let fading = null;
  let seen = stage.colors;
  let night = theme() === 'light' ? 0 : 1;
  let aurora = theme() === 'night' ? 1 : 0;
  const readPalette = () => {
    palette = tokens(root, 'isle', NAMES);
    const lanes = tokens(root, 'lane', data.islands.map((i) => i.topic));
    palette.tints = data.islands.flatMap((i) => mixed(palette.rock, lanes[i.topic], 0.26));
  };
  readPalette();
  let time = 0;
  let clock = 0;

  // ---- The camera: its angle eased towards where it's dragged, back to its usual one when left alone, and over to a
  // post when one is chosen.
  // The land's outline, for framing it: each ridge's ends and middle, out as far as its coast.
  const land = data.ridges.flatMap((r) => [0, 2, 4].flatMap((i) => [[r.curve[i] - r.width - 0.03, r.curve[i + 1]], [r.curve[i] + r.width + 0.03, r.curve[i + 1]], [r.curve[i], r.curve[i + 1] - r.width - 0.03], [r.curve[i], r.curve[i + 1] + r.width + 0.03]]));
  const middle = [(Math.min(...land.map((p) => p[0])) + Math.max(...land.map((p) => p[0]))) / 2, (Math.min(...land.map((p) => p[1])) + Math.max(...land.map((p) => p[1]))) / 2];
  const outline = land.map(([x, z]) => [x, 0, z]);
  const usualPitch = () => lerp(VIEW.tallPitch, VIEW.pitch, clamp((stage.width / Math.max(1, stage.height) - 0.8) / 0.6));
  const cam = { yaw: VIEW.yaw, pitch: usualPitch(), goalYaw: VIEW.yaw, goalPitch: usualPitch(), focus: 0, goalFocus: 0, at: [middle[0], 0.01, middle[1]], goalAt: [middle[0], 0.01, middle[1]] };
  let touchedAt = -Infinity;
  let fit = 1;
  let fitFor = '';
  /** @type {Float32Array} */
  let viewProj = new Float32Array(16);
  /** @type {Float32Array} */
  let unproject = new Float32Array(16);
  let eye = [0, 0, 0];
  const placeCamera = () => {
    const aspect = stage.width / Math.max(1, stage.height);
    // A tall card sees more up and down, a wide one more across.
    const fovY = aspect >= 1 ? (VIEW.fov * Math.PI) / 180 : 2 * Math.atan((Math.tan((VIEW.fov * Math.PI) / 360) / aspect) * 0.8);
    const f = 1 / Math.tan(fovY / 2);
    const pitch = (cam.pitch * Math.PI) / 180;
    const yaw = (cam.yaw * Math.PI) / 180;
    const close = smooth(cam.focus);
    // The picture moves down, as a camera's lens can, to keep the horizon just inside its top with the sky over it; a
    // tall card keeps the islands in its middle instead, and only the far sea shows above them.
    const shift = lerp(clamp(f * Math.tan(pitch) - 0.9, 0, lerp(0.08, 0.34, clamp((aspect - 0.8) / 0.6))), 0.06, close);
    const proj = perspective(fovY, aspect, 0.02, 60, shift);
    const at = cam.at;
    const place = (/** @type {number} */ distance) => {
      eye = [at[0] + Math.sin(yaw) * Math.cos(pitch) * distance, at[1] + Math.sin(pitch) * distance, at[2] + Math.cos(yaw) * Math.cos(pitch) * distance];
      viewProj = multiply(proj, lookAt(eye, at));
    };
    // As close as the whole outline still fits, found by halving: the land fills the card at any angle and shape.
    if (fitFor !== `${aspect.toFixed(3)} ${cam.yaw.toFixed(2)} ${cam.pitch.toFixed(2)}`) {
      fitFor = `${aspect.toFixed(3)} ${cam.yaw.toFixed(2)} ${cam.pitch.toFixed(2)}`;
      let lo = 0.2;
      let hi = 6;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        eye = [middle[0] + Math.sin(yaw) * Math.cos(pitch) * mid, 0.01 + Math.sin(pitch) * mid, middle[1] + Math.cos(yaw) * Math.cos(pitch) * mid];
        const m = multiply(proj, lookAt(eye, [middle[0], 0.01, middle[1]]));
        const fits = outline.every((p) => {
          const [x, y, w] = project(m, p);
          return w > 0 && Math.abs(x) < 0.93 && y > -0.94;
        });
        if (fits) hi = mid;
        else lo = mid;
      }
      fit = hi;
    }
    place(lerp(fit, fit * 0.42, close));
    unproject = invert(viewProj);
  };
  // ---- Picking: on the land's heights, read back from the GPU.
  const readHeights = () => {
    if (heightsAt === k && heights) return heights;
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, weather.state, 0);
    const px = new Float32Array(N * N * 4);
    gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    heights = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) heights[i] = Math.max(0, px[i * 4] + (px[i * 4] > 0 && px[i * 4 + 1] > 0.0004 ? px[i * 4 + 1] : 0)) * LIFT;
    heightsAt = k;
    return heights;
  };
  /** The cell under a point of the canvas (CSS pixels), or -1 for the sea and the sky. @param {number} x @param {number} y */
  const cellAt = (x, y) => {
    const h = readHeights();
    const ndc = [(x / stage.width) * 2 - 1, 1 - (y / stage.height) * 2];
    const toward = (/** @type {number} */ z) => {
      const m = unproject;
      const v = [m[0] * ndc[0] + m[4] * ndc[1] + m[8] * z + m[12], m[1] * ndc[0] + m[5] * ndc[1] + m[9] * z + m[13], m[2] * ndc[0] + m[6] * ndc[1] + m[10] * z + m[14], m[3] * ndc[0] + m[7] * ndc[1] + m[11] * z + m[15]];
      return [v[0] / v[3], v[1] / v[3], v[2] / v[3]];
    };
    const a = toward(-1);
    const b = toward(1);
    const dir = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    // March from the eye in steps of half a cell, until the ray is under the land or the sea.
    let t = 0;
    const stepLen = 0.5 / N;
    for (let i = 0; i < 20000; i++) {
      const p = [eye[0] + dir[0] * t, eye[1] + dir[1] * t, eye[2] + dir[2] * t];
      if (p[1] < 0) return -1;
      const ci = Math.floor(p[0] * N);
      const cj = Math.floor(p[2] * N);
      if (ci >= 0 && cj >= 0 && ci < N && cj < N && p[1] <= h[cj * N + ci]) return cj * N + ci;
      t += stepLen;
      if (t > 8) break;
    }
    return -1;
  };

  // ---- The chips: a post's title and size, at its summit; the islands' names over their tops, once they rest.
  let chosen = -1;
  /** Where each post's summit and each island's top are, from the heights. */
  /** @type {number[][]} */
  let summits = [];
  /** @type {number[][]} */
  let tops = [];
  const findTops = () => {
    const h = readHeights();
    summits = data.ridges.map(() => [0, -1, 0]);
    // An island's name goes over its middle, as high as its top: over its highest point it could look to name the
    // island behind.
    const sums = data.islands.map(() => [0, 0, 0, -1]);
    if (!maps) return;
    for (let c = 0; c < N * N; c++) {
      const post = maps.ground[c * 4 + 1] - 1;
      const isle = maps.ground[c * 4 + 3] - 1;
      const x = ((c % N) + 0.5) / N;
      const z = (Math.floor(c / N) + 0.5) / N;
      if (post >= 0 && h[c] > summits[post][1]) summits[post] = [x, h[c], z];
      if (isle >= 0 && h[c] > 0.004) {
        const sum = sums[isle];
        sum[0] += x;
        sum[1] += z;
        sum[2]++;
        sum[3] = Math.max(sum[3], h[c]);
      }
    }
    tops = sums.map(([x, z, n, top]) => (n ? [x / n, top, z / n] : [0, -1, 0]));
  };
  const placeLabels = () => {
    const show = phase === 'rest' && !photo;
    // Each name over its island's top; one that would overlap a name nearer the front moves up clear of it.
    const placed = [];
    const order = names.map((_, i) => i).sort((a, b) => (tops[b]?.[2] ?? 0) - (tops[a]?.[2] ?? 0));
    for (const i of order) {
      const el = names[i];
      const top = tops[i];
      if (!show || !top || top[1] < 0) {
        el.hidden = true;
        continue;
      }
      const [x, y, w] = project(viewProj, [top[0], top[1] + 0.012, top[2]]);
      el.hidden = w <= 0 || chosen >= 0;
      const width = el.offsetWidth || 60;
      const height = el.offsetHeight || 24;
      const left = ((x + 1) / 2) * stage.width - width / 2;
      let bottom = ((1 - y) / 2) * stage.height;
      for (const other of placed) {
        if (left < other.left + other.width + 4 && left + width + 4 > other.left && bottom > other.bottom - other.height - 4 && bottom - height - 4 < other.bottom) bottom = other.bottom - other.height - 4;
      }
      placed.push({ left, bottom, width, height });
      el.style.transform = `translate(${left}px, ${bottom - height}px)`;
    }
    chips.forEach((el, i) => {
      if (i !== chosen || !summits[i]) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      const s = summits[i];
      const [x, y] = project(viewProj, [s[0], s[1] + 0.012, s[2]]);
      const px = clamp(((x + 1) / 2) * stage.width, el.offsetWidth / 2 + 8, stage.width - el.offsetWidth / 2 - 8);
      const py = clamp(((1 - y) / 2) * stage.height, el.offsetHeight + 12, stage.height - 8);
      el.style.transform = `translate(${px}px, ${py}px) translate(-50%, -100%)`;
    });
  };
  /** Shows a post (its chip, the camera gliding over), or none with -1. @param {number} index */
  const choose = (index) => {
    chosen = index;
    touchedAt = clock;
    if (index >= 0) {
      if (!summits.length || heightsAt !== k) findTops();
      const s = summits[index];
      if (s && s[1] >= 0) {
        cam.goalAt = [s[0], s[1] * 0.6, s[2]];
        cam.goalFocus = 1;
      }
    } else {
      cam.goalAt = [middle[0], 0.01, middle[1]];
      cam.goalFocus = 0;
    }
    if (stage.still) {
      cam.at = [...cam.goalAt];
      cam.focus = cam.goalFocus;
    }
    wake();
  };

  // ---- Dragging turns the camera; a tap that hardly moved picks what's under it.
  const canvas = /** @type {HTMLCanvasElement} */ (root.querySelector('canvas'));
  /** @type {{ x: number, y: number, yaw: number, pitch: number, moved: number, touch: boolean } | null} */
  let drag = null;
  /** @param {PointerEvent} e */
  const down = (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: cam.goalYaw, pitch: cam.goalPitch, moved: 0, touch: e.pointerType === 'touch' };
    touchedAt = clock;
    wake();
  };
  /** @param {PointerEvent} e */
  const move = (e) => {
    wake();
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    // A finger turns the islands only sideways; up and down it scrolls the page (the canvas's touch-action).
    cam.goalYaw = clamp(drag.yaw - (dx / stage.width) * 120, VIEW.yaw - VIEW.yawRange, VIEW.yaw + VIEW.yawRange);
    if (!drag.touch) cam.goalPitch = clamp(drag.pitch + (dy / stage.height) * 70, VIEW.pitchMin, VIEW.pitchMax);
    touchedAt = clock;
  };
  /** @param {PointerEvent} e */
  const up = (e) => {
    const was = drag;
    drag = null;
    if (!was || was.moved > 6) return;
    const box = canvas.getBoundingClientRect();
    const cell = cellAt(e.clientX - box.left, e.clientY - box.top);
    const post = cell >= 0 && maps ? maps.ground[cell * 4 + 1] - 1 : -1;
    choose(post);
  };
  const cancel = () => { drag = null; };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('pointerleave', cancel);

  // ---- Waking and resting: at rest the islands are drawn only while something moves (the swell, the camera), at a
  // gentle rate, and not at all once nobody has touched them for a minute.
  let lastDraw = -Infinity;
  const wake = () => {
    touchedAt = clock;
    if (!stage.playing) stage.redraw();
  };

  const look = () => {
    let blend = 1;
    if (fading) {
      blend = smooth((clock - fading.start) / FADE);
      if (blend >= 1) fading = null;
    }
    const p = fading ? Object.fromEntries(Object.keys(palette).map((n) => [n, mixed(fading.from[n], palette[n], blend)])) : palette;
    const toNight = theme() === 'light' ? 0 : 1;
    const toAurora = theme() === 'night' ? 1 : 0;
    night = fading ? lerp(fading.night, toNight, blend) : toNight;
    aurora = fading ? lerp(fading.aurora, toAurora, blend) : toAurora;
    const lightDir = norm(mixed(SUN, MOON, night));
    const strength = lerp(3.1, 1.7, night);
    const isle = legacy >= 0 ? data.islands[legacy] : null;
    const reach = isle ? Math.max(0.12, ...data.ridges.filter((r) => r.island === legacy).map((r) => Math.hypot(r.curve[4] - isle.x, r.curve[5] - isle.z) + r.width)) : 0;
    const grown = phase === 'rest' ? 1 : phase === 'replay' && k >= steps ? smooth(after / GREEN) : 0;
    const rain = phase === 'replay' && k < steps ? 1 : phase === 'replay' ? clamp(1 - after / 1.5) : 0;
    return {
      skyTop: p['sky-top'], skyLow: p.sky, light: p.light.map((v) => v * strength), lightDir, night, aurora,
      auroraColours: [1, 2, 3, 4, 5].flatMap((i) => p[`aurora-${i}`].map((v) => v * aurora)), star: p.star,
      time, eye, sea: p.sea, deep: p.deep, shallow: p.shallow, sand: p.sand, forest: p.forest, rock: p.rock, mist: p.mist, foam: p.foam, drop: p.drop,
      mistAt: isle ? [isle.x, isle.z, reach] : [0, 0, 0], misty: grown,
      storms: STORMS.flatMap((s) => stormAt(s, k)), rain, cloudy: (1 - night) * (phase === 'rest' ? 1 : grown),
      skyLowSrgb: p.sky.map((v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)),
      tints: p.tints, green: Float32Array.from({ length: 64 }, (_, i) => { const g = data.ridges[i]?.green ?? 0; return g < 0 ? 0.4 : g; }),
      grown, swell: phase === 'rest' || phase === 'replay' ? 1 : 0.35,
    };
  };

  /** Works out more of the maps the land rises from, for up to 8 ms, and starts the replay once they're done. */
  const buildSome = () => {
    const until = performance.now() + 8;
    while (performance.now() < until) {
      const next = building.next();
      if (next.done) {
        maps = next.value;
        begin();
        return;
      }
    }
  };
  /** Runs the weather's step `k` and moves on. */
  const stepOnce = () => {
    weather.step(k, k < steps ? 1 : 0);
    k++;
  };
  /** Plays it all again from the empty sea, whatever was being worked out unseen. */
  const replay = () => {
    replaying = true;
    cancelAnimationFrame(own);
    own = 0;
    for (const f of fences) gl.deleteSync(f);
    fences = [];
    hidePhoto();
    begin();
  };
  /** Starts the replay from the empty sea. */
  const begin = () => {
    if (!maps) return;
    weather.load(maps, perDay, data.islands.map((i) => i.rise));
    k = 0;
    calm = CALM;
    after = 0;
    phase = 'calm';
    needBake = true;
    heights = null;
    heightsAt = -1;
    summits = [];
    tops = [];
    chosen = -1;
    cam.goalAt = [middle[0], 0.01, middle[1]];
    cam.goalFocus = 0;
  };
  const toRest = () => {
    phase = 'rest';
    after = GREEN;
    needBake = true;
    findTops();
  };

  /** Draws the frame as things are. */
  const draw = () => {
    stage.setScale(RUNGS[rung].scale * (stage.width * stage.height > 1600 * 900 ? 0.85 : 1));
    placeCamera();
    const l = look();
    if (needBake && maps && terrain.ready()) {
      terrain.bake(weather.state, l.lightDir);
      needBake = false;
    }
    terrain.draw({ viewProj, unproject, state: weather.state, ground: weather.ground, walled: weather.hollow, stride: 1, look: l, land: Boolean(maps) && phase !== 'build' });
    if (when) when.textContent = dateAt(stage.still && !replaying ? end : phase === 'calm' || phase === 'build' ? 0 : k);
    placeLabels();
  };

  // ---- The frame.
  /** @param {number} dt */
  const frame = (dt) => {
    clock += dt;
    if (photo) return;
    // The theme changed: a playing piece fades across to it, a still one shows it at once.
    if (stage.colors !== seen) {
      seen = stage.colors;
      const was = palette;
      const wasNight = night;
      const wasAurora = aurora;
      readPalette();
      fading = stage.playing && dt >= 0 ? { from: was, night: wasNight, aurora: wasAurora, start: clock } : null;
      needBake = true;
      touchedAt = clock;
    }
    // With less motion asked for, the still islands stay until Restart or Play: the first moving frame replays them,
    // even before they're worked out.
    if (stage.still && dt > 0 && !replaying) replay();
    if (phase === 'build') buildSome();
    else if (phase === 'calm') {
      if (weather.ready() && terrain.ready()) calm -= dt;
      if (calm <= 0) phase = 'replay';
    } else if (phase === 'replay' && weather.ready()) {
      const n = Math.min(runFor(dt), end - k);
      for (let i = 0; i < n; i++) stepOnce();
      if (k >= steps) after += dt;
      if (n > 0 && ++frames % RUNGS[rung].bakeEvery === 0) needBake = true;
      if (k >= end && after >= GREEN) toRest();
    }
    if (fading) needBake = true;
    time += phase === 'rest' && stage.still ? 0 : dt;
    // The camera eases towards its goal, and back to its usual angle when left alone.
    if (clock - touchedAt > EASE_BACK && !drag) {
      cam.goalYaw = VIEW.yaw;
      cam.goalPitch = usualPitch();
    }
    const ease = stage.still ? 1 : 1 - Math.exp(-dt * 3);
    cam.yaw = lerp(cam.yaw, cam.goalYaw, ease);
    cam.pitch = lerp(cam.pitch, cam.goalPitch, ease);
    cam.focus = lerp(cam.focus, cam.goalFocus, stage.still ? 1 : 1 - Math.exp(-dt * 2.2));
    cam.at = mixed(cam.at, cam.goalAt, stage.still ? 1 : 1 - Math.exp(-dt * 2.2));
    // At rest: drawn at a gentle rate while anything moves, and not at all after a minute untouched.
    const resting = phase === 'rest';
    ladder.hold(resting);
    if (resting && dt > 0) {
      if (clock - touchedAt > IDLE) return;
      if (clock - lastDraw < 0.033 && !fading) return;
    }
    lastDraw = clock;
    draw();
    if (dt > 0) ladder.tick(performance.now());
  };

  // ---- With less motion asked for: the whole replay worked out unseen, a few hundred steps a frame, then shown still.
  let own = 0;
  /** The unseen chunks still on the GPU, each fenced: the next goes only once the last is done. Nothing unseen is drawn,
   *  so nothing else would hold the page back, and it would pile up seconds of work that the end then waits for (with
   *  two in flight the browser makes the page itself wait while it queues the third). */
  /** @type {WebGLSync[]} */
  let fences = [];
  const caughtUp = () => {
    fences = fences.filter((f) => {
      if (gl.getSyncParameter(f, gl.SYNC_STATUS) !== gl.SIGNALED) return true;
      gl.deleteSync(f);
      return false;
    });
    return fences.length === 0;
  };
  /** Runs up to CHUNK steps, as far as `until`, and fences them. @param {number} until */
  const chunk = (until) => {
    for (let i = 0; i < CHUNK && k < until; i++) stepOnce();
    fences.push(/** @type {WebGLSync} */ (gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)));
    gl.flush();
  };
  const warm = () => {
    own = 0;
    if (document.hidden) {
      own = requestAnimationFrame(warm);
      return;
    }
    if (phase === 'build') {
      buildSome();
      own = requestAnimationFrame(warm);
      return;
    }
    if (!weather.ready() || !terrain.ready() || !caughtUp()) {
      own = requestAnimationFrame(warm);
      return;
    }
    phase = 'replay';
    if (k < end) {
      chunk(end);
      own = requestAnimationFrame(warm);
      return;
    }
    toRest();
    stage.redraw();
    hidePhoto();
  };
  if (stage.still) own = requestAnimationFrame(warm);

  return {
    frame,
    resize: () => {
      touchedAt = clock;
      if (showing) showPhoto();
    },
    restart: () => {
      replay();
      wake();
    },
    /** Shows a post, from the list under the card. @param {number} index */
    focus: (index) => choose(index),
    stop: () => {
      cancelAnimationFrame(own);
      swap.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('pointerleave', cancel);
    },
    restore: () => {
      // Every GL thing went with the context, its extensions too (float targets need theirs asked for again): made
      // again, and the weather caught up unseen to where it was.
      const reached = k;
      const was = phase;
      caps(gl);
      weather = createWeather(gl, N);
      terrain = createTerrain(gl, N);
      if (!maps) return;
      weather.load(maps, perDay, data.islands.map((i) => i.rise));
      k = 0;
      heights = null;
      heightsAt = -1;
      fences = [];
      const catchUp = () => {
        if (document.hidden || !weather.ready() || !terrain.ready() || !caughtUp()) {
          own = requestAnimationFrame(catchUp);
          return;
        }
        if (k < reached) {
          chunk(reached);
          own = requestAnimationFrame(catchUp);
          return;
        }
        phase = was;
        needBake = true;
        if (was === 'rest') findTops();
        stage.redraw();
      };
      phase = 'catching';
      own = requestAnimationFrame(catchUp);
    },
  };
}
