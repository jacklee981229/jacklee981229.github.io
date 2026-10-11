// Jack's Town on the Effects' stage (src/effects/stage.js): the day's town (src/lib/town/), the same for everyone that
// day, seen from above as a little model: pitched-roof homes on lawns and flat-roofed buildings in bold colours, roads
// with kerbs and dashed middle lines, running into the homes' drives and the car parks (painted bays) as one, a river
// with sand banks, bridges, roundabouts round
// a palm, trees and palms, a concrete flyover on pillars, and short crisp shadows that turn with the town clock's sun.
// It builds itself in a few seconds as it first shows, road by road and pop by pop. Its cars drive by themselves
// (traffic.js), and about every two minutes (three town hours, as a town hour passes in 40 seconds) the town changes
// (growth.js): what's new pops up with a flash and a burst, what goes leaves a puff of
// dust. What stays still is drawn into a picture of its own, drawn again only while something pops or goes or the sun
// has moved; each frame lays it down with the river's flow, the cars, the flyover, cloud shadows drifting over and the
// bursts. Now and then a car thinks of where it's going in a thought bubble (thoughts.js), and a click or a tap on a
// car asks it. By night (the dark theme) the same town in deep blues with lit windows; under the night sky the aurora
// shimmers on the river. Switching the theme fades from one to the other. Every colour is a --town-* token
// (tokens.css), or a lighter or darker mix of one. The page brings the town's chip (its day and time, and what's in
// it), which this keeps up to date, and its panel of controls (WorldPanel.astro): 1x, 5x or 10x, full screen, and a
// new town, made from a seed of its own in place of the day's.
import { centre, dayOf, DX, DY, EW, H as ROWS, homesOf, N, newTown, OUT, placesOf, RAMP, RING_R, roadChains, samples, seeded, step, W as COLS, xOf, yOf } from '../lib/town/map.js';
import { build, change } from '../lib/town/growth.js';
import { CAR_L, CAR_W } from '../lib/town/roads.js';
import { startTraffic, STEP } from '../lib/town/traffic.js';
import { boxOf, cloudOf, FADE as BUBBLE_FADE, goingSomewhere, startThoughts } from '../lib/town/thoughts.js';

/** @typedef {import('../lib/town/map.js').Home} Home @typedef {import('../lib/town/map.js').Place} Place
 *  @typedef {import('../lib/town/map.js').Building} Building @typedef {number[]} Rgb @typedef {[number, number][]} Pts
 *  @typedef {import('../lib/town/thoughts.js').Bubble} Bubble @typedef {import('../lib/town/traffic.js').Car} Car
 *  @typedef {import('../lib/town/map.js').Town} Town */

/** The town's colours, each from its --town-* token; the five colours of homes, buildings and cars in the town's order. */
const NAMES = ['ground', 'lawn', 'park', 'bank', 'wet', 'water', 'water-deep', 'wave', 'road', 'kerb', 'concrete', 'rail', 'pillar', 'tree', 'tree-top', 'palm', 'palm-top', 'trunk', 'dust', 'red', 'blue', 'purple', 'white', 'orange', 'window', 'flash', 'shadow', 'glass', 'brake', 'bubble', 'bubble-edge'];
const COLOURS = ['red', 'blue', 'purple', 'white', 'orange'];
/** The aurora's colours, there only under the night sky. */
const AURORA = ['aurora-1', 'aurora-2', 'aurora-3'];
/** Town minutes a second at 1x. */
const PACE = 1.5;
/** Town minutes between changes, on average (about two minutes at 1x); and, for a town shown all at once (with less
 *  motion asked for), town minutes of traffic worked out unseen first, so cars are about. */
const EVERY = 180, WARM = 30;
/** The town's days, for its chip. */
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
/** Seconds the town takes to fade from day to night or back. */
const FADE = 2;
/** It fades by itself, so it stays live while the theme's circle crosses the page (stage.js). */
export const options = { fades: true };
/** The pop of something new: up past its size, back under, and settling, in 0.8 s. */
const POP = [[0, 0], [0.16, 1.34], [0.32, 0.86], [0.48, 1.08], [0.64, 0.97], [0.8, 1]];
/** A thought cloud's puffs round its middle (x, y and radius, as parts of its width): a ring of them and one in the
 *  middle. */
const PUFFS = [...Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + 0.2;
  return [Math.cos(a) * 0.33, Math.sin(a) * 0.17, 0.15];
}), [0, 0, 0.21]];
/** How a cloud puffs out: past its size a little, then back. @param {number} t from 0 to 1 */
const puffOut = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
/** How near a click or a tap has to be to a car to pick it, in pixels. */
const SLACK = 12;

/** @param {Rgb} a @param {Rgb} b @param {number} t @returns {Rgb} */
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
/** @param {Rgb} c */
const css = (c, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
/** @param {Rgb} c @param {number} t */
const lighter = (c, t) => css(mix(c, [255, 255, 255], t));
/** @param {Rgb} c @param {number} t */
const darker = (c, t) => css(mix(c, [0, 0, 0], t));
/** @param {number} born @param {number} now */
function popOf(born, now) {
  const t = now - born;
  if (t <= 0) return 0;
  if (t >= 0.8) return 1;
  for (let k = 1; k < POP.length; k++) {
    if (t > POP[k][0]) continue;
    const [t0, v0] = POP[k - 1], [t1, v1] = POP[k], u = (t - t0) / (t1 - t0);
    return v0 + (v1 - v0) * u * u * (3 - 2 * u);
  }
  return 1;
}
/** A flash of light over something just built, for its first 0.3 s. @param {number} born @param {number} now */
const flashOf = (born, now) => { const t = now - born; return t > 0 && t < 0.3 ? 1 - t / 0.3 : 0; };
/** Where shadows fall, per tile of height, at town minute `clock`: the sun swings slowly with the town clock, long
 *  shadows reaching left in the morning, shortest at noon, falling more straight down by evening. @param {number} clock */
function sunAt(clock) {
  const h = (clock / 60) % 24, c = Math.cos((Math.PI * (h - 6)) / 12);
  const angle = ((129 + 28 * c) * Math.PI) / 180, length = 0.8 + 0.2 * Math.abs(c);
  return [Math.cos(angle) * length, Math.sin(angle) * length];
}
/** @param {Pts} points */
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (/** @type {number[]} */ o, /** @type {number[]} */ a, /** @type {number[]} */ b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  /** @type {Pts} */ const lower = [];
  /** @type {Pts} */ const upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
/** @param {Pts} pts @param {number} cx @param {number} cy @param {number} k @returns {Pts} */
const scaled = (pts, cx, cy, k) => pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
/** A canvas of its own, for a picture drawn once. @param {number} w @param {number} h */
function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return { c, g: /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')) };
}

/** @param {import('../effects/stage.js').Stage} stage */
export default function town(stage) {
  const { ctx } = stage;
  const taster = /** @type {CanvasRenderingContext2D} */ (document.createElement('canvas').getContext('2d'));
  /** @param {string} value @returns {Rgb | null} */
  const rgbOf = (value) => {
    if (!value.trim()) return null;
    taster.fillStyle = '#808080';
    taster.fillStyle = value.trim();
    const set = String(taster.fillStyle);
    if (set[0] === '#') return [1, 3, 5].map((i) => parseInt(set.slice(i, i + 2), 16));
    return (set.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  };
  /** The theme's colours as its tokens give them, and the aurora's when there is one; `C` is what each frame draws
   *  with, which differs from them only while the town fades from one theme to the other. @type {Record<string, Rgb>} */
  let target = {};
  /** @type {Record<string, Rgb>} */
  let C = {};
  /** @type {Rgb[]} */
  let aurora = [];
  let colorsSeen = stage.colors;
  /** Night is the dark theme, the night sky included. */
  const isNight = () => document.documentElement.dataset.theme === 'dark';
  let nightTo = isNight();
  /** How far into night the frame being drawn is: 0 by day, 1 by night, in between while fading. */
  let night = nightTo ? 1 : 0;
  const readTokens = () => {
    const style = getComputedStyle(ctx.canvas);
    target = Object.fromEntries(NAMES.map((n) => [n, rgbOf(style.getPropertyValue(`--town-${n}`)) ?? [128, 128, 128]]));
    aurora = /** @type {Rgb[]} */ (AURORA.map((n) => rgbOf(style.getPropertyValue(`--town-${n}`))).filter(Boolean));
  };

  // The day's town (or the one the page's New town button made), its traffic, its changes and its cars' thoughts: all
  // started by startTown, below.
  const { seed: daySeed, weekday } = dayOf(new Date());
  /** @type {Town} */
  let T;
  /** @type {ReturnType<typeof startTraffic>} */
  let traffic;
  /** @type {ReturnType<typeof startThoughts>} */
  let thoughts;
  /** @type {() => number} */
  let timing;
  let nextChange = 0;
  /** When the town has finished building itself: its traffic waits till then. */
  let buildEnd = -Infinity;
  /** Town minutes a second: 1x, 5x or 10x PACE, as the page's speed buttons say. */
  let pace = PACE;
  let acc = 0;
  /** Rings where something changed with no building of its own (a road, a roundabout). @type {{ x: number, y: number, born: number }[]} */
  let pulses = [];

  /** The size the town is drawn at, the stage's own or, on a tall stage, turned a quarter round. */
  let W = 1, H = 1, turned = false, density = 1, S = 1, OX = 0, OY = 0;
  let layer = canvasOf(1, 1), behind = canvasOf(1, 1), shade = canvasOf(1, 1), glow = canvasOf(1, 1), fade = canvasOf(1, 1);
  const X = (/** @type {number} */ x) => OX + x * S;
  const Y = (/** @type {number} */ y) => OY + y * S;
  /** Where a point of the town is on the stage, in pixels: turned with the town on a tall stage.
   *  @param {number} x @param {number} y @returns {[number, number]} */
  const toStage = (x, y) => (turned ? [stage.width - Y(y), X(x)] : [X(x), Y(y)]);
  /** How wide a thought cloud is on the stage, in pixels: as big as a tile and a bit, and never too small to read. */
  const cloudPx = () => Math.max(44, 1.1 * S);
  /** How far down the stage the page's buttons along its top reach, in pixels. */
  const buttonsReach = () => {
    const st = ctx.canvas.closest('[data-stage]'), row = st?.querySelector('.controls');
    return st && row ? row.getBoundingClientRect().bottom - st.getBoundingClientRect().top : 0;
  };
  /** Where shadows fall now, in the town's own terms: on a turned town the sun turns too, so shadows fall the same
   *  way on every screen. */
  const sunNow = () => { const [x, y] = sunAt(traffic.clock); return turned ? [y, -x] : [x, y]; };
  let SUN = [0, 0];
  let dirty = true, animEnd = 0;
  /** While fading between day and night: the colours being left, how far into night they were, and when it began. */
  /** @type {{ C: Record<string, Rgb>, night: number, start: number } | null} */
  let fading = null;

  // ---- What stays still.

  /** @type {Map<number, { palm?: boolean, x: number, y: number, r?: number }[]>} */
  const treeCache = new Map();
  /** The trees on tile `i`: a palm, or round trees in a clump. @param {number} i */
  function treeSpots(i) {
    const key = i * 4 + T.trees[i];
    let out = treeCache.get(key);
    if (!out) {
      const r = seeded(key * 7919 + T.seed);
      const [cx, cy] = centre(i);
      out = [];
      if (r() < 0.22) out.push({ palm: true, x: cx + (r() - 0.5) * 0.3, y: cy + (r() - 0.5) * 0.3 });
      else for (let k = 0; k < T.trees[i]; k++) out.push({ x: cx + (r() - 0.5) * 0.56, y: cy + (r() - 0.5) * 0.56, r: 0.2 + r() * 0.12 });
      treeCache.set(key, out);
    }
    return out;
  }
  /** @param {CanvasRenderingContext2D} g @param {Record<string, Rgb>} P @param {number} px @param {number} py */
  function palm(g, P, px, py, size = 1) {
    const r = seeded(Math.round(px * 131 + py * 71));
    const turn = r() * Math.PI;
    for (let i = 0; i < 7; i++) {
      const a = turn + (i / 7) * Math.PI * 2, len = (0.36 + r() * 0.08) * size;
      const tip = [px + Math.cos(a) * len, py + Math.sin(a) * len];
      const side = [-Math.sin(a) * 0.09 * size, Math.cos(a) * 0.09 * size];
      g.fillStyle = css(i % 2 ? P.palm : P['palm-top']);
      g.beginPath();
      g.moveTo(X(px), Y(py));
      g.quadraticCurveTo(X(px + Math.cos(a) * len * 0.55 + side[0]), Y(py + Math.sin(a) * len * 0.55 + side[1]), X(tip[0]), Y(tip[1]));
      g.quadraticCurveTo(X(px + Math.cos(a) * len * 0.55 - side[0]), Y(py + Math.sin(a) * len * 0.55 - side[1]), X(px), Y(py));
      g.fill();
    }
    g.fillStyle = css(P.trunk);
    g.beginPath(); g.arc(X(px), Y(py), 0.06 * size * S, 0, Math.PI * 2); g.fill();
  }
  /** The river as drawn, `per` points between each two of its own (which are 1.5 tiles apart) and running on straight
   *  past both ends of the map with points `gap` apart, as far as the roads out: never ending in sight, as the stage
   *  is never taller than wide in the town's own terms (a tall one turns it). The run-on is added after the curve is
   *  worked out, not before: a far point would bend the river's ends. @param {number} per @param {number} gap
   *  @returns {Pts} */
  const riverDrawn = (per, gap) => {
    const r = T.river, n = r.length;
    /** @param {number[]} a @param {number[]} b @returns {Pts} */
    const on = (a, b) => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return Array.from({ length: Math.round(OUT / gap) }, (_, k) => [b[0] + ((b[0] - a[0]) / l) * (k + 1) * gap, b[1] + ((b[1] - a[1]) / l) * (k + 1) * gap]);
    };
    return [...on(r[1], r[0]).reverse(), ...samples(r, per), ...on(r[n - 2], r[n - 1])];
  };
  /** The river's still parts: sand banks, a wetter edge, the water and its deep middle. @param {CanvasRenderingContext2D} g
   *  @param {Record<string, Rgb>} P */
  function drawRiver(g, P) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const line = riverDrawn(12, 0.5);
    const path = () => { g.beginPath(); line.forEach(([x, y], k) => (k ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); };
    for (const [colour, width] of /** @type {[Rgb, number][]} */ ([[P.bank, 2.5], [P.wet, 1.95], [P.water, 1.7]])) { path(); g.strokeStyle = css(colour); g.lineWidth = width * S; g.stroke(); }
    path(); g.strokeStyle = css(P['water-deep']); g.lineWidth = 0.5 * S; g.stroke();
  }
  /** The bridges' decks over the water, as rectangles. @param {(i: number) => boolean} seen */
  function bridgeRuns(seen) {
    const runs = [];
    const done = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (!seen(i) || !T.wet[i] || done[i]) continue;
      const ew = (T.road[i] & EW) !== 0;
      const fwd = ew ? 1 : 2, back = ew ? 3 : 0;
      let a = i;
      for (let k = step(a, back); k >= 0 && seen(k) && T.wet[k]; k = step(a, back)) a = k;
      const tiles = [];
      for (let k = a; k >= 0 && seen(k) && T.wet[k]; k = step(k, fwd)) { tiles.push(k); done[k] = 1; }
      const [x0, y0] = centre(tiles[0]), [x1, y1] = centre(tiles[tiles.length - 1]);
      runs.push(ew ? { x: x0 - 0.62, y: y0 - 0.46, w: x1 - x0 + 1.24, h: 0.92, ew } : { x: x0 - 0.46, y: y0 - 0.62, w: 0.92, h: y1 - y0 + 1.24, ew });
    }
    return runs;
  }
  /** A home's walls, the way it faces. @param {Home} b @returns {Pts} */
  function houseBody(b) {
    const [cx, cy] = centre(b.tile);
    const w = 0.6, h = 0.52;
    return b.face === 1 || b.face === 3
      ? [[cx - h / 2, cy - w / 2], [cx + h / 2, cy - w / 2], [cx + h / 2, cy + w / 2], [cx - h / 2, cy + w / 2]]
      : [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
  }
  /** A home's lawn; and, for a home that's going (the drives are part of the roads otherwise), its drive.
   *  @param {CanvasRenderingContext2D} g @param {Record<string, Rgb>} P @param {Home} b @param {number} k */
  function drawLawn(g, P, b, k, alpha = 1, drive = false) {
    const [cx, cy] = centre(b.tile);
    g.save(); g.globalAlpha = alpha;
    g.fillStyle = css(P.lawn);
    g.beginPath(); g.roundRect(X(cx - 0.47 * k), Y(cy - 0.47 * k), 0.94 * k * S, 0.94 * k * S, 0.16 * k * S); g.fill();
    if (drive) { g.strokeStyle = css(P.road); g.lineWidth = 0.22 * S; g.lineCap = 'butt'; driveOf(g, b); g.stroke(); }
    g.restore();
  }
  /** A home's drive as a path: from inside its road's tarmac to the house's front. @param {CanvasRenderingContext2D} g @param {Home} b */
  function driveOf(g, b) {
    const [rx, ry] = centre(b.front), rh = (b.face + 2) % 4;
    g.beginPath(); g.moveTo(X(rx + DX[rh] * 0.25), Y(ry + DY[rh] * 0.25)); g.lineTo(X(rx + DX[rh] * 0.75), Y(ry + DY[rh] * 0.75));
  }
  /** @param {CanvasRenderingContext2D} g @param {Record<string, Rgb>} P @param {boolean} lit @param {Home} b @param {number} k */
  function drawHouse(g, P, lit, b, k, alpha = 1, flash = 0) {
    const top = P[COLOURS[b.colour]];
    const [cx, cy] = centre(b.tile);
    g.save();
    g.globalAlpha = alpha;
    g.translate(X(cx), Y(cy));
    if (b.face === 1 || b.face === 3) g.rotate(Math.PI / 2);
    g.scale(k, k);
    const w = 0.6 * S, h = 0.52 * S;
    g.fillStyle = darker(top, 0.24); g.fillRect(-w / 2, 0, w, h / 2);
    g.fillStyle = lighter(top, 0.08); g.fillRect(-w / 2, -h / 2, w, h / 2);
    g.fillStyle = darker(top, 0.36); g.fillRect(-w / 2, -0.012 * S, w, 0.024 * S);
    g.fillStyle = darker(top, 0.4); g.fillRect(w * 0.22, -h * 0.42, 0.09 * S, 0.11 * S);
    if (lit) { g.fillStyle = css(P.window); g.globalAlpha = 0.9 * alpha; g.fillRect(-w * 0.28, h / 2 - 0.06 * S, 0.1 * S, 0.05 * S); g.fillRect(w * 0.08, h / 2 - 0.06 * S, 0.1 * S, 0.05 * S); }
    if (flash) { g.globalAlpha = flash * 0.7; g.fillStyle = css(P.flash); g.fillRect(-w / 2, -h / 2, w, h); }
    g.restore();
  }
  /** A car park's paving, out into the tarmac of the road beyond it, so the two run into each other. @param {Place} p */
  function lotRect(p) {
    const xs = p.lot.map(xOf), ys = p.lot.map(yOf);
    let x0 = Math.min(...xs) + 0.06, y0 = Math.min(...ys) + 0.06, x1 = Math.max(...xs) + 0.94, y1 = Math.max(...ys) + 0.94;
    if (p.o === 0) y0 -= 0.32; else if (p.o === 2) y1 += 0.32; else if (p.o === 1) x1 += 0.32; else x0 -= 0.32;
    return { x0, y0, x1, y1 };
  }
  /** A car park as a path, `out` wider all round. @param {CanvasRenderingContext2D} g @param {Place} p */
  function lotOf(g, p, out = 0) {
    const { x0, y0, x1, y1 } = lotRect(p);
    g.beginPath(); g.roundRect(X(x0 - out), Y(y0 - out), (x1 - x0 + 2 * out) * S, (y1 - y0 + 2 * out) * S, (0.16 + out) * S);
  }
  /** A car park's bays painted on it; for a building that's going, its paving too, shrinking away with it.
   *  @param {CanvasRenderingContext2D} g @param {Record<string, Rgb>} P @param {Place} p @param {number} k */
  function drawLot(g, P, p, k, alpha = 1, paving = false) {
    const { x0, y0, x1, y1 } = lotRect(p);
    g.save();
    g.globalAlpha = alpha;
    g.translate(X(p.cx), Y(p.cy)); g.scale(k, k); g.translate(-X(p.cx), -Y(p.cy));
    if (paving) { g.fillStyle = css(P.road); lotOf(g, p); g.fill(); }
    g.strokeStyle = css(P.kerb); g.globalAlpha = 0.75 * alpha; g.lineWidth = 0.035 * S;
    const along = p.o === 0 || p.o === 2;
    for (let m = 1; m < 4; m++) {
      g.beginPath();
      if (along) { const x = Math.min(...p.lot.map(xOf)) + m * 0.5, yb = p.o === 2 ? y0 : y1, dir = p.o === 2 ? 1 : -1; g.moveTo(X(x), Y(yb + dir * 0.06)); g.lineTo(X(x), Y(yb + dir * 0.58)); }
      else { const y = Math.min(...p.lot.map(yOf)) + m * 0.5, xb = p.o === 1 ? x0 : x1, dir = p.o === 1 ? 1 : -1; g.moveTo(X(xb + dir * 0.06), Y(y)); g.lineTo(X(xb + dir * 0.58), Y(y)); }
      g.stroke();
    }
    g.restore();
  }
  /** What's on a building's roof, the same every time it's drawn: which of the roofs it has, and which of its lights
   *  are on by night (most of them). @type {Map<number, { kind: number, on: boolean[] }>} */
  const roofs = new Map();
  /** @param {Place} p */
  function roofOf(p) {
    let roof = roofs.get(p.id);
    if (!roof) {
      const r = seeded(p.id * 7919 + T.seed);
      roof = { kind: Math.floor(r() * 6), on: Array.from({ length: 12 }, () => r() < 0.75) };
      roofs.set(p.id, roof);
    }
    return roof;
  }
  /** A big building from above: a parapet round a flat roof, and on the roof one of six things, so no two streets look
   *  the same: a skylight and two rows of lights; a grid of lights; a garden with trees; solar panels; plant boxes with
   *  fans by a long skylight; a round water tank. Its lights are lit by night, most of them.
   *  @param {CanvasRenderingContext2D} g @param {Record<string, Rgb>} P @param {boolean} lit @param {Place} p @param {number} k */
  function drawPlace(g, P, lit, p, k, alpha = 1, flash = 0) {
    const top = P[COLOURS[p.colour]];
    const x = p.bx + 0.05, y = p.by + 0.05, rx = x + 0.11, ry = y + 0.11, R = 1.68;
    const { kind, on } = roofOf(p);
    g.save();
    g.globalAlpha = alpha;
    g.translate(X(p.cx), Y(p.cy)); g.scale(k, k); g.translate(-X(p.cx), -Y(p.cy));
    g.fillStyle = darker(top, 0.18); g.beginPath(); g.roundRect(X(x), Y(y), 1.9 * S, 1.9 * S, 0.16 * S); g.fill();
    g.fillStyle = css(top); g.beginPath(); g.roundRect(X(rx), Y(ry), R * S, R * S, 0.09 * S); g.fill();
    /** A rectangle on the roof, in parts of the roof's side. @param {number} u @param {number} v @param {number} w @param {number} h */
    const box = (u, v, w, h) => g.fillRect(X(rx + u * R), Y(ry + v * R), w * R * S, h * R * S);
    /** @param {number} u @param {number} v @param {number} r */
    const disc = (u, v, r) => { g.beginPath(); g.arc(X(rx + u * R), Y(ry + v * R), r * R * S, 0, Math.PI * 2); g.fill(); };
    /** A grid of lights over part of the roof, each lit by night or not. @param {number} cols @param {number} rows
     *  @param {number} u0 @param {number} v0 @param {number} u1 @param {number} v1 */
    const lights = (cols, rows, u0, v0, u1, v1) => {
      const w = (u1 - u0) / cols, h = (v1 - v0) / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const n = r * cols + c, shine = lit && on[n % on.length];
        g.fillStyle = shine ? css(P.window) : lit ? darker(top, 0.3) : lighter(top, 0.45);
        g.globalAlpha = (shine ? 0.85 : 1) * alpha;
        box(u0 + c * w + w * 0.18, v0 + r * h + h * 0.2, w * 0.64, h * 0.6);
      }
      g.globalAlpha = alpha;
    };
    if (kind === 0) {
      g.fillStyle = darker(top, 0.3); box(0.13, 0.13, 0.29, 0.22);
      g.fillStyle = lighter(top, 0.25); box(0.13, 0.13, 0.29, 0.18);
      lights(3, 2, 0.08, 0.5, 0.92, 0.9);
    } else if (kind === 1) {
      lights(4, 3, 0.08, 0.1, 0.92, 0.9);
    } else if (kind === 2) {
      g.fillStyle = css(P.park); g.beginPath(); g.roundRect(X(rx + 0.1 * R), Y(ry + 0.1 * R), 0.8 * R * S, 0.42 * R * S, 0.08 * S); g.fill();
      for (const [u, v, r] of [[0.27, 0.3, 0.1], [0.5, 0.25, 0.08], [0.72, 0.32, 0.11]]) {
        g.fillStyle = css(P.tree); disc(u, v, r);
        g.fillStyle = css(P['tree-top']); disc(u + r * 0.2, v - r * 0.22, r * 0.6);
      }
      lights(4, 1, 0.08, 0.66, 0.92, 0.9);
    } else if (kind === 3) {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        g.fillStyle = css(P.glass); box(0.1 + c * 0.42, 0.1 + r * 0.22, 0.38, 0.18);
        g.fillStyle = lighter(P.glass, 0.25); box(0.1 + c * 0.42 + 0.185, 0.1 + r * 0.22, 0.01, 0.18); box(0.1 + c * 0.42, 0.1 + r * 0.22 + 0.085, 0.38, 0.01);
      }
      lights(3, 1, 0.08, 0.64, 0.92, 0.9);
    } else if (kind === 4) {
      for (const u of [0.12, 0.4, 0.68]) {
        g.fillStyle = darker(top, 0.32); box(u, 0.1, 0.2, 0.2);
        g.fillStyle = lighter(top, 0.2); disc(u + 0.1, 0.2, 0.065);
      }
      g.fillStyle = lighter(top, 0.3); box(0.1, 0.42, 0.8, 0.12);
      lights(4, 1, 0.08, 0.64, 0.92, 0.9);
    } else {
      g.fillStyle = darker(P.concrete, 0.25); disc(0.7, 0.3, 0.17);
      g.fillStyle = css(P.concrete); disc(0.7, 0.3, 0.13);
      g.fillStyle = lighter(top, 0.25); box(0.1, 0.12, 0.38, 0.12);
      lights(2, 2, 0.08, 0.5, 0.58, 0.9);
    }
    if (flash) { g.globalAlpha = flash * 0.7; g.fillStyle = css(P.flash); g.beginPath(); g.roundRect(X(x), Y(y), 1.9 * S, 1.9 * S, 0.16 * S); g.fill(); }
    g.restore();
  }
  /** The shadow of a box with these corners and this height: the box swept along the sun's way.
   *  @param {CanvasRenderingContext2D} g @param {Pts} corners @param {number} height */
  function shadowOf(g, corners, height) {
    const pts = hull([...corners, ...corners.map(([x, y]) => /** @type {[number, number]} */ ([x + SUN[0] * height, y + SUN[1] * height]))]);
    g.beginPath();
    pts.forEach(([x, y], k) => (k ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
    g.closePath();
    g.fill();
  }

  /** Everything that stays still, into `layer`, in the theme's own colours, at the moment `now`. @param {number} now */
  function drawStill(now) {
    const P = target, lit = nightTo, g = layer.g;
    g.setTransform(density, 0, 0, density, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = css(P.ground);
    g.fillRect(0, 0, W, H);
    drawRiver(g, P);
    const seen = (/** @type {number} */ i) => T.isRoad[i] === 1 && T.born[i] <= now;
    const ringOn = (/** @type {number} */ i) => T.ring[i] === 1 && T.ringBorn[i] <= now;
    const chains = roadChains(T, seen, undefined, ringOn);
    const bridges = bridgeRuns(seen);
    const homes = homesOf(T), places = placesOf(T);
    // Bridge decks over the water, their shadows first.
    g.save(); g.globalAlpha = lit ? 0.45 : 0.22; g.fillStyle = css(P.shadow);
    for (const b of bridges) { g.beginPath(); g.roundRect(X(b.x + SUN[0] * 0.4), Y(b.y + SUN[1] * 0.4), b.w * S, b.h * S, 0.08 * S); g.fill(); }
    g.restore();
    g.fillStyle = css(P.concrete);
    for (const b of bridges) { g.beginPath(); g.roundRect(X(b.x), Y(b.y), b.w * S, b.h * S, 0.08 * S); g.fill(); }
    for (const b of homes) { const k = popOf(b.born, now); if (k > 0) drawLawn(g, P, b, Math.min(1, k)); }
    // Roads: a pale kerb either side, the tarmac, a dashed middle line; roundabouts round a grass island and a palm.
    const rings = [];
    for (let i = 0; i < N; i++) if (ringOn(i) && seen(i)) rings.push(i);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const all = (/** @type {() => void} */ fn) => {
      for (const ch of chains) {
        g.beginPath();
        g.moveTo(X(ch.pts[0][0]), Y(ch.pts[0][1]));
        for (let k = 1; k < ch.pts.length - 1; k++) g.arcTo(X(ch.pts[k][0]), Y(ch.pts[k][1]), X(ch.pts[k + 1][0]), Y(ch.pts[k + 1][1]), ch.radii[k] * S);
        const end = ch.pts[ch.pts.length - 1];
        g.lineTo(X(end[0]), Y(end[1]));
        fn();
      }
      for (const c of rings) { const [x, y] = centre(c); g.beginPath(); g.arc(X(x), Y(y), RING_R * S, 0, Math.PI * 2); fn(); }
      // The flyover's feet: a stretch of road off the junction at each end, where its ramp rises from.
      const f = T.flyover;
      if (f && f.born <= now) {
        for (const [e, d] of [[f.a, f.da], [f.b, f.db]]) {
          if (!seen(e)) continue;
          const [x, y] = centre(e);
          g.beginPath(); g.moveTo(X(x), Y(y)); g.lineTo(X(x + DX[d] * 0.5), Y(y + DY[d] * 0.5)); fn();
        }
      }
    };
    // The homes' drives and the car parks are road too: drawn with the roads, kerb first and then tarmac, so one kerb
    // runs round road, drive and car park alike, and the tarmac runs from one into the other.
    const yards = (/** @type {Rgb} */ colour, /** @type {number} */ out) => {
      g.save();
      g.strokeStyle = css(colour); g.fillStyle = css(colour); g.lineCap = 'butt'; g.lineWidth = (0.22 + 2 * out) * S;
      for (const b of homes) if (popOf(b.born, now) > 0) { driveOf(g, b); g.stroke(); }
      for (const p of places) if (popOf(p.born, now) > 0) { lotOf(g, p, out); g.fill(); }
      g.restore();
    };
    all(() => { g.strokeStyle = css(P.kerb); g.lineWidth = 0.68 * S; g.stroke(); });
    yards(P.kerb, 0.05);
    all(() => { g.strokeStyle = css(P.road); g.lineWidth = 0.58 * S; g.stroke(); });
    yards(P.road, 0);
    g.save();
    g.setLineDash([0.22 * S, 0.2 * S]); g.globalAlpha = 0.7;
    all(() => { g.strokeStyle = css(P.kerb); g.lineWidth = 0.035 * S; g.stroke(); });
    g.restore();
    for (const c of rings) {
      const [x, y] = centre(c), k = popOf(T.ringBorn[c], now);
      g.fillStyle = css(P.park); g.beginPath(); g.arc(X(x), Y(y), (RING_R - 0.34) * Math.max(0.05, Math.min(1.2, k)) * S, 0, Math.PI * 2); g.fill();
      if (k > 0.6) palm(g, P, x, y, 0.75 * Math.min(1.2, k));
    }
    for (const p of places) { const k = popOf(p.born, now); if (k > 0) drawLot(g, P, p, Math.min(1, k)); }
    // Posts along the bridges.
    g.save();
    g.strokeStyle = css(P.rail); g.lineWidth = 0.07 * S; g.setLineDash([0.07 * S, 0.17 * S]); g.lineCap = 'butt';
    for (const b of bridges) for (const side of [-1, 1]) {
      g.beginPath();
      if (b.ew) { const y = b.y + b.h / 2 + side * 0.42; g.moveTo(X(b.x + 0.06), Y(y)); g.lineTo(X(b.x + b.w - 0.06), Y(y)); }
      else { const x = b.x + b.w / 2 + side * 0.42; g.moveTo(X(x), Y(b.y + 0.06)); g.lineTo(X(x), Y(b.y + b.h - 0.06)); }
      g.stroke();
    }
    g.restore();
    // Short crisp shadows along the sun's way, on a layer of their own laid over everything below.
    const sg = shade.g;
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, shade.c.width, shade.c.height);
    sg.setTransform(density, 0, 0, density, 0, 0);
    sg.fillStyle = css(P.shadow); sg.strokeStyle = css(P.shadow); sg.lineCap = 'round';
    for (const b of homes) { const k = popOf(b.born, now); if (k <= 0) continue; const [cx, cy] = centre(b.tile); shadowOf(sg, scaled(houseBody(b), cx, cy, k), 0.42 * k); }
    for (const p of places) { const k = popOf(p.born, now); if (k <= 0) continue; const x = p.bx + 0.05, y = p.by + 0.05; shadowOf(sg, scaled([[x, y], [x + 1.9, y], [x + 1.9, y + 1.9], [x, y + 1.9]], p.cx, p.cy, k), 0.95 * k); }
    for (let i = 0; i < N; i++) {
      if (!T.trees[i] || T.isRoad[i] || T.use[i] >= 0 || T.ring[i]) continue;
      for (const t of treeSpots(i)) {
        const r = t.palm ? 0.3 : t.r ?? 0.2, h = t.palm ? 0.7 : 0.5;
        sg.lineWidth = 2 * r * S;
        sg.beginPath(); sg.moveTo(X(t.x), Y(t.y)); sg.lineTo(X(t.x + SUN[0] * h), Y(t.y + SUN[1] * h)); sg.stroke();
      }
    }
    g.save();
    g.globalAlpha = lit ? 0.5 : 0.2;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(shade.c, 0, 0);
    g.restore();
    for (let i = 0; i < N; i++) {
      if (!T.trees[i] || T.isRoad[i] || T.use[i] >= 0 || T.ring[i]) continue;
      for (const t of treeSpots(i)) {
        if (t.palm) { palm(g, P, t.x, t.y, 0.85); continue; }
        const r = t.r ?? 0.2;
        g.fillStyle = css(P.tree); g.beginPath(); g.arc(X(t.x), Y(t.y), r * S, 0, Math.PI * 2); g.fill();
        g.fillStyle = css(P['tree-top']); g.beginPath(); g.arc(X(t.x + r * 0.2), Y(t.y - r * 0.22), r * 0.6 * S, 0, Math.PI * 2); g.fill();
      }
    }
    for (const b of homes) { const k = popOf(b.born, now); if (k > 0) drawHouse(g, P, lit, b, k, 1, flashOf(b.born, now)); }
    for (const p of places) { const k = popOf(p.born, now); if (k > 0) drawPlace(g, P, lit, p, k, 1, flashOf(p.born, now)); }
    // What's going: squashing and shrinking away.
    T.ghosts = T.ghosts.filter((gh) => now - gh.died < 0.9);
    for (const gh of T.ghosts) {
      const t = Math.max(0, (now - gh.died) / 0.6);
      if (t >= 1) continue;
      const a = 1 - t, k = t < 0.2 ? 1 + t * 0.6 : ((1 - t) * 1.12) / 0.8;
      if (gh.kind === 'road') {
        const [x, y] = centre(gh.i);
        g.save(); g.globalAlpha = a; g.lineCap = 'round';
        for (const [colour, width] of /** @type {[Rgb, number][]} */ ([[P.kerb, 0.68], [P.road, 0.58]])) {
          g.strokeStyle = css(colour); g.lineWidth = width * S;
          for (let d = 0; d < 4; d++) if ((gh.mask >> d) & 1 || gh.gate === d) { g.beginPath(); g.moveTo(X(x), Y(y)); g.lineTo(X(x + DX[d] * 0.5), Y(y + DY[d] * 0.5)); g.stroke(); }
        }
        g.restore();
      } else if (gh.b.kind === 'home') { drawLawn(g, P, gh.b, Math.min(1, k), a, true); drawHouse(g, P, lit, gh.b, k, a); }
      else { drawLot(g, P, gh.b, k, a, true); drawPlace(g, P, lit, gh.b, k, a); }
    }
  }

  // ---- What moves.

  /** The river's line, measured, and two streaks either side of its middle, for its flow; and three bands along it,
   *  more coarsely, for the aurora. */
  const flowOf = () => {
    /** @param {Pts} line @param {number} d */
    const offset = (line, d) => line.map(([x, y], k) => {
      const a = line[Math.max(0, k - 1)], b = line[Math.min(line.length - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return /** @type {[number, number]} */ ([x - ((b[1] - a[1]) / l) * d, y + ((b[0] - a[0]) / l) * d]);
    });
    /** @param {Pts} line */
    const lengths = (line) => line.reduce((out, p, k) => { out.push(k ? out[k - 1] + Math.hypot(p[0] - line[k - 1][0], p[1] - line[k - 1][1]) : 0); return out; }, /** @type {number[]} */ ([]));
    const line = riverDrawn(30, 0.25), coarse = riverDrawn(12, 0.125);
    return { line, lens: lengths(line), streaks: [offset(line, -0.38), offset(line, 0.33)], bands: [-0.42, 0, 0.42].map((d) => offset(coarse, d)), bandLens: lengths(coarse) };
  };
  /** @type {ReturnType<typeof flowOf>} */
  let flow;
  /** The river flowing: light streaks drifting downstream and little waves riding along, coming and going; kept off the
   *  bridges. Under the night sky, the aurora shimmering on it. @param {number} t */
  function drawFlow(t) {
    const { line, lens, streaks, bands, bandLens } = flow;
    const g = ctx;
    g.save();
    g.beginPath();
    g.rect(0, 0, W, H);
    for (const b of bridgeRuns((i) => T.isRoad[i] === 1 && T.born[i] <= t)) g.rect(X(b.x), Y(b.y), b.w * S, b.h * S);
    g.clip('evenodd');
    if (aurora.length && night > 0.01) {
      // Faint bands of the aurora's colours along the water, brightening and dimming as they drift downstream: drawn
      // small and stretched up, which softens them into a glow.
      const k6 = 1 / 6;
      if (glow.c.width !== Math.ceil(W * k6) || glow.c.height !== Math.ceil(H * k6)) glow = canvasOf(Math.ceil(W * k6), Math.ceil(H * k6));
      glow.g.setTransform(1, 0, 0, 1, 0, 0);
      glow.g.clearRect(0, 0, glow.c.width, glow.c.height);
      glow.g.setTransform(k6, 0, 0, k6, 0, 0);
      const b = glow.g;
      b.lineCap = 'butt';
      // Only what's on the stage, give or take a tile.
      const x0 = -OX / S - 1, x1 = (W - OX) / S + 1, y0 = -OY / S - 1, y1 = (H - OY) / S + 1;
      bands.forEach((band, k) => {
        b.strokeStyle = css(aurora[k % aurora.length]);
        b.lineWidth = 0.55 * S;
        for (let n = 1; n < band.length; n++) {
          const [px, py] = band[n];
          if (px < x0 || px > x1 || py < y0 || py > y1) continue;
          const wave = Math.sin(bandLens[n] * 1.1 - t * (0.3 + k * 0.07) + k * 2.1) * 0.5 + 0.5;
          b.globalAlpha = wave * wave;
          b.beginPath(); b.moveTo(X(band[n - 1][0]), Y(band[n - 1][1])); b.lineTo(X(band[n][0]), Y(band[n][1])); b.stroke();
        }
      });
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.3 * night;
      g.imageSmoothingEnabled = true;
      g.drawImage(glow.c, 0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }
    g.lineCap = 'round';
    g.strokeStyle = css(C.wave);
    g.lineWidth = 0.06 * S;
    g.globalAlpha = 0.3 - 0.08 * night;
    g.setLineDash([0.35 * S, 0.95 * S]);
    streaks.forEach((s, k) => {
      g.lineDashOffset = -(t * (0.3 + k * 0.06)) * S;
      g.beginPath();
      s.forEach(([x, y], n) => (n ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
      g.stroke();
    });
    g.setLineDash([]);
    const total = lens[lens.length - 1];
    const wr = seeded(4242 + T.seed);
    // Which way is level and which is up on the screen, in the town's own terms.
    const [ax, ay] = turned ? [0, -1] : [1, 0], [bx, by] = turned ? [-1, 0] : [0, -1];
    g.lineWidth = 0.05 * S;
    for (let w = 0; w < total * 0.75; w++) {
      const start = wr(), across = wr() - 0.5, beat = wr();
      const s = (start * total + t * 0.22) % total, life = (t * 0.16 + beat) % 1;
      let k = 1;
      while (k < lens.length - 1 && lens[k] < s) k++;
      const u = (s - lens[k - 1]) / (lens[k] - lens[k - 1] || 1);
      const [x0, y0] = line[k - 1], [x1, y1] = line[k];
      const a = Math.atan2(y1 - y0, x1 - x0), n = [-Math.sin(a), Math.cos(a)];
      const cx = x0 + (x1 - x0) * u + n[0] * across, cy = y0 + (y1 - y0) * u + n[1] * across;
      g.globalAlpha = Math.sin(Math.PI * life) * (0.9 - 0.3 * night);
      g.beginPath();
      g.moveTo(X(cx - 0.16 * ax), Y(cy - 0.16 * ay));
      g.quadraticCurveTo(X(cx - 0.08 * ax + 0.09 * bx), Y(cy - 0.08 * ay + 0.09 * by), X(cx), Y(cy));
      g.quadraticCurveTo(X(cx + 0.08 * ax + 0.09 * bx), Y(cy + 0.08 * ay + 0.09 * by), X(cx + 0.16 * ax), Y(cy + 0.16 * ay));
      g.stroke();
    }
    g.restore();
  }
  /** Cloud shadows drifting slowly over the town by day: each a clump of round puffs drawn small once and stretched
   *  up, which softens its edges. */
  const cloudsOf = () => {
    const r = seeded(777 + T.seed), PX = 5;
    return [0, 1, 2].map(() => {
      const size = 1.6 + r() * 1.4, span = size * 6;
      const sprite = canvasOf(Math.ceil(span * PX), Math.ceil(span * PX));
      const puffs = Array.from({ length: 5 }, () => [span / 2 + (r() - 0.5) * size * 2.2, span / 2 + (r() - 0.5) * size * 0.9, size * (0.45 + r() * 0.4)]);
      return { sprite, puffs, span, PX, y: r() * ROWS, speed: 0.1 + r() * 0.05, start: r(), drawn: '' };
    });
  };
  /** @type {ReturnType<typeof cloudsOf>} */
  let clouds;
  /** @param {number} t */
  function drawClouds(t) {
    if (night > 0.99) return;
    ctx.save();
    ctx.globalAlpha = 0.08 * (1 - night);
    ctx.imageSmoothingEnabled = true;
    clouds.forEach((c, k) => {
      // The sprite in the shadow's colour, drawn again only when the colour changes.
      const colour = css(C.shadow);
      if (c.drawn !== colour) {
        const g = c.sprite.g;
        g.clearRect(0, 0, c.sprite.c.width, c.sprite.c.height);
        g.fillStyle = colour;
        g.beginPath();
        for (const [bx, by, br] of c.puffs) { g.moveTo((bx + br) * c.PX, by * c.PX); g.arc(bx * c.PX, by * c.PX, br * c.PX, 0, Math.PI * 2); }
        g.fill();
        c.drawn = colour;
      }
      const left = -OX / S, lap = W / S + c.span;
      const x = left + ((c.start * lap + t * c.speed) % lap) - c.span, y = c.y - c.span / 2 + Math.sin(t * 0.05 + k) * 0.6;
      ctx.drawImage(c.sprite.c, X(x), Y(y), c.span * S, c.span * S);
    });
    ctx.restore();
  }
  /** The flyover's points measured along it. */
  const lensOf = () => (T.flyover ? T.flyover.pts.reduce((out, p, k, pts) => { out.push(k ? out[k - 1] + Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) : 0); return out; }, /** @type {number[]} */ ([])) : []);
  /** @type {number[]} */
  let flyLens = [];
  /** Where along the flyover a point `s` from its start is. @param {number} s @returns {[number, number]} */
  const flyAt = (s) => {
    const pts = /** @type {import('../lib/town/map.js').Flyover} */ (T.flyover).pts;
    let k = 1;
    while (k < pts.length - 1 && flyLens[k] < s) k++;
    const u = Math.max(0, Math.min(1, (s - flyLens[k - 1]) / (flyLens[k] - flyLens[k - 1] || 1)));
    return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u];
  };
  /** A ramp: the road off the junction rising into the flyover, from the end of the road's foot (half a tile out) to a
   *  little past where the deck lifts: a road's tarmac, kerbs and middle line at first, turning into the deck's
   *  concrete, rails and line, and widening to the deck, as it rises; one smooth shape, square at both ends, so its
   *  foot meets the road's flush. `from` and `to` are along the flyover, `from` at the foot.
   *  @param {CanvasRenderingContext2D} g @param {number} from @param {number} to */
  function drawRamp(g, from, to) {
    const n = Math.max(2, Math.ceil(Math.abs(to - from) / 0.05)), lift = RAMP - 0.5;
    const pts = Array.from({ length: n + 1 }, (_, k) => flyAt(from + ((to - from) * k) / n));
    const rise = (/** @type {number} */ k) => { const u = Math.min(1, (Math.abs(to - from) * k) / n / lift); return u * u * (3 - 2 * u); };
    /** The ramp's outline at `w0` wide at its foot and `w1` once up, as a path. @param {number} w0 @param {number} w1 */
    const outline = (w0, w1) => {
      const side = pts.map((p, k) => {
        const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const w = (w0 + (w1 - w0) * rise(k)) / 2;
        return [(-(b[1] - a[1]) / l) * w, ((b[0] - a[0]) / l) * w];
      });
      g.beginPath();
      pts.forEach((p, k) => (k ? g.lineTo(X(p[0] + side[k][0]), Y(p[1] + side[k][1])) : g.moveTo(X(p[0] + side[k][0]), Y(p[1] + side[k][1]))));
      for (let k = n; k >= 0; k--) g.lineTo(X(pts[k][0] - side[k][0]), Y(pts[k][1] - side[k][1]));
      g.closePath();
    };
    /** A blend along the ramp from one colour at its foot to another once it's up. @param {Rgb} c0 @param {Rgb} c1 @param {number} a0 @param {number} a1 */
    const blend = (c0, c1, a0 = 1, a1 = 1) => {
      const top = flyAt(from + Math.sign(to - from) * lift), grad = g.createLinearGradient(X(pts[0][0]), Y(pts[0][1]), X(top[0]), Y(top[1]));
      for (const u of [0, 0.25, 0.5, 0.75, 1]) { const v = u * u * (3 - 2 * u); grad.addColorStop(u, css(mix(c0, c1, v), a0 + (a1 - a0) * v)); }
      return grad;
    };
    g.fillStyle = blend(C.kerb, C.rail); outline(0.68, 0.74); g.fill();
    g.fillStyle = blend(C.road, C.concrete); outline(0.58, 0.62); g.fill();
    g.save();
    g.setLineDash([0.18 * S, 0.18 * S]); g.lineCap = 'butt'; g.lineWidth = 0.035 * S;
    g.strokeStyle = blend(C.kerb, mix(C.concrete, [0, 0, 0], 0.12), 0.7, 1);
    g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.stroke();
    g.restore();
  }
  /** The flyover in two parts: its shadow, pillars and ramps, drawn under the cars on the ground, the ramps over the
   *  shadow, which they cast themselves (nothing drives under a ramp: it comes down over open ground); and the raised
   *  deck between them, drawn over the cars. It lays itself from end to end when new. @param {number} t
   *  @param {'ramps' | 'deck'} part */
  function drawFlyover(t, part) {
    const f = T.flyover;
    if (!f || f.born > t) return;
    const g = ctx, len = flyLens[flyLens.length - 1];
    const shown = len * Math.min(1, (t - f.born) / 1.2);
    const piece = (/** @type {number} */ from, /** @type {number} */ to) => f.pts.filter((_, k) => flyLens[k] >= from && flyLens[k] <= Math.min(to, shown));
    const pieces = part === 'ramps' ? [] : [piece(RAMP, len - RAMP)];
    const path = (/** @type {number[][]} */ list) => { g.beginPath(); list.forEach(([x, y], k) => (k ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); };
    const lift = (/** @type {number} */ k) => Math.sin((Math.PI * flyLens[k]) / len) * 0.9;
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (part === 'ramps') {
      const deck = f.pts.map((p, k) => /** @type {[number[], number]} */ ([p, k])).filter(([, k]) => flyLens[k] >= RAMP * 0.5 && flyLens[k] <= Math.min(len - RAMP * 0.5, shown));
      g.globalAlpha = 0.22 + 0.28 * night;
      g.strokeStyle = css(C.shadow); g.lineWidth = 0.7 * S; g.lineCap = 'butt';
      path(deck.map(([[x, y], k]) => [x + SUN[0] * lift(k), y + SUN[1] * lift(k)])); g.stroke();
      g.lineCap = 'round';
      g.globalAlpha = 1;
      g.fillStyle = css(C.pillar);
      deck.forEach(([[x, y], k], n) => { if (n % 7 === 3) { const l = lift(k) / 2; g.fillRect(X(x + SUN[0] * l - 0.07), Y(y + SUN[1] * l - 0.07), 0.14 * S, 0.14 * S); } });
      if (shown > 0.5) drawRamp(g, 0.5, Math.min(RAMP + 0.2, shown));
      if (shown >= len - 0.5) drawRamp(g, len - 0.5, len - RAMP - 0.2);
    }
    g.lineCap = 'butt';
    for (const pts of pieces) {
      if (pts.length < 2) continue;
      g.strokeStyle = css(C.rail); g.lineWidth = 0.74 * S; path(pts); g.stroke();
      g.strokeStyle = css(C.concrete); g.lineWidth = 0.62 * S; path(pts); g.stroke();
      g.save();
      g.setLineDash([0.18 * S, 0.18 * S]); g.strokeStyle = darker(C.concrete, 0.12); g.lineWidth = 0.035 * S;
      path(pts); g.stroke();
      g.restore();
    }
    g.restore();
  }
  /** A car: a body in its home's colour, a lighter roof and dark glass, the same at both ends, since a car has no front
   *  or back; brake lights at the back as it slows, tail lights by night while it drives. Its shadow falls the sun's
   *  way. @param {number} x @param {number} y @param {number} angle @param {Rgb} colour @param {'brake' | 'tail' | null} lights */
  function drawCar(x, y, angle, colour, lights) {
    const g = ctx;
    g.save();
    g.translate(X(x), Y(y));
    const sx = SUN[0] * 0.14 * S, sy = SUN[1] * 0.14 * S;
    g.rotate(angle);
    const ca = Math.cos(-angle), sa = Math.sin(-angle);
    const l = CAR_L * S, w = CAR_W * S, rr = 0.07 * S;
    g.fillStyle = css(C.shadow, 0.18 + 0.17 * night);
    g.beginPath(); g.roundRect(-l / 2 + sx * ca - sy * sa, -w / 2 + sx * sa + sy * ca, l, w, rr); g.fill();
    g.fillStyle = css(colour); g.beginPath(); g.roundRect(-l / 2, -w / 2, l, w, rr); g.fill();
    g.fillStyle = css(C.glass, 0.75); g.fillRect(-0.11 * S, -0.08 * S, 0.22 * S, 0.16 * S);
    g.fillStyle = lighter(colour, 0.22); g.fillRect(-0.065 * S, -0.08 * S, 0.13 * S, 0.16 * S);
    if (lights) {
      g.fillStyle = css(C.brake, lights === 'brake' ? 0.95 : 0.55 * night);
      g.fillRect(-l / 2, -0.085 * S, 0.04 * S, 0.05 * S);
      g.fillRect(-l / 2, 0.035 * S, 0.04 * S, 0.05 * S);
    }
    g.restore();
  }
  /** The cars, each where it is between its last step and its next: those on the road, or those up on the flyover.
   *  @param {boolean} up */
  function drawCars(up) {
    const t = stage.playing ? Math.min(1, acc / STEP) : 1;
    for (const car of traffic.cars) {
      // A parked car shows once its home or building is up.
      if (car.state === 'away' || (car.state === 'parked' && car.spot && car.spot.b.born > stage.time)) continue;
      const p = traffic.pose(car, t);
      if (p.up !== up) continue;
      const moving = car.state === 'driving';
      drawCar(p.x, p.y, p.a, C[COLOURS[car.colour]], moving && car.braking ? 'brake' : moving && night > 0.01 ? 'tail' : null);
    }
  }
  /** A burst where something's built: two rings and a scatter of confetti in its colour flying out and fading; or, where
   *  something comes down, a puff of dust. `t` runs from 0 to 1. @param {number} x @param {number} y @param {number} t
   *  @param {Rgb} colour @param {number} size @param {number} seed */
  function burst(x, y, t, colour, size, seed, dust = false) {
    const g = ctx, r = seeded(seed);
    g.save();
    if (!dust) {
      for (const delay of [0, 0.2]) {
        const u = (t - delay) / (1 - delay);
        if (u <= 0 || u >= 1) continue;
        g.globalAlpha = (1 - u) * 0.85;
        g.strokeStyle = css(colour);
        g.lineWidth = (0.13 * (1 - u) + 0.02) * S;
        g.beginPath(); g.arc(X(x), Y(y), (0.35 + 1.9 * size * (1 - (1 - u) ** 3)) * S, 0, Math.PI * 2); g.stroke();
      }
    }
    const n = dust ? 11 : 16;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.5;
      const reach = (dust ? 0.5 + r() * 0.5 : 0.9 + r() * 1.1) * size;
      const d = reach * (1 - Math.exp(-4.5 * t));
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d - (dust ? 0.35 * t : 0);
      const s = (dust ? 0.12 + r() * 0.1 : 0.06 + r() * 0.06) * size * (dust ? 1 - t * 0.4 : 1 - t);
      g.globalAlpha = (1 - t) ** 1.5 * (dust ? 0.75 : 1);
      if (dust) { g.fillStyle = css(C.dust); g.beginPath(); g.arc(X(px), Y(py), s * S, 0, Math.PI * 2); g.fill(); continue; }
      g.fillStyle = k % 3 === 0 ? css(C.flash) : k % 3 === 1 ? css(colour) : lighter(colour, 0.35);
      g.save(); g.translate(X(px), Y(py)); g.rotate(a + t * 7); g.fillRect((-s * S) / 2, (-s * S) / 2, s * S, s * S); g.restore();
    }
    g.restore();
  }
  /** Every burst and puff going on now, specks of dust where road is being laid, and rings where roads changed.
   *  @param {number} t */
  function drawEffects(t) {
    for (const b of T.buildings.values()) {
      const u = (t - b.born) / 0.9;
      if (u <= 0 || u >= 1) continue;
      const [x, y] = b.kind === 'home' ? centre(b.tile) : [b.bx + 1, b.by + 1];
      burst(x, y, u, C[COLOURS[b.colour]], b.kind === 'home' ? 0.8 : 1.4, b.id * 977 + 13);
    }
    for (let i = 0; i < N; i++) {
      if (T.ring[i] === 1) { const u = (t - T.ringBorn[i]) / 0.9; if (u > 0 && u < 1) { const [x, y] = centre(i); burst(x, y, u, C.park, 1.2, i * 31 + 7); } }
      if (!T.isRoad[i]) continue;
      const u = (t - T.born[i]) / 0.35;
      if (u <= 0 || u >= 1) continue;
      const [x, y] = centre(i);
      ctx.save();
      ctx.fillStyle = css(C.kerb);
      for (let k = 0; k < 3; k++) { const a = i * 1.7 + k * 2.1, d = 0.25 + 0.35 * u; ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.arc(X(x + Math.cos(a) * d), Y(y + Math.sin(a) * d), 0.05 * S, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    for (const gh of T.ghosts) {
      if (gh.kind === 'road') continue;
      const u = (t - gh.died) / 0.9;
      if (u <= 0 || u >= 1) continue;
      const [x, y] = gh.b.kind === 'home' ? centre(gh.b.tile) : [gh.b.cx, gh.b.cy];
      burst(x, y, u, C.dust, gh.b.kind === 'home' ? 0.8 : 1.3, gh.b.id * 131 + 5, true);
    }
    pulses = pulses.filter((p) => t - p.born < 1.4);
    for (const p of pulses) {
      const u = Math.max(0, (t - p.born) / 1.4);
      ctx.save();
      ctx.globalAlpha = (1 - u) * 0.9;
      ctx.strokeStyle = css(C.kerb); ctx.lineWidth = 0.1 * S;
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), (0.5 + u * 1.8) * S, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  /** What a car is thinking of, inside its cloud, around (0, 0), drawn in a cloud 0.26 wide: a tiny copy of the
   *  building or home it's heading to, a waving hand when it's leaving town, or the comic anger mark.
   *  @param {CanvasRenderingContext2D} g @param {Bubble} bubble @param {number} now */
  function drawThought(g, bubble, now) {
    const top = C[COLOURS[bubble.colour]];
    if (bubble.kind === 'place') {
      g.fillStyle = darker(top, 0.18); g.beginPath(); g.roundRect(-0.05, -0.05, 0.1, 0.1, 0.012); g.fill();
      g.fillStyle = css(top); g.beginPath(); g.roundRect(-0.042, -0.042, 0.084, 0.078, 0.008); g.fill();
      g.fillStyle = lighter(top, 0.45);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) g.fillRect(-0.03 + c * 0.022, 0.006 + r * 0.016, 0.014, 0.009);
      g.fillStyle = lighter(top, 0.25); g.fillRect(-0.03, -0.03, 0.026, 0.02);
      // A faint outline, so a white building shows on the white cloud.
      g.strokeStyle = css(C['bubble-edge'], 0.3); g.lineWidth = 0.005; g.beginPath(); g.roundRect(-0.05, -0.05, 0.1, 0.1, 0.012); g.stroke();
    } else if (bubble.kind === 'home') {
      g.fillStyle = darker(top, 0.24); g.fillRect(-0.055, 0, 0.11, 0.042);
      g.fillStyle = lighter(top, 0.08); g.fillRect(-0.055, -0.042, 0.11, 0.042);
      g.fillStyle = darker(top, 0.36); g.fillRect(-0.055, -0.003, 0.11, 0.006);
      g.fillStyle = darker(top, 0.4); g.fillRect(0.022, -0.036, 0.01, 0.012);
      g.strokeStyle = css(C['bubble-edge'], 0.3); g.lineWidth = 0.005; g.strokeRect(-0.055, -0.042, 0.11, 0.084);
    } else if (bubble.kind === 'away') {
      // Bye-bye: a hand waving from the wrist, with two lines for the wave.
      g.strokeStyle = css(C['bubble-edge'], 0.45);
      g.lineWidth = 0.008;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(0.012, 0.02, 0.06, -1.25, -0.75);
      g.moveTo(0.012 + Math.cos(-1.3) * 0.075, 0.02 + Math.sin(-1.3) * 0.075);
      g.arc(0.012, 0.02, 0.075, -1.3, -0.7);
      g.stroke();
      g.translate(-0.012, 0.042);
      g.rotate(0.35 * Math.sin(now * 9));
      g.fillStyle = css(C.window);
      g.beginPath();
      g.roundRect(-0.024, -0.04, 0.048, 0.042, 0.014);
      for (const [x, tip] of [[-0.024, -0.072], [-0.011, -0.08], [0.002, -0.078], [0.015, -0.068]]) g.roundRect(x, tip, 0.011, -0.03 - tip, 0.0055);
      g.fill();
      g.save();
      g.translate(-0.022, -0.022);
      g.rotate(-0.8);
      g.beginPath();
      g.roundRect(-0.006, -0.03, 0.012, 0.03, 0.006);
      g.fill();
      g.restore();
    } else {
      g.strokeStyle = css(C.red);
      g.lineWidth = 0.017;
      g.lineCap = 'round';
      for (const [x, y] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        g.beginPath();
        g.moveTo(x * 0.014, y * 0.05);
        g.quadraticCurveTo(x * 0.01, y * 0.01, x * 0.05, y * 0.014);
        g.stroke();
      }
    }
  }
  /** A thought bubble by its car (at `px`, `py` on the stage, in pixels) at second `now`: the small circle, then the
   *  middle one, then the cloud puffs out; with a thin outline, and a soft shadow falling the town's shadows' way.
   *  @param {CanvasRenderingContext2D} g @param {Bubble} bubble @param {number} px @param {number} py @param {number} now */
  function drawBubble(g, bubble, px, py, now) {
    const w = cloudPx(), c = cloudOf(w);
    const age = now - bubble.from;
    const grown = (/** @type {number} */ from, /** @type {number} */ over) => Math.max(0, Math.min(1, (age - from) / over));
    const cloud = puffOut(grown(0.3, 0.25));
    const x = px + c.dx * bubble.flip.x, y = py + c.dy * bubble.flip.y;
    const toward = (/** @type {number} */ t) => [px + (x - px) * t, py + (y - py) * t];
    /** @type {[number[], number][]} */
    const circles = [[toward(0.32), 0.05 * w * grown(0, 0.12)], [toward(0.55), 0.08 * w * grown(0.15, 0.12)], ...PUFFS.map(([qx, qy, r]) => /** @type {[number[], number]} */ ([[x + qx * w * cloud, y + qy * w * cloud], r * w * cloud]))];
    const shape = (/** @type {number} */ dx, /** @type {number} */ dy) => {
      g.beginPath();
      for (const [[cx, cy], r] of circles) { if (r <= 0) continue; g.moveTo(cx + dx + r, cy + dy); g.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); }
    };
    g.save();
    g.fillStyle = css(C.shadow, 0.12 + 0.18 * night);
    shape(-0.03 * w, 0.035 * w);
    g.fill();
    // The outline drawn round every circle, then the circles filled over it, leaves only the cloud's own edge.
    g.strokeStyle = css(C['bubble-edge'], 0.4);
    g.lineWidth = 0.046 * w;
    shape(0, 0);
    g.stroke();
    g.fillStyle = css(C.bubble);
    g.fill();
    if (cloud > 0) {
      g.translate(x, y);
      g.scale((cloud * w) / 0.26, (cloud * w) / 0.26);
      drawThought(g, bubble, now);
    }
    g.restore();
  }
  /** A bubble on its way out: drawn whole onto a layer of its own round its box, then laid down `alpha` see-through,
   *  so it fades as one picture. @param {Bubble} bubble @param {number} px @param {number} py @param {number} now @param {number} alpha */
  function drawFading(bubble, px, py, now, alpha) {
    const d = density;
    if (fade.c.width !== Math.round(stage.width * d) || fade.c.height !== Math.round(stage.height * d)) fade = canvasOf(stage.width * d, stage.height * d);
    const box = boxOf(bubble, { x: px, y: py }, cloudOf(cloudPx())), m = cloudPx() * 0.3;
    const x0 = Math.max(0, Math.floor((box.left - m) * d)), y0 = Math.max(0, Math.floor((box.top - m) * d));
    const x1 = Math.min(fade.c.width, Math.ceil((box.right + m) * d)), y1 = Math.min(fade.c.height, Math.ceil((box.bottom + m) * d));
    if (x1 <= x0 || y1 <= y0) return;
    fade.g.setTransform(1, 0, 0, 1, 0, 0);
    fade.g.clearRect(x0, y0, x1 - x0, y1 - y0);
    fade.g.setTransform(d, 0, 0, d, 0, 0);
    drawBubble(fade.g, bubble, px, py, now);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(fade.c, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }
  /** Every bubble, by its car where it's drawn now. @param {number} now */
  function drawBubbles(now) {
    const t = stage.playing ? Math.min(1, acc / STEP) : 1;
    for (const bubble of thoughts.bubbles) {
      const p = traffic.pose(bubble.car, t), [px, py] = toStage(p.x, p.y);
      const alpha = Math.min(1, (bubble.until - now) / BUBBLE_FADE);
      if (alpha >= 1) drawBubble(ctx, bubble, px, py, now);
      else if (alpha > 0) drawFading(bubble, px, py, now, alpha);
    }
  }

  /** One change of the town, now: and the cars find their way on the roads as they've become. */
  function changeNow() {
    nextChange = traffic.clock + EVERY * (0.75 + 0.5 * timing());
    const res = change(T, stage.time, traffic.inUse());
    if (!res) return;
    traffic.after();
    if (res.at && !res.b) pulses.push({ x: res.at[0], y: res.at[1], born: stage.time });
    animEnd = Math.max(animEnd, (res.end ?? stage.time) + 1);
    dirty = true;
  }

  function resize() {
    // A tall stage (a phone's) has the town turned a quarter round, its long side down the stage: bigger than lying
    // across it, with ground beside it rather than a wide band above and below.
    turned = stage.height > stage.width;
    W = turned ? stage.height : stage.width;
    H = turned ? stage.width : stage.height;
    density = stage.density;
    SUN = sunNow();
    // The whole town, as big as fits, in the middle of the stage; ground all round it.
    S = Math.min(W / COLS, H / ROWS);
    OX = (W - COLS * S) / 2;
    OY = (H - ROWS * S) / 2;
    layer = canvasOf(W * density, H * density);
    behind = canvasOf(W * density, H * density);
    shade = canvasOf(W * density, H * density);
    // A fade under way ends: the picture being left was the old size.
    fading = null;
    dirty = true;
  }

  /** One frame: the traffic moves on `dt` seconds, the town changes when it's time, and everything is drawn.
   *  @param {number} dt */
  function frame(dt) {
    // The theme changed: what stays still is drawn again in its colours, and a playing town fades across to them; a
    // still one (paused, or with reduced motion) shows them at once.
    if (stage.colors !== colorsSeen) {
      colorsSeen = stage.colors;
      const was = JSON.stringify([target, aurora]), wasNight = nightTo;
      const before = { C, night };
      readTokens();
      nightTo = isNight();
      if (JSON.stringify([target, aurora]) !== was || nightTo !== wasNight) {
        [behind, layer] = [layer, behind];
        fading = stage.playing ? { ...before, start: stage.time } : null;
        dirty = true;
      }
    }
    let blend = 1;
    if (fading) {
      blend = Math.min(1, (stage.time - fading.start) / FADE);
      blend = blend * blend * (3 - 2 * blend);
      if (stage.time - fading.start >= FADE) fading = null;
    }
    night = fading ? fading.night + ((nightTo ? 1 : 0) - fading.night) * blend : nightTo ? 1 : 0;
    const from = fading?.C;
    C = from ? Object.fromEntries(NAMES.map((n) => [n, mix(from[n], target[n], blend)])) : target;

    if (stage.time >= buildEnd) acc += dt * pace;
    for (let n = 0; acc >= STEP && n < 400; n++) {
      traffic.step();
      acc -= STEP;
      if (traffic.clock >= nextChange) changeNow();
    }
    const sun = sunNow();
    if (Math.abs(sun[0] - SUN[0]) + Math.abs(sun[1] - SUN[1]) > 0.003) { SUN = sun; dirty = true; }
    const t = stage.time;
    if (dirty || t < animEnd) { drawStill(t); dirty = false; }
    ctx.save();
    if (turned) ctx.transform(0, 1, -1, 0, stage.width, 0);
    if (fading) ctx.drawImage(behind.c, 0, 0, W, H);
    ctx.globalAlpha = fading ? blend : 1;
    ctx.drawImage(layer.c, 0, 0, W, H);
    ctx.globalAlpha = 1;
    drawFlow(t);
    drawFlyover(t, 'ramps');
    drawCars(false);
    drawFlyover(t, 'deck');
    drawCars(true);
    drawClouds(t);
    drawEffects(t);
    ctx.restore();
    if (dt > 0) thoughts.step(t, dt);
    drawBubbles(t);
    showChip();
    if (mouse) { const want = carAt(mouse[0], mouse[1]) ? 'pointer' : ''; if (want !== cursor) canvas.style.cursor = cursor = want; }
  }

  // The page's chip: the town's day and time, and what's in it, kept up to date as the town minutes pass.
  const root = /** @type {HTMLElement | null} */ (ctx.canvas.closest('[data-stage]'));
  const chipTime = root?.querySelector('[data-chip-time]'), chipCount = root?.querySelector('[data-chip-count]');
  let chipSeen = '';
  function showChip() {
    const m = Math.floor(traffic.clock) % 1440, day = DAYS[Math.floor(traffic.clock / 1440) % 7];
    const time = `${day} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    // What's up so far, while the town builds itself.
    const now = stage.time, up = (/** @type {Building} */ b) => b.born <= now;
    const cars = traffic.cars.filter((c) => c.state !== 'away' && !(c.state === 'parked' && c.spot && !up(c.spot.b))).length;
    const count = `${homesOf(T).filter(up).length} homes \u{b7} ${placesOf(T).filter(up).length} buildings \u{b7} ${cars} cars`;
    if (time + count === chipSeen) return;
    chipSeen = time + count;
    if (chipTime) chipTime.textContent = time;
    if (chipCount) chipCount.textContent = count;
  }

  // The page's panel: the speed, full screen where the browser can (iPhones can't), as on the Build Log, and a new town.
  const speeds = /** @type {NodeListOf<HTMLButtonElement>} */ (root?.querySelectorAll('[data-speed]') ?? []);
  for (const button of speeds) {
    button.addEventListener('click', () => {
      pace = PACE * Number(button.dataset.speed);
      for (const b of speeds) b.setAttribute('aria-pressed', String(b === button));
    });
  }
  const full = /** @type {HTMLButtonElement | null | undefined} */ (root?.querySelector('[data-control="full"]'));
  if (root && full && document.fullscreenEnabled) {
    full.hidden = false;
    full.addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen()));
    document.addEventListener('fullscreenchange', () => {
      const on = !!document.fullscreenElement, label = on ? 'Leave full screen' : 'Full screen';
      full.setAttribute('aria-pressed', String(on));
      full.setAttribute('aria-label', label);
      full.title = label;
    });
  }
  // A new town: another seed, so another town from the same rules; its picture at once, even while paused.
  root?.querySelector('[data-control="new-town"]')?.addEventListener('click', () => {
    startTown(1 + Math.floor(Math.random() * 1e9));
    if (!stage.playing) frame(0);
  });

  /** Starts the town of `seed`: built, its traffic from a little before seven in the morning on the day's weekday,
   *  its changes, its cars' thoughts, and what's drawn from it worked out afresh. @param {number} seed */
  function startTown(seed) {
    T = newTown(seed);
    // Watched going up, unless less motion is asked for: then all there at once, its traffic already about.
    buildEnd = build(T, stage.still ? -Infinity : stage.time);
    traffic = startTraffic(T, seed, { clock: weekday * 1440 + 7 * 60 - (stage.still ? WARM : 0) });
    if (stage.still) for (let n = 0; n < WARM / STEP; n++) traffic.step();
    timing = seeded(seed ^ 0x5eed);
    nextChange = traffic.clock + EVERY * (0.75 + 0.5 * timing());
    thoughts = startThoughts(traffic, seed, {
      where: (car) => { const p = traffic.pose(car, 1), [x, y] = toStage(p.x, p.y); return { x: x / S, y: y / S }; },
      bounds: () => ({ w: stage.width / S, h: stage.height / S, top: buttonsReach() / S }),
      cloud: () => cloudOf(cloudPx() / S),
    });
    treeCache.clear();
    roofs.clear();
    flow = flowOf();
    clouds = cloudsOf();
    flyLens = lensOf();
    pulses = [];
    acc = 0;
    animEnd = buildEnd + 1;
    SUN = sunNow();
    dirty = true;
  }

  // A click or a tap on a car that's going somewhere pops up what it's thinking of; under the mouse such a car shows
  // the pointing hand.
  const canvas = ctx.canvas;
  /** The car going somewhere nearest a point on the stage, if it's within reach of it. @param {number} x @param {number} y */
  function carAt(x, y) {
    const t = stage.playing ? Math.min(1, acc / STEP) : 1;
    /** @type {Car | null} */
    let best = null, nearest = SLACK;
    for (const car of traffic.cars) {
      if (!goingSomewhere(car)) continue;
      const p = traffic.pose(car, t), [cx, cy] = toStage(p.x, p.y), a = p.a + (turned ? Math.PI / 2 : 0);
      const dx = x - cx, dy = y - cy;
      const along = Math.abs(dx * Math.cos(a) + dy * Math.sin(a)) - (CAR_L * S) / 2;
      const across = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) - (CAR_W * S) / 2;
      const off = Math.hypot(Math.max(0, along), Math.max(0, across));
      if (off <= nearest) { nearest = off; best = car; }
    }
    return best;
  }
  /** @param {MouseEvent} e @returns {[number, number]} */
  const pointOf = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  canvas.addEventListener('click', (e) => {
    const car = carAt(...pointOf(e));
    if (car) thoughts.think(car, stage.time);
  });
  /** Where the mouse is over the stage, if it is. @type {[number, number] | null} */
  let mouse = null;
  let cursor = '';
  canvas.addEventListener('pointermove', (e) => { mouse = e.pointerType === 'mouse' ? pointOf(e) : null; });
  canvas.addEventListener('pointerleave', () => { mouse = null; if (cursor) canvas.style.cursor = cursor = ''; });

  readTokens();
  C = target;
  startTown(daySeed);
  resize();
  return { frame, resize };
}
