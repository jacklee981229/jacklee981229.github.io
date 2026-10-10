// Jack's Firefly River on the effects' stage (src/effects/stage.js, its WebGL2 path): a mangrove river at night, as on
// Malaysia's firefly rivers, seen low from a boat that bobs a little. Thousands of fireflies blink at random in three
// rows of trees across the water, then fall into step by themselves (src/lib/fireflies/sync.js), until the whole bank
// flashes together on every half second of this site's server's clock, so two screens side by side flash together.
// Each guestbook note on the wall hangs a paper lantern on the near bank, in its note's paper colour, flashing on the
// true half second: the bank falls into step round the lanterns first. A tap flashes where it lands, and a steady
// beat of taps spreads out along the bank until it all flashes with them; a held finger is a torch, and the fireflies
// round it go dark, as real ones do. Every flash is mirrored in the river.
// The trees are grown for the stage's shape (src/lib/fireflies/mangroves.js) and drawn once into pictures of their
// own; the fireflies' clocks run on the GPU (src/worlds/fireflies/shaders.js), seeing each other through a coarse,
// blurred picture of their light. Where the GPU can't run it, the world's photo shows instead, its lanterns' buttons
// still working. Its colours are the --river-* tokens, the lanterns' the --note-* ones.
import photo from '../assets/worlds/fireflies.png';
import { caps, drawInto, governor, linear, pingPong, program, rgbOf, target } from '../effects/gl.js';
import { grow, plant, seeded, waterlineOf } from '../lib/fireflies/mangroves.js';
import { hang } from '../lib/fireflies/lanterns.js';
import * as model from '../lib/fireflies/sync.js';
import { arrange } from '../lib/guestbook.js';
import { checkClock } from '../lib/lab/exact-time.js';
import { SITE } from '../site';
import { noteLanterns } from './fireflies/notes.js';
import * as glsl from './fireflies/shaders.js';

export const options = { context: 'webgl2', antialias: false, depth: false };

const TAU = Math.PI * 2;
/** The fireflies on a laptop and on a phone, in rows of STATE_W in the GPU's textures. */
const COUNT = { wide: 16384, phone: 6144 };
const STATE_W = 128;
/** The share of them that fly alone between the trees, out of step: a few stragglers shimmering in between. */
const LONERS = 0.025;
/** Each row's fireflies' size (the radius of their bright heart, CSS pixels), far to near; a phone's are larger. */
const SIZES = [[0.36, 0.56], [0.58, 0.88], [0.85, 1.3]];
/** How bright each row's fireflies are, far to near: further off, fainter. */
const GAINS = [1.3, 2.1, 3];
const PHONE_SIZE = 1.25;
/** How far each row and the river move with the boat's bob, far to near: the far bank least. */
const PARALLAX = [0.6, 0.8, 1];
/** The torch: how far round it the fireflies go dark (CSS pixels), how fully, and its own light, a small warm glow
 *  well inside the dark ring, so the ring shows. */
const TORCH = { reach: 92, gain: 2.6, size: 13, light: 0.55 };
/** A press held longer than this (seconds) becomes the torch. */
const HOLD = 0.3;
/** After this long without a tap (seconds) the river draws at most 30 frames a second, which keeps a phone cool. */
const IDLE = 120;
/** Seconds a theme change takes to fade across. */
const FADE = 1;
/** After a gap longer than this (ms), from a pause, a hidden tab or a slow frame, every clock jumps on by the gap. */
const GAP = 200;
/** The quality rungs, best first: render scale (of the top one's), the bloom's halvings, the share of fireflies drawn. */
const RUNGS = [[1, 4, 1], [0.85, 4, 1], [0.72, 3, 1], [0.62, 3, 0.7], [0.5, 2, 0.5]];
/** The --river-* tokens; the aurora's only exist under the night sky. */
const NAMES = ['sky-top', 'sky-low', 'glow', 'tree', 'water', 'mist', 'star', 'firefly', 'core'];
const AURORA = ['aurora-1', 'aurora-2', 'aurora-3', 'aurora-4', 'aurora-5'];
/** How much each theme shows of what only some have: its glow on the horizon, stars, the aurora, mist, how far the
 *  far rows fade into the sky, and how much darker the sky is overhead than its top colour (the blue hour deepens
 *  upwards into the night). */
const LOOKS = {
  light: { glowing: 0.32, stars: 0.12, auroras: 0, misty: 0.14, haze: [0.5, 0.26], zenith: 0.58 },
  dark: { glowing: 0.75, stars: 0.6, auroras: 0, misty: 0.09, haze: [0.42, 0.2], zenith: 1 },
  night: { glowing: 0.35, stars: 1, auroras: 1, misty: 0.06, haze: [0.38, 0.18], zenith: 1 },
};

const clamp = (/** @type {number} */ x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smooth = (/** @type {number} */ x) => x * x * (3 - 2 * x);
const mixArr = (/** @type {number[]} */ a, /** @type {number[]} */ b, /** @type {number} */ t) => a.map((v, i) => v + (b[i] - v) * t);
/** Light's own units back to the screen's. @param {number} v */
const encode = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

/** @param {import('../effects/stage.js').Stage} stage */
export default function fireflies(stage) {
  const { gl } = stage;
  const canvas = /** @type {HTMLCanvasElement} */ (gl ? gl.canvas : stage.ctx.canvas);
  const root = /** @type {HTMLElement} */ (canvas.closest('[data-stage]'));
  // A finger held on the river is the torch: no text selection or callout under it on a phone.
  canvas.style.setProperty('-webkit-user-select', 'none');
  canvas.style.setProperty('-webkit-touch-callout', 'none');
  canvas.style.userSelect = 'none';

  let stopped = false;
  /** The stage's size the river is laid out for, and its plan: rows of trees and the waterline. */
  let W = stage.width;
  let H = stage.height;
  let phone = W < 600;
  /** @type {ReturnType<typeof plant> | null} */
  let plan = null;
  /** Where the water meets the far bank (CSS pixels from the top). */
  const waterline = () => plan?.waterline ?? waterlineOf(W, H);
  /** @type {import('../lib/guestbook.js').Note[]} */
  let wall = [];
  /** @type {ReturnType<typeof hang>} */
  let lanterns = [];
  /** How much each lantern is singled out (pointed at, focused or open): wanted, and eased towards. */
  const heedTo = new Float32Array(9);
  const heeded = new Float32Array(9);
  const notes = noteLanterns(root, (i, on) => { if (i < 9) heedTo[i] = on ? 1 : 0; });
  /** Set once the GPU's side is up: what follows a change to the lanterns there. */
  let onLanterns = () => {};
  const placeLanterns = () => {
    lanterns = hang(wall, { width: W, height: H, waterline: waterline() });
    notes.set(lanterns);
    onLanterns();
  };

  // The notes and the clock check, both at once; the river starts on the device's clock and moves to the server's
  // when the check answers (nothing to check against on a local preview).
  fetch(`${SITE.guestbook}/notes`)
    .then((answer) => answer.json())
    .then((data) => {
      if (stopped || !Array.isArray(data?.notes)) return;
      wall = arrange(data.notes).wall;
      placeLanterns();
    })
    .catch(() => {});
  const wallBase = Date.now() - performance.now();
  /** The server's clock minus this device's, in ms, once checked. */
  let offset = 0;
  checkClock(location.pathname)
    .then((best) => { if (best && !stopped) offset = best.offset; })
    .catch(() => {});
  /** True time, in ms since 1970, at a moment of performance.now(). @param {number} perf */
  const trueAt = (perf) => perf + wallBase + offset;

  /** Where the river can't be drawn: its photo, with the lanterns' buttons over it as small lanterns of their own. */
  const fallBack = () => {
    stage.showStill(photo.src, '');
    notes.plain(true);
    placeLanterns();
  };
  if (!gl) {
    fallBack();
    return {
      frame: () => {},
      resize: () => {
        W = stage.width;
        H = stage.height;
        placeLanterns();
      },
      stop: () => {
        stopped = true;
        notes.stop();
      },
    };
  }

  // ---- The GPU's side ------------------------------------------------------------------------------------------

  let usable = false;
  /** @type {Record<string, ReturnType<typeof program>>} */
  let P = {};
  /** A vertex array with nothing in it: every program here makes its own points from gl_VertexID. */
  let empty = /** @type {WebGLVertexArrayObject} */ (gl.createVertexArray());
  const makePrograms = () => {
    empty = /** @type {WebGLVertexArrayObject} */ (gl.createVertexArray());
    P = {
      splat: program(gl, glsl.SPLAT_VERTEX, glsl.PASS_FRAGMENT),
      lights: program(gl, glsl.LIGHTS_VERTEX, glsl.LIGHTS_FRAGMENT),
      blur: program(gl, glsl.COVER, glsl.BLUR_FRAGMENT),
      update: program(gl, glsl.COVER, glsl.UPDATE_FRAGMENT),
      shift: program(gl, glsl.COVER, glsl.SHIFT_FRAGMENT),
      sky: program(gl, glsl.COVER, glsl.SKY_FRAGMENT),
      trees: program(gl, glsl.BAND_VERTEX, glsl.TREES_FRAGMENT),
      flies: program(gl, glsl.FLIES_VERTEX, glsl.FLIES_FRAGMENT),
      glow: program(gl, glsl.LANTERN_VERTEX, glsl.GLOW_FRAGMENT),
      paper: program(gl, glsl.LANTERN_VERTEX, glsl.PAPER_FRAGMENT),
      down: program(gl, glsl.COVER, glsl.DOWN_FRAGMENT),
      up: program(gl, glsl.COVER, glsl.UP_FRAGMENT),
      final: program(gl, glsl.COVER, glsl.FINAL_FRAGMENT),
    };
  };
  const programsReady = () => Object.values(P).every((p) => p.ready());
  /** One triangle over the whole target. */
  const cover = () => {
    gl.bindVertexArray(empty);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // The fireflies' textures: where each sits (home: x, y, its own pace, size) and its clock (state: phase, pace,
  // darkness under the torch, seconds since its last flash). The clocks need full floats: a learned pace in half
  // floats would never be forgotten, as each step's change is smaller than half a float's step.
  let count = 0;
  let stateH = 0;
  let loners = 0;
  /** Each row's fireflies' first index and how many, far to near, then the loners'. */
  let ranges = [[0, 0], [0, 0], [0, 0], [0, 0]];
  /** @type {WebGLTexture | null} */
  let home = null;
  /** @type {Float32Array | null} */
  let homeData = null;
  /** @type {ReturnType<typeof pingPong> | null} */
  let state = null;
  let grid = [8, 8];
  /** The light's picture: the splat, the blur's halfway, the blurred. @type {ReturnType<typeof target>[]} */
  let field = [];
  const weights = model.kernel(model.MODEL.sight);
  const radius = (weights.length - 1) / 2;
  const half = weights.slice(radius);
  const own = weights[radius] * weights[radius];

  /** The rows' pictures of their trees, far to near, then the lanterns' bamboo poles on a picture of their own (they
   *  change with the notes); the canvases they were drawn on, kept to upload again after a lost context; and the bands
   *  of the stage they cover (CSS pixels, top and bottom). */
  /** @type {(WebGLTexture | null)[]} */
  const rowTex = [null, null, null, null];
  /** @type {(HTMLCanvasElement | null)[]} */
  const rowCanvas = [null, null, null, null];
  const rowBand = [[0, 0], [0, 0], [0, 0], [0, 0]];
  /** @type {import('../lib/fireflies/mangroves.js').Tree[][]} */
  let grown = [[], [], []];

  /** The picture, in light's own units, and the bloom's halvings and doublings. */
  /** @type {ReturnType<typeof target> | null} */
  let scene = null;
  /** @type {ReturnType<typeof target>[]} */
  let downs = [];
  /** @type {ReturnType<typeof target>[]} */
  let ups = [];
  let sceneSize = [0, 0];
  const pointMost = /** @type {Float32Array} */ (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE))[1];

  // ---- Colours ---------------------------------------------------------------------------------------------------

  /** @typedef {{ c: Record<string, number[]>, look: { glowing: number, stars: number, auroras: number, misty: number, haze: number[], zenith: number }, paper: number[][], glowPaper: number[][], ink: number[] }} Palette */
  const themeOf = () => (document.documentElement.dataset.theme === 'dark' ? (document.documentElement.dataset.sky === 'night' ? 'night' : 'dark') : 'light');
  /** @returns {Palette} */
  const readPalette = () => {
    const style = getComputedStyle(root);
    const read = (/** @type {string} */ name) => linear(rgbOf(style.getPropertyValue(name)));
    const theme = themeOf();
    const c = Object.fromEntries(NAMES.map((n) => [n, read(`--river-${n}`)]));
    AURORA.forEach((n, i) => { c[`aurora${i}`] = theme === 'night' ? read(`--river-${n}`) : c['sky-top']; });
    const paper = [1, 2, 3, 4, 5, 6].map((n) => rgbOf(style.getPropertyValue(`--note-${n}`)));
    return {
      c,
      look: LOOKS[theme],
      paper: paper.map((p) => p.map((v) => v / 255)),
      glowPaper: paper.map((p) => linear(p)),
      ink: rgbOf(style.getPropertyValue('--note-ink')).map((v) => v / 255),
    };
  };
  let palette = readPalette();
  /** @type {Palette | null} */
  let fromPalette = null;
  let fadeStart = 0;
  let colorsSeen = stage.colors;
  /** The colours being drawn with: the theme's, or between two while a change fades across. @param {number} now */
  const colours = (now) => {
    if (!fromPalette) return palette;
    const t = smooth(clamp((now - fadeStart) / (FADE * 1000)));
    if (t >= 1) {
      fromPalette = null;
      return palette;
    }
    const a = fromPalette;
    const b = palette;
    const blend = (/** @type {number} */ x, /** @type {number} */ y) => x + (y - x) * t;
    return {
      ...b,
      c: Object.fromEntries(Object.keys(b.c).map((k) => [k, mixArr(a.c[k], b.c[k], t)])),
      look: { glowing: blend(a.look.glowing, b.look.glowing), stars: blend(a.look.stars, b.look.stars), auroras: blend(a.look.auroras, b.look.auroras), misty: blend(a.look.misty, b.look.misty), haze: mixArr(a.look.haze, b.look.haze, t), zenith: blend(a.look.zenith, b.look.zenith) },
    };
  };

  // ---- Building the bank, a little each frame ----------------------------------------------------------------------

  /** The top rung's render scale: every pixel on a laptop, where the trees' and lanterns' edges show it and the GPU
   *  has room to spare; on a phone about 1.2 pixels for each CSS pixel, which a dark, soft scene doesn't need more of. */
  const topScale = (small = phone) => Math.min(1, (small ? 1.2 : 2) / stage.density);
  /** The work of laying the river out for a size, a step at a time: planting, growing each tree, painting each row,
   *  placing the fireflies. Done in slices of a few milliseconds on frames of its own, so the page never waits; what
   *  was there before stays on screen (stretched, after a resize) until the new one is ready. */
  /** @type {Generator<void, void, void> | null} */
  let building = null;
  /** Whether a layout is ready to draw. */
  let built = false;
  let buildFrame = 0;
  let resizing = 0;
  function* build() {
    const w = stage.width;
    const h = stage.height;
    const next = plant(w, h);
    /** @type {import('../lib/fireflies/mangroves.js').Tree[][]} */
    const trees = [[], [], []];
    for (let r = 0; r < 3; r++) {
      for (const p of next.rows[r].plants) {
        trees[r].push(grow(p));
        yield;
      }
    }
    const res = stage.density * topScale(w < 600);
    const painted = [];
    for (let r = 0; r < 3; r++) painted.push(yield* paint(trees[r], next.waterline, w, h, res));
    W = w;
    H = h;
    phone = W < 600;
    plan = next;
    grown = trees;
    painted.forEach((p, r) => {
      rowCanvas[r] = p.canvas;
      rowBand[r] = p.band;
      upload(r);
    });
    placeLanterns();
    placeFireflies();
    built = true;
  }
  const keepBuilding = () => {
    buildFrame = 0;
    if (!building || stopped) return;
    if (document.hidden) {
      document.addEventListener('visibilitychange', keepBuilding, { once: true });
      return;
    }
    const until = performance.now() + 6;
    while (performance.now() < until) {
      if (building.next().done) {
        building = null;
        settle();
        return;
      }
    }
    buildFrame = requestAnimationFrame(keepBuilding);
  };
  const startBuild = () => {
    building = build();
    if (!buildFrame) buildFrame = requestAnimationFrame(keepBuilding);
  };
  /** Once built, and once the programs are ready: a still with less motion, or one picture while paused. Waits on
   *  frames of its own, as a paused stage draws nothing until asked. */
  const settle = () => {
    buildFrame = 0;
    if (stopped || building) return;
    if (!programsReady()) {
      buildFrame = requestAnimationFrame(settle);
      return;
    }
    if (stage.playing) return;
    if (stage.still && !storyStarted) {
      // The still: every tree lit at the top of a flash, on a true half second, a few stragglers out of step.
      simMs = Math.floor(trueAt(performance.now()) / 500) * 500;
      seedClocks('still');
      lightOnly();
    }
    stage.redraw();
  };

  /** A row's trees, painted once into a picture of their own: alpha is the silhouette, red how much of it is leaves
   *  (the fireflies' light shows on the leaves). On a canvas the CPU paints, many times quicker than the GPU's for
   *  thousands of small shapes, a tree at a time. @param {import('../lib/fireflies/mangroves.js').Tree[]} trees
   *  @param {number} line the waterline @param {number} w @param {number} h @param {number} res pixels to a CSS pixel */
  function* paint(trees, line, w, h, res) {
    const top = Math.max(0, Math.floor(Math.min(...trees.map((t) => t.top)) - 6));
    const bottom = Math.min(h, Math.ceil(line + 4));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * res));
    canvas.height = Math.max(1, Math.round((bottom - top) * res));
    const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }));
    g.setTransform(res, 0, 0, res, 0, -top * res);
    g.lineCap = 'round';
    for (const t of trees) {
      g.strokeStyle = 'rgb(0, 0, 0)';
      for (const [x0, y0, x1, y1, width] of t.segments) {
        g.lineWidth = width;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      }
      for (const [x, y, rh, width, lean] of t.roots) {
        g.lineWidth = width;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + lean * rh, y - rh);
        g.stroke();
      }
      g.fillStyle = 'rgb(0, 0, 0)';
      const [mx, my, mw, mh] = t.mud;
      g.beginPath();
      g.ellipse(mx, my, mw, mh, 0, Math.PI, TAU);
      g.fill();
      // The leaves, red so the shader knows them: each clump's middle, and the single leaves round it.
      g.fillStyle = 'rgb(255, 0, 0)';
      for (const [x, y, rr] of t.clumps) {
        g.beginPath();
        g.arc(x, y, rr * 0.72, 0, TAU);
        g.fill();
      }
      for (const [x, y, len, a] of t.leaves) {
        const cx = Math.cos(a) * len;
        const cy = Math.sin(a) * len;
        g.beginPath();
        g.moveTo(x + cx, y + cy);
        g.lineTo(x - cy * 0.42, y + cx * 0.42);
        g.lineTo(x - cx, y - cy);
        g.lineTo(x + cy * 0.42, y - cx * 0.42);
        g.fill();
      }
      yield;
    }
    return { canvas, band: [top, bottom] };
  }

  /** The lanterns' bamboo poles, on a picture of their own: from the bank, leaning out over the water, bending over at
   *  the top. Painted again whenever the lanterns change, which is quick. */
  function paintPoles() {
    if (!lanterns.length) {
      rowCanvas[3] = null;
      return;
    }
    const line = waterline();
    const top = Math.max(0, Math.floor(Math.min(...lanterns.map((l) => l.tip[1] - l.height * 0.5)) - 4));
    const bottom = Math.min(H, Math.ceil(line + 4));
    const res = stage.density * topScale();
    const c = rowCanvas[3] ?? document.createElement('canvas');
    rowCanvas[3] = c;
    c.width = Math.max(1, Math.round(W * res));
    c.height = Math.max(1, Math.round((bottom - top) * res));
    const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d', { willReadFrequently: true }));
    g.setTransform(res, 0, 0, res, 0, -top * res);
    g.lineCap = 'round';
    g.strokeStyle = 'rgb(0, 0, 0)';
    for (const l of lanterns) {
      const [tx, ty] = l.tip;
      const [fx, fy] = l.foot;
      // Up from the mud nearly straight, then over, as a rod bends under what hangs from it.
      g.lineWidth = Math.max(1, l.height * (l.row ? 0.05 : 0.065));
      g.beginPath();
      g.moveTo(fx, fy);
      g.quadraticCurveTo(fx + (tx - fx) * 0.08, ty - l.height * 0.45, tx, ty);
      g.stroke();
    }
    rowBand[3] = [top, bottom];
    upload(3);
  }

  /** @param {number} r */
  const upload = (r) => {
    const c = rowCanvas[r];
    if (!c) return;
    if (!rowTex[r]) rowTex[r] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, rowTex[r]);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  // New lanterns bring their poles; a paused river is drawn again to show them.
  onLanterns = () => {
    paintPoles();
    if (built) stage.redraw();
  };

  /** The fireflies on the grown trees: their homes, and the light's picture shaped like the stage. */
  function placeFireflies() {
    if (!plan) return;
    const wanted = phone ? COUNT.phone : COUNT.wide;
    const rand = seeded(Math.round(plan.width * 7 + plan.height));
    const alone = Math.round(wanted * LONERS);
    const together = wanted - alone;
    const data = new Float32Array(wanted * 4);
    const counts = [0, 1].map((r) => Math.round(together * plan.rows[r].fireflies));
    counts.push(together - counts[0] - counts[1]);
    const natural = model.paces(wanted, rand);
    const scale = phone ? PHONE_SIZE : 1;
    let at = 0;
    ranges = [];
    for (let r = 0; r < 3; r++) {
      const spots = scatterRow(r, counts[r], rand);
      ranges.push([at, counts[r]]);
      for (let k = 0; k < counts[r]; k++, at++) data.set([spots[k * 2] / W, 1 - spots[k * 2 + 1] / H, natural[at], scale * (SIZES[r][0] + (SIZES[r][1] - SIZES[r][0]) * rand())], at * 4);
    }
    // The loners, in the air round the near trees, at paces of their own.
    loners = at;
    const highest = Math.min(...grown[2].map((t) => t.top));
    for (let k = 0; k < alone; k++, at++) data.set([rand(), 1 - (highest + (plan.waterline - highest) * (0.1 + 0.8 * rand())) / H, model.NATURAL + (rand() - 0.5) * 0.6, scale * SIZES[1][1]], at * 4);
    ranges.push([loners, alone]);
    homeData = data;
    const fresh = count !== wanted;
    count = wanted;
    stateH = Math.ceil(count / STATE_W);
    grid = model.gridFor(W, H, phone ? model.CELLS.phone : model.CELLS.wide);
    crowding = Math.min(1, ((W * H) / count / ((1136 * 620) / COUNT.wide)) ** 0.8);
    makeFireflyTargets(fresh);
  }
  /** `n` places on a row's leaves, each clump getting its share by its area, and each tree by how much the fireflies
   *  like it: they crowd some trees and leave others nearly dark, as on the real rivers. @param {number} r @param {number} n
   *  @param {() => number} rand */
  const scatterRow = (r, n, rand) => {
    const out = new Float32Array(n * 2);
    const clumps = grown[r].flatMap((t) => {
      const liked = seeded(Math.round(t.x * 13 + r * 7919))();
      return t.clumps.map(([x, y, rr]) => [x, y, rr, 0.3 + 1.4 * liked * liked]);
    }).filter(([x, , rr]) => x + rr > 0 && x - rr < W);
    if (!clumps.length) return out;
    let total = 0;
    const areas = clumps.map(([, , rr, liked]) => (total += rr * rr * liked));
    for (let i = 0; i < n; i++) {
      let lo = 0;
      let hi = areas.length - 1;
      const pick = rand() * total;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (areas[mid] < pick) lo = mid + 1;
        else hi = mid;
      }
      const [cx, cy, rr] = clumps[lo];
      const d = rr * Math.sqrt(rand());
      const a = rand() * TAU;
      out[i * 2] = clamp(cx + Math.cos(a) * d, 0.5, W - 0.5);
      out[i * 2 + 1] = cy + Math.sin(a) * d;
    }
    return out;
  };

  /** The fireflies' textures; their clocks start afresh only when their number changed. @param {boolean} fresh */
  function makeFireflyTargets(fresh) {
    if (!homeData) return;
    if (home) gl.deleteTexture(home);
    home = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, home);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, STATE_W, stateH);
    const padded = new Float32Array(STATE_W * stateH * 4);
    padded.set(homeData);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, STATE_W, stateH, gl.RGBA, gl.FLOAT, padded);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    if (fresh || !state) {
      state?.dispose();
      state = pingPong(gl, STATE_W, stateH, 'rgba32f');
      seedClocks(storyDone ? 'beat' : 'random');
    }
    for (const t of field) t.dispose();
    field = [target(gl, grid[0], grid[1], 'rgba16f'), target(gl, grid[0], grid[1], 'rgba16f'), target(gl, grid[0], grid[1], 'rgba16f', { filter: 'linear' })];
  }

  /** Sets every clock: at random (the river's opening), on the true-time beat (after the GPU lost and gave back its
   *  picture), or at the peak of a flash with a few stragglers (the still for less motion). @param {'random' | 'beat' | 'still'} how */
  function seedClocks(how) {
    if (!state || !homeData) return;
    const rand = seeded(how === 'random' ? Math.floor(Math.random() * 2 ** 31) : 4242);
    const data = new Float32Array(STATE_W * stateH * 4);
    const beat = model.truePhase(simMs);
    for (let i = 0; i < count; i++) {
      let theta = rand();
      if (how === 'beat') theta = beat + (rand() - 0.5) * 0.04;
      if (how === 'still') theta = rand() < 0.04 ? rand() : (rand() - 0.5) * 0.012;
      data.set([theta - Math.floor(theta), homeData[i * 4 + 2], 0, 1], i * 4);
    }
    for (const t of [state.read, state.write]) {
      gl.bindTexture(gl.TEXTURE_2D, t.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, STATE_W, stateH, gl.RGBA, gl.FLOAT, data);
    }
  }

  /** The picture's targets, at the canvas's size, and the bloom's halvings. */
  function sizeScene() {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    if (scene && sceneSize[0] === w && sceneSize[1] === h) return;
    scene?.dispose();
    for (const t of [...downs, ...ups]) t.dispose();
    scene = target(gl, w, h, 'rgba16f', { filter: 'linear' });
    downs = [];
    ups = [];
    let bw = w;
    let bh = h;
    for (let i = 0; i < 4; i++) {
      bw = Math.max(1, bw >> 1);
      bh = Math.max(1, bh >> 1);
      downs.push(target(gl, bw, bh, 'rgba16f', { filter: 'linear' }));
      ups.push(target(gl, bw, bh, 'rgba16f', { filter: 'linear' }));
    }
    sceneSize = [w, h];
  }

  // ---- Clocks, the opening and the hands -------------------------------------------------------------------------

  /** The true time (ms) the fireflies' clocks have reached. */
  let simMs = 0;
  /** When the river opened (performance.now): dark at first, then the fireflies waking, then gathering. With less
   *  motion, or after the GPU gave its picture back, the opening is over before it starts. */
  let storyStart = 0;
  let storyStarted = false;
  let storyDone = stage.still;
  const storyAt = (/** @type {number} */ now) => (storyDone ? 999 : storyStarted ? (now - storyStart) / 1000 : 0);
  const keeper = model.keeper();
  /** The taps' glows on the screen: where (shares of the stage, y up), and when (performance.now). */
  /** @type {{ x: number, y: number, at: number }[]} */
  let flashes = [];
  /** The press being held, if any, and the torch's strength. */
  /** @type {{ id: number, at: number } | null} */
  let press = null;
  let torch = 0;
  let lastTouch = performance.now();

  /** A finger's tap, waiting to be sure it is one: a finger that starts a scroll of the page shouldn't flash. */
  /** @type {{ x: number, y: number, at: number, cx: number } | null} */
  let maybe = null;
  let maybeTimer = 0;
  /** A tap counts (at the moment it began, so a tapped beat keeps its time) and flashes. @param {{ x: number, y: number, at: number }} t */
  const tap = (t) => {
    if (!keeper.tap(trueAt(t.at) / 1000, t.x, t.y)) return;
    flashes.push({ x: t.x, y: t.y, at: t.at });
    if (flashes.length > 3) flashes.shift();
  };
  const settleTap = () => {
    clearTimeout(maybeTimer);
    if (maybe) tap(maybe);
    maybe = null;
  };
  /** @param {PointerEvent} e */
  const onDown = (e) => {
    lastTouch = performance.now();
    // A press on the river with a note open only closes it, and focus goes back to its lantern, not to the page.
    if (notes.open) {
      e.preventDefault();
      notes.close();
      return;
    }
    const box = canvas.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = 1 - (e.clientY - box.top) / box.height;
    press = { id: e.pointerId, at: e.timeStamp };
    if (e.pointerType !== 'touch') return tap({ x, y, at: e.timeStamp });
    // A finger may be starting a scroll, which the browser then takes (pointercancel): its tap waits until it lifts,
    // moves sideways or stays put a moment.
    settleTap();
    maybe = { x, y, at: e.timeStamp, cx: e.clientX };
    maybeTimer = window.setTimeout(settleTap, 120);
  };
  /** @param {PointerEvent} e */
  const onMove = (e) => { if (maybe && Math.abs(e.clientX - maybe.cx) > 6) settleTap(); };
  /** @param {PointerEvent} e */
  const onUp = (e) => {
    if (e.type === 'pointerup') settleTap();
    if (e.type === 'pointercancel') {
      clearTimeout(maybeTimer);
      maybe = null;
    }
    if (press && press.id === e.pointerId) press = null;
  };
  /** A long press on a phone would open the browser's menu over the torch. @param {Event} e */
  const onMenu = (e) => { if (press) e.preventDefault(); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(type, /** @type {EventListener} */ (onUp));
  canvas.addEventListener('contextmenu', onMenu);

  let rung = 0;
  const ladder = governor(RUNGS.length, (r) => { rung = r; });
  let lastDraw = 0;
  let idling = false;

  // ---- Drawing ---------------------------------------------------------------------------------------------------

  /** @param {ReturnType<typeof program>} p @param {Record<string, number | number[] | Float32Array>} u */
  const set = (p, u) => {
    for (const [name, v] of Object.entries(u)) {
      const at = p.at(name);
      if (at === null) continue;
      if (typeof v === 'number') gl.uniform1f(at, v);
      else if (v.length === 2) gl.uniform2fv(at, v);
      else if (v.length === 3) gl.uniform3fv(at, v);
      else if (v.length === 4) gl.uniform4fv(at, v);
      else gl.uniform1fv(at, v);
    }
  };
  /** @param {ReturnType<typeof program>} p @param {Record<string, number>} u */
  const ints = (p, u) => { for (const [name, v] of Object.entries(u)) gl.uniform1i(p.at(name), v); };
  /** @param {number} unit @param {WebGLTexture | null} t */
  const tex = (unit, t) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
  };

  /** The glows for each step's light (sixteen at most: the lanterns, the taps, the torch) and which colours they shine in. */
  const lights = new Float32Array(64);
  const channels = new Float32Array(64);
  /** One step of every clock: their light into the picture with the lanterns', the taps' and the torch's, blurred, then
   *  each clock moved on (sync.js's stepBank). @param {number} ms the true time at the step's start @param {number} story */
  function step(ms, story) {
    if (!state || !home) return;
    const [g0, g1, g2] = field;
    const phase = model.truePhase(ms);
    drawInto(gl, g0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(empty);
    P.splat.use();
    tex(0, state.read.texture);
    tex(1, home);
    ints(P.splat, { state: 0, home: 1, width: STATE_W });
    set(P.splat, { grid, story });
    gl.drawArrays(gl.POINTS, 0, loners);
    lights.fill(0);
    channels.fill(0);
    let n = 0;
    const pulse = model.MODEL.lantern * model.flash(phase, model.BEAT);
    for (const l of lanterns.slice(0, 9)) {
      lights.set([l.x / W, 1 - l.y / H, model.MODEL.lanternReach, pulse], n * 4);
      channels.set([1, 0, 0, 0], n * 4);
      n++;
    }
    for (const [x, y, power, reach] of keeper.lights(ms / 1000).slice(-3)) {
      lights.set([x, y, reach, power], n * 4);
      channels.set([0, 0, 1, 0], n * 4);
      n++;
    }
    if (torch > 0.01) {
      const p = stage.pointer;
      const reach = TORCH.reach / (W / grid[0]) / 2.2;
      lights.set([p.x / W, 1 - p.y / H, reach, torch * TAU * reach * reach], n * 4);
      channels.set([0, 1, 0, 0], n * 4);
      n++;
    }
    if (n) {
      P.lights.use();
      gl.uniform4fv(P.lights.at('lights'), lights);
      gl.uniform4fv(P.lights.at('channels'), channels);
      set(P.lights, { grid });
      gl.drawArrays(gl.POINTS, 0, n);
    }
    gl.disable(gl.BLEND);
    P.blur.use();
    gl.uniform1fv(P.blur.at('weights'), half);
    ints(P.blur, { src: 0, radius });
    drawInto(gl, g1);
    tex(0, g0.texture);
    gl.uniform2i(P.blur.at('dir'), 1, 0);
    cover();
    drawInto(gl, g2);
    tex(0, g1.texture);
    gl.uniform2i(P.blur.at('dir'), 0, 1);
    cover();
    const beat = keeper.at(ms / 1000);
    const m = model.MODEL;
    drawInto(gl, state.write);
    P.update.use();
    tex(0, state.read.texture);
    tex(1, home);
    tex(2, g2.texture);
    ints(P.update, { state: 0, home: 1, field: 2, width: STATE_W, loners });
    set(P.update, {
      grid, h: model.STEP, phase, pull: model.pullAt(story), story, own, halo: m.halo, tall: H / W,
      couple: m.couple, learn: m.learn, forget: m.forget, drive: m.drive, keep: m.keep, follow: m.follow, followKeep: m.followKeep,
      beat: beat ? [beat.phase, beat.x, beat.y, beat.reach] : [0, 0, 0, 0], beatWeight: beat ? beat.weight : 0, torchGain: TORCH.gain,
    });
    cover();
    state.swap();
  }

  /** Moves every clock on by `ms` of true time at once, keeping them in step with each other and with true time. @param {number} ms */
  function shift(ms) {
    if (!state) return;
    drawInto(gl, state.write);
    P.shift.use();
    tex(0, state.read.texture);
    ints(P.shift, { state: 0 });
    set(P.shift, { shift: ((((ms / 1000) * model.BEAT) % 1) + 1) % 1, gap: Math.max(0, ms / 1000) });
    cover();
    state.swap();
  }

  /** Only the light's picture for the clocks as they are, for a still: a step into the spare clocks, thrown away. */
  function lightOnly() {
    if (!state) return;
    step(simMs, storyAt(performance.now()));
    state.swap();
  }

  /** The whole picture. @param {number} now performance.now() @param {number} ahead seconds from the clocks to the
   *  moment shown @param {number} shownMs that moment in true time */
  function render(now, ahead, shownMs) {
    if (!state || !scene || !plan) return;
    const pal = colours(now);
    const c = pal.c;
    const look = pal.look;
    const story = storyAt(now);
    const t = now / 1000;
    const [sw, sh] = sceneSize;
    const pixel = sw / W;
    const [, bloomLevels, share] = RUNGS[rung];
    // The boat's bob: a few pixels, slow and never quite repeating; none with less motion.
    const bobPx = stage.still ? 0 : 1.7 * Math.sin((t * TAU) / 4.7) + 0.8 * Math.sin((t * TAU) / 2.9 + 1.3);
    const bob = (/** @type {number} */ r) => (bobPx * PARALLAX[r]) / H;
    const horizon = 1 - plan.waterline / H;
    // The opening's first moments are dark: the lanterns and the river's glow come up as the fireflies wake.
    const dawn = smooth(clamp((story - 0.3) / 1.6));

    drawInto(gl, scene);
    gl.disable(gl.BLEND);
    P.sky.use();
    gl.uniform3fv(P.sky.at('aurora'), new Float32Array([0, 1, 2, 3, 4].flatMap((i) => c[`aurora${i}`])));
    set(P.sky, { top: c['sky-top'], low: c['sky-low'], glow: c.glow, star: c.star, glowing: look.glowing, stars: look.stars, auroras: look.auroras, zenith: look.zenith, horizon: horizon + bob(0), time: t, pixel, view: [sw, sh] });
    cover();

    // The leaves' light: how bright the light's picture shows on them, the same whatever the number of fireflies.
    const lighting = (0.03 * grid[0] * grid[1] * COUNT.wide) / (count * model.CELLS.wide);
    // The rows far to near, each with its fireflies, which the nearer rows hide; the loners with the near row, and the
    // lanterns' poles in front of it all.
    for (let r = 0; r < 4; r++) {
      const at = Math.min(r, 2);
      if (rowTex[r] && (r < 3 || rowCanvas[3])) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        P.trees.use();
        tex(0, rowTex[r]);
        tex(1, field[2].texture);
        ints(P.trees, { tex: 0, field: 1 });
        const [top, bottom] = rowBand[r];
        set(P.trees, {
          band: [0, 1 - bottom / H + bob(at), 1, 1 - top / H + bob(at)],
          tree: c.tree, haze: c['sky-low'], fly: c.firefly, warm: c.core, hazing: r < 2 ? look.haze[r] : 0, lighting,
        });
        gl.bindVertexArray(empty);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      if (r < 3) flies(ranges[r], 0.8, GAINS[r], share, now, ahead, story, bob(r), pixel, c);
      if (r === 2) flies(ranges[3], 4, GAINS[1], share, now, ahead, story, bob(2), pixel, c);
    }

    // The lanterns' glow: their paper lit from inside, brightest on the true-time beat, and a halo round each.
    const shown = lanterns.slice(0, 9);
    const beat = model.flash(model.truePhase(shownMs), model.BEAT);
    if (shown.length) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      P.glow.use();
      lanternUniforms(P.glow, now, bob(2), sw, sh, pixel);
      gl.uniform3fv(P.glow.at('paper'), new Float32Array(shown.flatMap((l) => pal.glowPaper[l.colour - 1])));
      gl.uniform1fv(P.glow.at('pulse'), new Float32Array(shown.map((_, i) => (0.3 + 0.7 * beat) * (0.25 + 0.75 * dawn) * (1 + heeded[i] * 0.8))));
      set(P.glow, { spread: 1.7 });
      gl.bindVertexArray(empty);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, shown.length);
    }
    gl.disable(gl.BLEND);

    // The bloom: halvings of the bright parts, then back up, each level adding its own. A phone stops a level short,
    // its bloom a quarter of the picture's size, and fainter, as it spreads over more of a small card.
    const levels = Math.min(bloomLevels, downs.length);
    const lowest = phone ? 1 : 0;
    P.down.use();
    ints(P.down, { src: 0 });
    let from = scene;
    for (let i = 0; i < levels; i++) {
      drawInto(gl, downs[i]);
      tex(0, from.texture);
      set(P.down, { texel: [1 / from.width, 1 / from.height], threshold: i === 0 ? 0.6 : 0 });
      cover();
      from = downs[i];
    }
    P.up.use();
    ints(P.up, { src: 0, own: 1 });
    for (let i = levels - 2; i >= lowest; i--) {
      drawInto(gl, ups[i]);
      tex(0, from.texture);
      tex(1, downs[i].texture);
      set(P.up, { texel: [0.5 / from.width, 0.5 / from.height], view: [ups[i].width, ups[i].height], mixing: 0.6 });
      cover();
      from = ups[i];
    }

    drawInto(gl, null);
    P.final.use();
    tex(0, scene.texture);
    tex(1, from.texture);
    tex(2, field[2].texture);
    ints(P.final, { scene: 0, bloom: 1, field: 2 });
    flashes = flashes.filter((f) => now - f.at < 900);
    const glows = new Float32Array(12);
    flashes.forEach((f, i) => {
      const age = (now - f.at) / 1000;
      glows.set([f.x, f.y, 26 + 30 * age, 0.55 * Math.exp(-age * 4.5) * smooth(clamp(age / 0.03))], i * 4);
    });
    gl.uniform4fv(P.final.at('taps'), glows);
    const p = stage.pointer;
    set(P.final, {
      view: [sw, sh], horizon, time: t, pixel, bloomGain: (phone ? 0.38 : 0.55) * (0.3 + 0.7 * dawn), misty: look.misty, bob: bob(2),
      water: c.water, mist: c.mist, fly: c.firefly, warm: c.core, torch: [p.x / W, 1 - p.y / H, TORCH.size, torch * TORCH.light],
    });
    cover();

    // The lanterns' paper, last, in each note's own colour as the screen shows it, so a lantern and its note's card
    // are the same colour.
    if (shown.length) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      P.paper.use();
      lanternUniforms(P.paper, now, bob(2), sw, sh, pixel);
      gl.uniform3fv(P.paper.at('paper'), new Float32Array(shown.flatMap((l) => pal.paper[l.colour - 1])));
      set(P.paper, { ink: pal.ink, spread: 0.75 });
      gl.bindVertexArray(empty);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, shown.length);
      gl.disable(gl.BLEND);
    }
  }

  /** How bright each firefly is for the room it has: a phone's card holds fewer fireflies but more to each square
   *  pixel, so each is dimmer, and a flash of the whole bank stays as gentle on a small screen (under a tenth of the
   *  card's brightness from trough to peak) as on a laptop's. The laptop's card is 1. */
  let crowding = 1;
  /** One row's fireflies as glowing points. @param {number[]} range @param {number} drift @param {number} gain @param {number} share @param {number} now @param {number} ahead @param {number} story @param {number} bob @param {number} pixel @param {Record<string, number[]>} c */
  function flies([first, n], drift, gain, share, now, ahead, story, bob, pixel, c) {
    if (!n || !state) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    P.flies.use();
    tex(0, state.read.texture);
    tex(1, home);
    ints(P.flies, { state: 0, home: 1, width: STATE_W, first });
    set(P.flies, {
      story, ahead, time: now / 1000, pixel, most: Math.min(24 * pixel, pointMost), drift,
      view: sceneSize, bob: [0, bob], fly: c.firefly, core: c.core, gain: gain * crowding,
    });
    gl.bindVertexArray(empty);
    gl.drawArrays(gl.POINTS, 0, Math.max(1, Math.round(n * share)));
  }

  /** @param {ReturnType<typeof program>} p @param {number} now @param {number} bob @param {number} sw @param {number} sh @param {number} pixel */
  function lanternUniforms(p, now, bob, sw, sh, pixel) {
    const t = now / 1000;
    const shown = lanterns.slice(0, 9);
    // Each sways a little on its string, at its own pace.
    gl.uniform4fv(p.at('lanterns'), new Float32Array(shown.flatMap((l) => [l.x / W, 1 - l.y / H + bob, l.height / H, stage.still ? 0 : 0.035 * Math.sin(t * (1.1 + (l.note.id % 5) * 0.13) + l.note.id)])));
    gl.uniform4fv(p.at('tips'), new Float32Array(shown.flatMap((l) => [l.tip[0] / W, 1 - l.tip[1] / H + bob, 0, 0])));
    set(p, { view: [sw, sh], pixel });
  }

  // ---- Starting ----------------------------------------------------------------------------------------------------

  /** The time between frames, smoothed, to aim each frame at the moment it will be seen. */
  let interval = 1000 / 60;
  let lastFrame = 0;

  const start = () => {
    const can = caps(gl);
    usable = can.float32 && can.float16;
    if (!usable) return fallBack();
    makePrograms();
    startBuild();
  };
  start();

  return {
    frame(dt) {
      const now = performance.now();
      if (stage.colors !== colorsSeen) {
        colorsSeen = stage.colors;
        const before = colours(now);
        palette = readPalette();
        fromPalette = stage.playing ? before : null;
        fadeStart = now;
      }
      if (!usable) return;
      if (!built || !programsReady()) {
        // Until the river is ready, the card is its sky's colour, not black.
        const [r, g, b] = palette.c['sky-low'].map(encode);
        drawInto(gl, null);
        gl.clearColor(r, g, b, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }
      const playing = stage.playing;
      if (playing) {
        // After two minutes without a tap, at most 30 frames a second, which the governor mustn't take for slowness.
        const idle = now - lastTouch > IDLE * 1000;
        if (idle !== idling) ladder.hold((idling = idle));
        if (idle && now - lastDraw < 32) return;
        ladder.tick(now);
        if (lastFrame) interval += (Math.min(50, now - lastFrame) - interval) * 0.1;
        lastFrame = now;
      } else lastFrame = 0;
      const scale = topScale() * RUNGS[rung][0];
      if (Math.abs(stage.scale - scale) > 0.001) stage.setScale(scale);
      sizeScene();

      let shownMs = simMs;
      if (playing) {
        if (!storyStarted) {
          storyStarted = true;
          storyStart = now;
          if (!stage.still) simMs = trueAt(now);
        }
        // Run the clocks up to the moment this frame will be seen: true time, a frame from now. A gap (a pause, a
        // hidden tab, the clock check's answer) moves every clock on at once, so the beat stays on true time.
        shownMs = trueAt(now) + interval;
        let owed = shownMs - simMs;
        if (owed > GAP || owed < -1) {
          shift(owed);
          simMs = shownMs;
          owed = 0;
        }
        const stepMs = model.STEP * 1000;
        let steps = Math.floor(owed / stepMs);
        if (steps > 6) {
          shift((steps - 6) * stepMs);
          simMs += (steps - 6) * stepMs;
          steps = 6;
        }
        const story = storyAt(now);
        for (let i = 0; i < steps; i++) {
          step(simMs, story);
          simMs += stepMs;
        }
        // A press held long enough becomes the torch, which fades in and out.
        const held = Boolean(press) && stage.pointer.down && now - (press?.at ?? now) > HOLD * 1000;
        torch += ((held ? 1 : 0) - torch) * clamp(dt * (held ? 6 : 9));
        for (let i = 0; i < 9; i++) heeded[i] += (heedTo[i] - heeded[i]) * clamp(dt * 8);
      } else heeded.set(heedTo);
      const ahead = playing ? (shownMs - simMs) / 1000 : 0;
      render(now, ahead, shownMs);
      lastDraw = now;
    },
    resize() {
      if (stage.width === W && stage.height === H && (built || building)) return;
      clearTimeout(resizing);
      // Grown again for the new shape a moment after the size settles; until then the old picture is stretched.
      resizing = window.setTimeout(startBuild, built ? 200 : 0);
    },
    restore() {
      // Everything the GPU had is gone with the lost context: made again, never deleted.
      scene = null;
      downs = [];
      ups = [];
      field = [];
      state = null;
      home = null;
      rowTex.fill(null);
      const can = caps(gl);
      usable = can.float32 && can.float16;
      if (!usable) return fallBack();
      makePrograms();
      sizeScene();
      for (let r = 0; r < 4; r++) upload(r);
      storyDone = true;
      makeFireflyTargets(true);
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(buildFrame);
      clearTimeout(resizing);
      document.removeEventListener('visibilitychange', keepBuilding);
      clearTimeout(maybeTimer);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      for (const type of ['pointerup', 'pointercancel', 'pointerleave']) canvas.removeEventListener(type, /** @type {EventListener} */ (onUp));
      canvas.removeEventListener('contextmenu', onMenu);
      notes.stop();
    },
  };
}
