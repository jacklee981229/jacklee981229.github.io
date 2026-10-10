// Jack's Build Log, drawn on the effects' stage (src/effects/stage.js), which runs it only while it's on screen and not
// paused: the site's history replayed on a clock tilted back like a dial on a desk. The day goes round (midnight at the
// top), the days since the rebuild go outwards; each file a commit changed stands up off the face at the commit's hour
// and day, as tall as its lines, and is wound once round the ring at the rim, like the wire of a coil. The commits play
// back in order; then the finished clock stays, a pulse running round its coil, until Restart plays it again.
// Its other mode, the Ring, keys the same files on the build itself: a fat coil leaning further back, each file one turn
// of its wire and a fibre along it, in the order the files changed (so the busy days take more of it), bristling out
// where it changed many lines, the commit being played in its middle. The ring is on the clock's back, like the other side of a card:
// switching turns it over.
// Around it, the numbers, worked out while the site is built (src/lib/build-log.js). In the site's colours, following
// its theme (its page's --c1 onward, build-log.astro, read by the stage): glowing in the dark, drawn plainly by day.
import { MONTHS } from '../lib/dates.js';

/** The poster's own units: a landscape screen as wide as the page, or a tall one on a phone. */
const WIDE = { w: 1400, h: 788 };
const TALL = { w: 440, h: 550 };

/** The replay, in seconds: the bare clock, then the commits played back. After that it stays finished. */
const INTRO = 1.2;
const PLAY = 22;
/** Seconds for the finished clock's pulse to run once round its coil. */
const LAP = 4.7;
/** How long a spike takes to rise, and a file's wire to wind once round the coil. */
const GROW = 0.7;
/** How far the clock's face leans back (degrees), its top left away from us, and the ring, further. The ring is on the
 * face's other side, like the back of a card: switching, the face turns over, on past edge-on, until the ring's side
 * leans back at its own angle (and over again on the way back). */
const TILT = -30;
const RING_TILT = -45;
/** Points along a spike, and along one turn of a wire. */
const SPIKE_POINTS = 9;
const WIRE_POINTS = 15;
/** Seconds the face takes to turn over between the clock and the ring. */
const MORPH = 1.5;
/** Points along a file's fibre round the ring. */
const FIBRE_POINTS = 21;

const TAU = Math.PI * 2;
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const easeOut = (x) => 1 - (1 - x) ** 3;
const smooth = (x) => x * x * (3 - 2 * x);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const kfmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : fmt(n));
const dayLabel = (day) => `${day.slice(8)} ${MONTHS[Number(day.slice(5, 7)) - 1].toUpperCase()}`;

/** Numbers that look random but are the same on every visit. @param {number} seed */
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Midnight at the top, going round clockwise as seen from the front. */
const hourAngle = (commit) => Math.PI / 2 - ((commit.hour + Number(commit.time.slice(3)) / 60) / 24) * TAU;

/**
 * The clock in 3D, as a function from the face's own coordinates (x right, y up, z out of the face) to the poster
 * ([x, y, depth, size]): the face turned about the diagonal from its bottom left to its top right, then seen in a
 * little perspective.
 */
function tilted(cx, cy, degrees, eye) {
  const th = (degrees * Math.PI) / 180;
  const k = Math.SQRT1_2;
  const c = Math.cos(th);
  const s = Math.sin(th);
  return (x, y, z = 0, out = [0, 0, 0, 0]) => {
    const along = k * x + k * y;
    const rx = x * c + k * z * s + k * along * (1 - c);
    const ry = y * c - k * z * s + k * along * (1 - c);
    const rz = z * c + (k * y - k * x) * s;
    const f = eye / (eye - rz);
    out[0] = cx + rx * f;
    out[1] = cy - ry * f;
    out[2] = rz;
    out[3] = f;
    return out;
  };
}

/** Where the clock sits in each poster, and how big its parts and the ring's are, in the poster's units. */
const CLOCKS = {
  wide: { cx: 700, cy: 366, r0: 62, r1: 206, coil: 236, tube: 12, labels: 276, plate: 258, eye: 1500, spike: 96, foot: 6, lift: 54, text: 10, ring: 196, ringTube: 28, bristle: 50, dates: 290 },
  tall: { cx: 220, cy: 236, r0: 28, r1: 98, coil: 116, tube: 7, labels: 140, plate: 126, eye: 760, spike: 46, foot: 3, lift: 24, text: 8.5, ring: 102, ringTube: 12, bristle: 24, dates: 150 },
};

/**
 * @param {import('../effects/stage.js').Stage} stage
 * @param {any} data what build-log-file.js worked out, with `parts` ({ name } for each of PARTS)
 * @param {HTMLElement} root
 * @param {'clock' | 'ring'} [mode] the one it opens on
 */
export function createPoster(stage, data, root, mode = 'clock') {
  const { ctx } = stage;
  const mono = getComputedStyle(root).getPropertyValue('--font-code').trim() || 'monospace';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const commits = data.commits;
  const cellParts = data.cells;
  const N = cellParts.length;
  const partCount = data.parts.length;
  const totals = data.totals;
  const [spanFrom, spanTo] = data.span;
  const days = Math.max(1, Math.round((spanTo - spanFrom) / 86400));

  // ---- The replay: each commit gets a share of PLAY (more for bigger ones); its files rise one after another in it.
  const random = seeded(N * 7919 + commits.length);
  const weights = commits.map((c) => 0.6 + Math.sqrt(c.cells));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const usable = PLAY - GROW - 0.4;
  const commitStart = [];
  let at = 0;
  for (const w of weights) {
    commitStart.push(at);
    at += (usable * w) / weightSum;
  }
  const commitOf = new Int32Array(N);
  const launch = new Float32Array(N);
  /** Each commit's first file, in the order the files changed. */
  const firstFile = new Int32Array(commits.length);
  {
    let k = 0;
    commits.forEach((commit, i) => {
      firstFile[i] = k;
      const span = ((usable * weights[i]) / weightSum) * 0.85;
      for (let m = 0; m < commit.cells; m++, k++) {
        commitOf[k] = i;
        launch[k] = commitStart[i] + (span * (m + random() * 0.7)) / Math.max(1, commit.cells);
      }
    });
  }
  // A file as big as 95 in 100 others reaches full height; the few bigger ones stop there.
  const sorted = [...data.sizes].sort((a, b) => a - b);
  const p95 = Math.max(1, sorted[Math.floor(sorted.length * 0.95)] ?? 1);
  // Each file's own ways: how far round and out from its commit's spot it stands, how it leans, and how its wire winds.
  const traits = Array.from({ length: N }, (_, k) => {
    const spread = Math.min(0.3, 0.015 * commits[commitOf[k]].cells);
    return {
      reach: Math.sqrt(Math.min(1, data.sizes[k] / p95)),
      turn: (random() - 0.5) * spread,
      out: (random() - 0.5) * 6,
      lean: (random() - 0.3) * 0.25,
      wireTurn: (random() - 0.5) * Math.max(0.12, spread * 1.6),
      wireStep: (0.008 + random() * 0.02) * (random() < 0.5 ? 1 : -1),
      wireFrom: random() * TAU,
      wireLift: 1 + random() * 0.3,
    };
  });
  // Where each file's wire sits round the coil, for the pulse that runs round it.
  const wireAngle = Float32Array.from({ length: N }, (_, k) => hourAngle(commits[commitOf[k]]) + traits[k].wireTurn);
  // On the ring, each file's place is its turn in the build, from the top round clockwise, and each commit's the middle
  // of its files. The ring's own random numbers, so the clock's stay as they were.
  const ringAngle = Float32Array.from({ length: N }, (_, k) => Math.PI / 2 - ((k + 0.5) / N) * TAU);
  const middleFile = (i) => Math.min(N - 1, firstFile[i] + (commits[i].cells >> 1));
  const ringRandom = seeded(N * 104729 + commits.length);
  const ringTraits = Array.from({ length: N }, () => ({
    bristleV: 0.3 + (ringRandom() - 0.5) * 1.6,
    bristleLean: (ringRandom() - 0.5) * 0.08,
    fibreV: ringRandom() * TAU,
    fibreTwist: (ringRandom() - 0.5) * 5.2,
    fibreOut: 0.6 + ringRandom() * 0.5,
    fibreLength: 0.2 + ringRandom() * 0.25,
  }));
  const ringOf = (commit) => (Math.floor((commit.at - spanFrom) / 86400) + 0.5) / days;
  const perDay = Array.from({ length: days }, () => ({ commits: 0, lines: 0 }));
  for (const c of commits) {
    const day = perDay[clamp(Math.floor((c.at - spanFrom) / 86400), 0, days - 1)];
    day.commits++;
    day.lines += c.added + c.removed;
  }
  const allHours = commits.reduce((hours, c) => { hours[c.hour]++; return hours; }, new Array(24).fill(0));
  const kinds = Object.entries(data.changelog.kinds).sort((a, b) => b[1] - a[1]);
  const labTotal = data.lab.tools + data.lab.games + data.lab.effects + data.lab.worlds;
  const lateShare = totals.commits ? totals.afterMidnight / totals.commits : 0;

  // ---- Colours, from the page's tokens (the stage reads --c1 onward into lanes, again when the theme changes).
  /** @type {{ parts: number[][], late: number[], lateDot: number[], added: number[], text: number[], soft: number[], faint: number[], line: number[], frame: number[], panel: number[], ground: number[], haze: number[] }} */
  let palette;
  let paletteKey = '';
  /** By day the card is light: the strokes are drawn plainly, as light added to light would wash out to white. */
  let light = false;
  const readPalette = () => {
    const lanes = stage.colors.lanes;
    const key = lanes.map((c) => c.join()).join('|');
    if (key === paletteKey) return;
    paletteKey = key;
    const [late, lateDot, added, text, soft, faint, line, frame, panel, ground, haze] = lanes.slice(partCount);
    palette = { parts: lanes.slice(0, partCount), late, lateDot, added, text, soft, faint, line, frame, panel, ground, haze };
    light = (0.2126 * ground[0] + 0.7152 * ground[1] + 0.0722 * ground[2]) / 255 > 0.5;
    dirty = true;
    stale = true;
  };
  const rgba = (rgb, a = 1) => `rgba(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0}, ${a})`;
  const WHITE = [255, 255, 255];

  // ---- Canvases: the still parts drawn once (the ground and the panels; the clock's face and coil, and on the other
  // side, the ring's tube and dates); the spikes and wires drawn once each as they land, onto canvases of their own
  // (while the face turns over, each frame instead); and each frame, those and whatever is moving onto the bright canvas, which is
  // shrunk to a half, a quarter and an eighth of its size and laid back over itself, blurred by the stretching, for the
  // glow (canvas filters aren't in every browser).
  const layer = () => document.createElement('canvas');
  const still2d = layer();
  const clockFace = layer();
  const ringFace = layer();
  const glow = layer();
  const blurs = [layer(), layer(), layer()];
  const landedWires = layer();
  const landedSpikes = layer();
  const movingFiles = layer();
  const movingFaces = layer();
  let movingDensity = 1;
  /** Which files' spike and wire are already on those canvases, and whether they must all be drawn again. */
  const drawn = new Uint8Array(N);
  let stale = true;
  let dirty = true;
  let density = 1;
  let wide = true;
  let size = WIDE;
  let clock = CLOCKS.wide;
  let scale = 1;
  let offX = 0;
  let offY = 0;
  // Each file's spike and wire (on the ring, its fibre too), and each commit's spot, on the poster: on the clock, on the
  // ring, and as the face turns over; and the same as distance from the middle, angle and height off the face, to see
  // them as it turns. Worked out again when the poster's size changes.
  const shapesOf = (per, ring = false) => ({ spikes: new Float32Array(N * SPIKE_POINTS * per), wires: new Float32Array(N * WIRE_POINTS * per), fibres: new Float32Array(ring ? N * FIBRE_POINTS * per : 0), nodes: new Float32Array(commits.length * per) });
  const clockShapes = shapesOf(2);
  const ringShapes = shapesOf(2, true);
  const turningShapes = shapesOf(2, true);
  const clockPlaces = shapesOf(3);
  const ringPlaces = shapesOf(3, true);
  /** How near each file's place on the ring is to us, 0 on its far side to 1 on its near side: at rest, and as it turns. */
  const ringNear = new Float32Array(N);
  const turningNear = new Float32Array(N);
  /** Which points of the ring's wires and fibres are on the near half of its tube, at rest. */
  const ringHalves = { wires: new Uint8Array(N * WIRE_POINTS), fibres: new Uint8Array(N * FIBRE_POINTS) };
  /** Seconds left of the fade from the last frame of a turn to the finished picture, and how long it takes. */
  const SETTLE = 0.35;
  let settle = 0;
  /** The middle of the face, the same at any tilt. */
  let hub = [0, 0];
  /** How far it is from the clock (0) to the ring (1), where it's going, and which way round the face turns. */
  let m = mode === 'ring' ? 1 : 0;
  let goal = m;
  let ahead = true;

  const fit = () => {
    density = ctx.canvas.width / Math.max(1, stage.width);
    wide = stage.width / Math.max(1, stage.height) >= 1.25;
    size = wide ? WIDE : TALL;
    clock = wide ? CLOCKS.wide : CLOCKS.tall;
    scale = Math.min(stage.width / size.w, stage.height / size.h);
    offX = (stage.width - size.w * scale) / 2;
    offY = (stage.height - size.h * scale) / 2;
    for (const [canvas, by] of [[still2d, 1], [clockFace, 1], [ringFace, 1], [glow, 1], [landedWires, 1], [landedSpikes, 1], [blurs[0], 2], [blurs[1], 4], [blurs[2], 8]]) {
      canvas.width = Math.max(1, Math.round(ctx.canvas.width / by));
      canvas.height = Math.max(1, Math.round(ctx.canvas.height / by));
    }
    // On the way between the clock and the ring, the files and the faces are drawn on canvases only as sharp as keeps
    // their lines a pixel wide or less: wider ones take many times longer to draw, and it's all moving too fast for it
    // to show.
    movingDensity = Math.min(density, 1 / (1.25 * 0.9 * (clock.r1 / 206) * scale));
    for (const canvas of [movingFiles, movingFaces]) {
      canvas.width = Math.max(1, Math.round(stage.width * movingDensity));
      canvas.height = Math.max(1, Math.round(stage.height * movingDensity));
    }
    shape();
    dirty = true;
    stale = true;
  };
  /** Draw in the poster's units. @param {CanvasRenderingContext2D} g */
  const posterSpace = (g) => g.setTransform(density * scale, 0, 0, density * scale, density * offX, density * offY);

  /**
   * The face leaning back `degrees`, as a function of (distance from the middle, angle, height off the face).
   * @typedef {(rho: number, a: number, z?: number, out?: number[]) => number[]} View
   * @returns {View}
   */
  const view = (degrees) => {
    const project = tilted(clock.cx, clock.cy, degrees, clock.eye);
    return (rho, a, z = 0, out = [0, 0, 0, 0]) => project(rho * Math.cos(a), rho * Math.sin(a), z, out);
  };
  /**
   * The face's other side, seen as `on`: a point given as it reads once the face is turned over (the top still at the
   * top, going round clockwise) is mirrored across the diagonal the face turns about, and out of the back.
   * @param {View} on @returns {View}
   */
  const backOf = (on) => (rho, a, z = 0, out = [0, 0, 0, 0]) => on(rho, Math.PI / 2 - a, -z, out);
  /** The clock's side of the face and the ring's, each at rest: set by shape(). @type {View} */
  let clockView;
  /** @type {View} */
  let ringView;
  /** Works out where every spike, wire and commit sits on the poster, on the clock and on the ring. */
  const shape = () => {
    clockView = view(TILT);
    // Turned over past edge-on to where its other side leans back RING_TILT.
    const turned = view(RING_TILT - 180);
    ringView = backOf(turned);
    const p = [0, 0, 0, 0];
    /** Puts point i of a set at (rho, a, z) on the face: its place, and where that is on the poster seen as `on`. */
    const put = (on, places, shapes, i, rho, a, z) => {
      places[i * 3] = rho;
      places[i * 3 + 1] = a;
      places[i * 3 + 2] = z;
      on(rho, a, z, p);
      shapes[i * 2] = p[0];
      shapes[i * 2 + 1] = p[1];
    };
    /** The same for a point on the ring, given as it reads on the face's other side. */
    const putBack = (places, shapes, i, rho, a, z) => put(turned, places, shapes, i, rho, Math.PI / 2 - a, -z);
    const ring = (commit) => clock.r0 + ringOf(commit) * (clock.r1 - clock.r0);
    const k = clock.r1 / 206;
    for (let c = 0; c < N; c++) {
      const commit = commits[commitOf[c]];
      const t = traits[c];
      // On the clock: the spike at its commit's hour and day, and its turn of wire round the coil at the rim.
      const a = hourAngle(commit) + t.turn;
      const rho = ring(commit) + t.out * k;
      const height = clock.foot + clock.spike * t.reach;
      for (let j = 0; j < SPIKE_POINTS; j++) {
        const s = j / (SPIKE_POINTS - 1);
        put(clockView, clockPlaces.spikes, clockShapes.spikes, c * SPIKE_POINTS + j, rho + height * 0.16 * s * s, a + t.lean * 0.2 * s * s, height * s);
      }
      const u0 = hourAngle(commit) + t.wireTurn;
      const tube = clock.tube * t.wireLift;
      for (let j = 0; j < WIRE_POINTS; j++) {
        const s = j / (WIRE_POINTS - 1);
        const v = t.wireFrom + s * TAU;
        put(clockView, clockPlaces.wires, clockShapes.wires, c * WIRE_POINTS + j, clock.coil + tube * Math.cos(v), u0 + s * t.wireStep, tube * Math.sin(v));
      }
      // On the ring: a bristle out from the tube, as long as its lines (a stub for a small change), and its turn of
      // wire round the tube, each file's next to the one before it.
      const r = ringTraits[c];
      const u = ringAngle[c];
      const length = 2 * k + clock.bristle * clamp((t.reach - 0.35) / 0.65);
      for (let j = 0; j < SPIKE_POINTS; j++) {
        const s = j / (SPIKE_POINTS - 1);
        const d = clock.ringTube + length * s;
        putBack(ringPlaces.spikes, ringShapes.spikes, c * SPIKE_POINTS + j, clock.ring + d * Math.cos(r.bristleV), u + r.bristleLean * s * s, d * Math.sin(r.bristleV));
      }
      const thick = clock.ringTube * (1 + (t.wireLift - 1) * 0.3);
      for (let j = 0; j < WIRE_POINTS; j++) {
        const s = j / (WIRE_POINTS - 1);
        const v = t.wireFrom + s * TAU;
        putBack(ringPlaces.wires, ringShapes.wires, c * WIRE_POINTS + j, clock.ring + thick * Math.cos(v), u + (0.5 - s) * (TAU / N), thick * Math.sin(v));
      }
      // And a fibre along the ring back from the file's place, twisting round the tube, longer for more lines: back, so
      // that while the ring is being wound none reaches into the part still to come.
      const span = Math.min(r.fibreLength + 0.9 * t.reach, ((c + 0.5) / N) * TAU);
      const out = clock.ringTube * r.fibreOut;
      for (let j = 0; j < FIBRE_POINTS; j++) {
        const s = j / (FIBRE_POINTS - 1);
        const v = r.fibreV + s * r.fibreTwist;
        putBack(ringPlaces.fibres, ringShapes.fibres, c * FIBRE_POINTS + j, clock.ring + out * Math.cos(v), u + s * span, out * Math.sin(v));
      }
    }
    commits.forEach((commit, i) => {
      put(clockView, clockPlaces.nodes, clockShapes.nodes, i, ring(commit), hourAngle(commit), 0);
      putBack(ringPlaces.nodes, ringShapes.nodes, i, clock.ring + clock.ringTube * Math.cos(1.1), ringAngle[middleFile(i)], clock.ringTube * Math.sin(1.1));
    });
    const base = clockView(0, 0, 0);
    hub = [base[0], base[1]];
    nearness(ringView, ringNear);
    halves(RING_TILT - 180, ringHalves);
  };

  /**
   * Which points of the ring's wires and fibres are on the near half of its tube with the face turned `degrees`: nearer
   * us than the middle of the tube there. (In tilted(), a point's depth is z·cos + (y − x)·sin/√2.)
   */
  const halves = (degrees, out) => {
    const cos = Math.cos((degrees * Math.PI) / 180);
    const sin = Math.sin((degrees * Math.PI) / 180) * Math.SQRT1_2;
    for (const key of /** @type {const} */ (['wires', 'fibres'])) {
      const places = ringPlaces[key];
      const flags = out[key];
      for (let i = 0; i < flags.length; i++) {
        const o = i * 3;
        const a = places[o + 1];
        flags[i] = places[o + 2] * cos + (places[o] - clock.ring) * (Math.sin(a) - Math.cos(a)) * sin >= 0 ? 1 : 0;
      }
    }
    return out;
  };

  /** How near each file's place on the ring is, seen as `on` (the ring's side), into `out`. @param {View} on */
  const nearness = (on, out) => {
    const p = [0, 0, 0, 0];
    let far = Infinity;
    let near = -Infinity;
    for (let c = 0; c < N; c++) {
      out[c] = on(clock.ring, ringAngle[c], 0, p)[2];
      far = Math.min(far, out[c]);
      near = Math.max(near, out[c]);
    }
    for (let c = 0; c < N; c++) out[c] = (out[c] - far) / Math.max(1e-6, near - far);
    return out;
  };

  /** Where one side's files and commits are on the poster with the face turned as `on`. @param {View} on */
  const turnedTo = (places, on) => {
    const p = [0, 0, 0, 0];
    for (const key of /** @type {const} */ (['spikes', 'wires', 'fibres', 'nodes'])) {
      const from = places[key];
      const out = turningShapes[key];
      for (let i = 0; i < from.length / 3; i++) {
        on(from[i * 3], from[i * 3 + 1], from[i * 3 + 2], p);
        out[i * 2] = p[0];
        out[i * 2 + 1] = p[1];
      }
    }
    return turningShapes;
  };

  // ---- Words and small pieces.
  /** Writes words in the site's monospace. @param {CanvasRenderingContext2D} g */
  const write = (g, words, x, y, sizePx, { colour = palette.text, alpha = 1, align = 'left', spacing = 0.05, weight = 500 } = {}) => {
    g.font = `${weight} ${sizePx}px ${mono}`;
    if ('letterSpacing' in g) g.letterSpacing = `${spacing * sizePx}px`;
    g.textAlign = /** @type {CanvasTextAlign} */ (align);
    g.textBaseline = 'alphabetic';
    g.fillStyle = rgba(colour, alpha);
    g.fillText(words, x, y);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  };
  const widthOf = (g, words, sizePx, spacing = 0.05) => {
    g.font = `500 ${sizePx}px ${mono}`;
    if ('letterSpacing' in g) g.letterSpacing = `${spacing * sizePx}px`;
    const width = g.measureText(words).width;
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    return width;
  };
  const cuts = new Map();
  /** Words cut short with an ellipsis to fit `width`. @param {CanvasRenderingContext2D} g */
  const cut = (g, words, width, sizePx) => {
    const key = `${width}|${sizePx}|${words}`;
    if (!cuts.has(key)) {
      let end = words.length;
      const fits = (text) => widthOf(g, text, sizePx) <= width;
      if (!fits(words)) while (end > 1 && !fits(`${words.slice(0, end).trimEnd()}…`)) end--;
      cuts.set(key, end === words.length ? words : `${words.slice(0, end).trimEnd()}…`);
    }
    return cuts.get(key);
  };
  const wraps = new Map();
  /** Words in up to `most` lines `width` wide, the last cut short if they still don't fit. @param {CanvasRenderingContext2D} g @returns {string[]} */
  const wrap = (g, words, width, sizePx, most) => {
    const key = `${width}|${sizePx}|${most}|${words}`;
    if (!wraps.has(key)) {
      const lines = [];
      let rest = words.split(' ');
      while (rest.length && lines.length < most - 1) {
        let n = rest.length;
        while (n > 1 && widthOf(g, rest.slice(0, n).join(' '), sizePx) > width) n--;
        lines.push(cut(g, rest.slice(0, n).join(' '), width, sizePx));
        rest = rest.slice(n);
      }
      if (rest.length) lines.push(cut(g, rest.join(' '), width, sizePx));
      wraps.set(key, lines);
    }
    return wraps.get(key);
  };
  /** A panel: a dark box in a hairline frame, its title top left and a note top right. @param {CanvasRenderingContext2D} g */
  const panel = (g, x, y, w, h, title, note = '', noteColour = palette.late) => {
    g.fillStyle = rgba(palette.panel, 0.82);
    g.fillRect(x, y, w, h);
    g.strokeStyle = rgba(palette.frame);
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (title) write(g, title, x + 10, y + 15, 10.5, { colour: palette.soft });
    if (note) write(g, note, x + w - 10, y + 15, 10.5, { colour: noteColour, align: 'right' });
  };
  /** @param {CanvasRenderingContext2D} g @param {number[][]} points */
  const polyline = (g, points, colour, width = 1) => {
    g.beginPath();
    points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = colour;
    g.lineWidth = width;
    g.stroke();
  };
  /** @param {CanvasRenderingContext2D} g */
  const dot = (g, x, y, r, colour) => {
    g.fillStyle = colour;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  };

  // ---- The still layers.
  const paintStill = () => {
    cuts.clear();
    wraps.clear();
    const g = /** @type {CanvasRenderingContext2D} */ (still2d.getContext('2d'));
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, still2d.width, still2d.height);
    // The ground right across the canvas (in full screen, round the poster too), and a haze behind the clock.
    g.fillStyle = rgba(palette.ground);
    g.fillRect(0, 0, still2d.width, still2d.height);
    posterSpace(g);
    const haze = g.createRadialGradient(clock.cx, clock.cy, 0, clock.cx, clock.cy, clock.plate * 1.7);
    haze.addColorStop(0, rgba(palette.haze, light ? 0.07 : 0.16));
    haze.addColorStop(1, rgba(palette.haze, 0));
    g.fillStyle = haze;
    g.fillRect(-size.w, -size.h, size.w * 3, size.h * 3);
    if (wide) paintWide(g);
    else paintTall(g);
    paintFaces(clockView, ringView);
  };
  /** The clock's face and the ring's parts, each onto its own canvas, seen as `clockOn` and `ringOn`. @param {View} clockOn @param {View} ringOn */
  const paintFaces = (clockOn, ringOn) => {
    for (const [canvas, paint, on] of /** @type {const} */ ([[clockFace, paintFace, clockOn], [ringFace, paintRing, ringOn]])) {
      const f = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
      f.setTransform(1, 0, 0, 1, 0, 0);
      f.clearRect(0, 0, canvas.width, canvas.height);
      posterSpace(f);
      paint(f, on);
    }
  };

  /** The tilted face: a plate with an edge, the small hours' wedge, day rings, hour spokes, labels, the coil's tube. @param {View} on */
  const paintFace = (g, on) => {
    const { r0, r1, plate } = clock;
    const p = [0, 0, 0, 0];
    const circle = (rho, z = 0, n = 96) => Array.from({ length: n + 1 }, (_, i) => { on(rho, (i / n) * TAU, z, p); return [p[0], p[1]]; });
    const k = r1 / 206;
    polyline(g, circle(plate, -10 * k), rgba(palette.frame, 0.9), 1.2);
    const rim = circle(plate);
    g.beginPath();
    rim.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    const plateFill = g.createRadialGradient(hub[0], hub[1], 0, hub[0], hub[1], plate * 1.1);
    plateFill.addColorStop(0, light ? rgba(palette.line, 0.2) : rgba(palette.panel, 0.95));
    plateFill.addColorStop(1, light ? rgba(palette.line, 0.08) : rgba(palette.ground, 0.9));
    g.fillStyle = plateFill;
    g.fill();
    g.strokeStyle = rgba(palette.line, 0.9);
    g.lineWidth = 1.2;
    g.stroke();
    // The small hours, from midnight to four: a wedge, and an arc outside the coil with its share.
    const wedge = [];
    for (let i = 0; i <= 24; i++) { on(r1 + 6 * k, Math.PI / 2 - (i / 24) * (TAU / 6), 0, p); wedge.push([p[0], p[1]]); }
    for (let i = 24; i >= 0; i--) { on(r0 - 6 * k, Math.PI / 2 - (i / 24) * (TAU / 6), 0, p); wedge.push([p[0], p[1]]); }
    g.beginPath();
    wedge.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = rgba(palette.late, 0.08);
    g.fill();
    const arc = [];
    for (let i = 0; i <= 32; i++) { on(clock.coil + 32 * k, Math.PI / 2 - 0.01 - (i / 32) * (TAU / 6 - 0.02), 0, p); arc.push([p[0], p[1]]); }
    g.save();
    if (!light) {
      g.shadowColor = rgba(palette.late, 0.9);
      g.shadowBlur = 12 * k * scale * density;
    }
    polyline(g, arc, rgba(palette.late, 0.95), 2 * Math.max(0.7, k));
    g.restore();
    if (wide) {
      on(clock.coil + 54, Math.PI / 2 - TAU / 12, 0, p);
      write(g, `AFTER MIDNIGHT  ${Math.round(lateShare * 100)}%`, p[0] + 6, p[1], 10, { colour: palette.late });
    }
    // Day rings, hour spokes and their labels.
    for (let i = 0; i <= days; i++) polyline(g, circle(r0 + (i / days) * (r1 - r0)), rgba(palette.line, i % 7 === 0 ? 0.9 : 0.45), 1);
    for (let h = 0; h < 24; h++) {
      const a = Math.PI / 2 - (h / 24) * TAU;
      const from = on(r0 - 8 * k, a, 0, [0, 0, 0, 0]);
      const to = on(r1 + (h % 3 === 0 ? 14 : 8) * k, a, 0, [0, 0, 0, 0]);
      polyline(g, [[from[0], from[1]], [to[0], to[1]]], rgba(palette.line, h % 3 === 0 ? 0.9 : 0.45), 1);
      if (h % 3 === 0) {
        on(clock.labels, a, 0, p);
        write(g, String(h).padStart(2, '0'), p[0], p[1] + 3.5, clock.text * p[3], { colour: h < 4 ? palette.late : palette.soft, align: 'center' });
      }
    }
    if (wide) {
      [0, 7, 14].filter((i) => i < days).forEach((i) => {
        on(r0 + ((i + 0.5) / days) * (r1 - r0), -Math.PI / 2, 0, p);
        const day = new Date((spanFrom + i * 86400 + 8 * 3600) * 1000).toISOString().slice(0, 10);
        write(g, dayLabel(day), p[0] + 6, p[1] + 3, 8.5, { colour: palette.faint });
      });
    }
    // The coil's tube: a ring of cross-sections and a few lines along it, faint, for the wire to wind round.
    const tube = clock.tube;
    for (let i = 0; i < 72; i++) {
      const u = (i / 72) * TAU;
      const section = Array.from({ length: 17 }, (_, j) => {
        const v = (j / 16) * TAU;
        const r = clock.coil + tube * Math.cos(v);
        on(r, u, tube * Math.sin(v), p);
        return [p[0], p[1]];
      });
      polyline(g, section, rgba(palette.line, 0.55), 0.7);
    }
    for (let j = 0; j < 8; j++) {
      const v = (j / 8) * TAU;
      polyline(g, Array.from({ length: 145 }, (_, i) => { on(clock.coil + tube * Math.cos(v), (i / 144) * TAU, tube * Math.sin(v), p); return [p[0], p[1]]; }), rgba(palette.line, 0.4), 0.7);
    }
    // The hub, and the thread up to the commits counted above it.
    const disc = circle(r0 - 12 * k, 0, 48);
    g.beginPath();
    disc.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = rgba(palette.ground);
    g.fill();
    g.strokeStyle = rgba(palette.line);
    g.stroke();
    const top = on(0, 0, clock.lift);
    polyline(g, [hub, [top[0], top[1]]], rgba(palette.text, 0.35), 1);
  };

  /** The ring's own parts: its tube, faint, for the files' turns to wind round, and round it the days' ticks and dates. @param {View} on */
  const paintRing = (g, on) => {
    const { ring: R, ringTube: tube, dates } = clock;
    const k = clock.r1 / 206;
    const p = [0, 0, 0, 0];
    const at = (rho, a, z = 0) => { on(rho, a, z, p); return [p[0], p[1]]; };
    for (let i = 0; i < 96; i++) {
      const u = (i / 96) * TAU;
      polyline(g, Array.from({ length: 21 }, (_, j) => at(R + tube * Math.cos((j / 20) * TAU), u, tube * Math.sin((j / 20) * TAU))), rgba(palette.line, 0.5), 0.7);
    }
    for (let j = 0; j < 12; j++) {
      const v = (j / 12) * TAU;
      polyline(g, Array.from({ length: 193 }, (_, i) => at(R + tube * Math.cos(v), (i / 192) * TAU, tube * Math.sin(v))), rgba(palette.line, 0.35), 0.7);
    }
    // A thin circle round it, a tick on it where each day starts, and the day's date where there's room: not too near
    // the last one, nor the first one round the top.
    const edge = dates - 18 * k;
    polyline(g, Array.from({ length: 193 }, (_, i) => at(edge, (i / 192) * TAU)), rgba(palette.line, 0.6), 1);
    const room = wide ? 0.3 : 0.5;
    let last = -Infinity;
    commits.forEach((commit, i) => {
      if (i > 0 && commits[i - 1].day === commit.day) return;
      const gone = (firstFile[i] / N) * TAU;
      const a = Math.PI / 2 - gone;
      polyline(g, [at(edge - 5 * k, a), at(edge + 5 * k, a)], rgba(palette.line), 1);
      if (gone - last < room || TAU - gone < room) return;
      last = gone;
      // With a shadow on the ring's plane, as the words in its middle have.
      const [x, y] = at(dates, a);
      g.save();
      castShadow(g, on, dates * Math.cos(a), dates * Math.sin(a), wide ? 9 : 7.5);
      write(g, dayLabel(commit.day), x, y + 3, wide ? 9 : 7.5, { colour: palette.faint, align: 'center' });
      g.restore();
    });
  };

  /** The repo's folders as a flame: each row a level deeper, each box as wide as its file changes. */
  const paintFlame = (g, x0, y0, width, rowH, gap) => {
    const nodes3 = data.folders;
    const children = (prefix, depth) => nodes3
      .filter(([path]) => (prefix === '' ? !path.includes('/') : path.startsWith(`${prefix}/`) && path.split('/').length === depth))
      .sort((a, b) => b[1] - a[1]);
    const lay = (prefix, depth, x) => {
      if (depth > 3) return;
      let at2 = x;
      for (const [path, n, main] of children(prefix, depth)) {
        const bw = (n / Math.max(1, totals.changes)) * width;
        if (bw >= 4) {
          const y = y0 + (depth - 1) * (rowH + gap);
          const colour = palette.parts[main];
          g.fillStyle = rgba(colour, 0.09);
          g.fillRect(at2 + 1, y, bw - 2, rowH);
          g.strokeStyle = rgba(colour, 0.85);
          g.lineWidth = 1.2;
          g.strokeRect(at2 + 1.5, y + 0.5, bw - 3, rowH - 1);
          const label = path === '(root)' ? 'root files' : path.split('/').slice(-2).join('.');
          // In the dark the name is a little lighter than its box, to read on it.
          const ink = light ? colour : colour.map((v) => v + (255 - v) * 0.35);
          if (widthOf(g, label, 9.5) + 12 < bw) write(g, label, at2 + 7, y + rowH / 2 + 3.5, 9.5, { colour: ink });
          if (bw > widthOf(g, label, 9.5) + widthOf(g, String(n), 9) + 24) write(g, String(n), at2 + bw - 7, y + rowH / 2 + 3.5, 9, { colour: palette.faint, align: 'right' });
        }
        lay(path, depth + 1, at2);
        at2 += bw;
      }
    };
    lay('', 1, x0);
  };

  /** The landscape poster's still parts: the title, the numbers' panels, the Changelog, the flame and the small print. */
  const paintWide = (g) => {
    // The title, and what the site is.
    g.fillStyle = rgba(palette.text);
    g.fillRect(14, 13, 2.5, 30);
    write(g, "JACK'S SPACE / BUILD LOG", 24, 27, 14, { spacing: 0.08 });
    write(g, `SITE HISTORY  |  ${totals.commits} COMMITS  |  ${fmt(totals.changes)} FILE CHANGES  |  SINCE ${data.started.slice(0, 4)}, REBUILT ${dayLabel(data.rebuilt)}`, 24, 43, 10, { colour: palette.soft });
    const visits = data.visits === null ? '' : `  |  VISITS ${fmt(data.visits)}`;
    // Right-aligned short of the Restart, Pause and Full screen buttons over the card's corner.
    write(g, `GIT main  |  LINES +${fmt(totals.added)} −${fmt(totals.removed)}  |  DAYS ${totals.days}${visits}`, 990, 27, 10, { colour: palette.soft, align: 'right' });
    write(g, `after-midnight ${(lateShare * 100).toFixed(1)} %`, 990, 43, 10.5, { colour: palette.late, align: 'right' });

    // Left: the big numbers' panels, with their charts.
    const lx = 14;
    const lw = 352;
    const chart = { x: lx + 196, w: lw - 208 };
    const stat = (y, title, sub) => {
      panel(g, lx, y, lw, 98, title);
      write(g, sub, lx + 12, y + 84, 10, { colour: palette.soft });
    };
    stat(60, `COMMITS  |  ${totals.days} DAYS`, `${(totals.commits / Math.max(1, totals.days)).toFixed(1)} A DAY  |  BUSIEST ${totals.busiestDay.day ? dayLabel(totals.busiestDay.day) : '-'}`);
    stepChart(g, chart.x, 86, chart.w, 36, perDay.map((d) => d.commits), rgba(palette.late), 1.3);
    stat(164, 'FILES CHANGED', `${partCount} PARTS  |  ${data.parts[0].name.toUpperCase()} ${share(0)}%  |  ${data.parts[2].name.toUpperCase()} ${share(2)}%`);
    let atX = chart.x;
    data.files.forEach((n, i) => {
      const bw = (n / Math.max(1, totals.changes)) * chart.w;
      g.fillStyle = rgba(palette.parts[i]);
      g.fillRect(atX, 203, Math.max(0, bw - 1), 10);
      atX += bw;
    });
    stat(268, 'LINES ADDED / REMOVED', `−${fmt(totals.removed)} REMOVED  |  ${fmt((totals.added + totals.removed) / Math.max(1, totals.days))} A DAY`);
    smoothChart(g, chart.x, 294, chart.w, 36, perDay.map((d) => d.lines), rgba(palette.parts[2]), 1.2);
    stat(372, 'AFTER MIDNIGHT', `OF ${totals.commits} COMMITS  |  00:00 TO 04:00`);
    panel(g, lx, 476, lw, 122, `THE LAB  |  ${labTotal} THINGS`, 'READY', palette.added);
    const groups = [[data.lab.tools, palette.parts[4]], [data.lab.games, palette.parts[2]], [data.lab.effects, palette.parts[1]], [data.lab.worlds, palette.parts[5]]];
    const perRow = Math.ceil(labTotal / 2);
    const bw = (lw - 24) / Math.max(1, perRow);
    let n = 0;
    for (const [count, colour] of groups) {
      for (let i = 0; i < count; i++, n++) {
        g.fillStyle = rgba(colour, 0.85);
        g.fillRect(lx + 12 + (n % perRow) * bw + 1, 500 + Math.floor(n / perRow) * 20 + 1, bw - 3, 16);
      }
    }
    write(g, `${data.lab.tools} TOOLS  |  ${data.lab.games} GAMES  |  ${data.lab.effects} EFFECTS  |  ${data.lab.worlds} WORLDS`, lx + 12, 562, 9.5, { colour: palette.soft });
    if (data.visits !== null) write(g, `${fmt(data.visits)} VISITS SINCE ${dayLabel(data.visitsSince)}`, lx + 12, 584, 9.5, { colour: palette.soft });

    // Right: the parts, the Changelog, the newest commits.
    const rx = 1034;
    const rw = WIDE.w - 14 - rx;
    panel(g, rx, 60, rw, 112, 'PARTS  |  FILES CHANGED');
    data.parts.forEach((part, i) => {
      write(g, String(i + 1).padStart(2, '0'), rx + 12, 94 + i * 13.4, 9.5, { colour: palette.faint });
      write(g, part.name.toUpperCase(), rx + 34, 94 + i * 13.4, 10, { colour: palette.parts[i] });
    });
    panel(g, rx, 180, rw, 136, 'CHANGELOG  |  PARETO', `${fmt(data.changelog.lines)} LINES`, palette.soft);
    pareto(g, rx + 24, 208, rw - 48, 78);
    panel(g, rx, 324, rw, 274, 'LIVE COMMITS  |  NEWEST FIRST');

    // The foot: the repo's folders, with the key.
    write(g, 'REPO FLAME  |  FOLDERS BY FILES CHANGED', 14, 670, 9.5, { colour: palette.soft });
    let keyX = WIDE.w - 14 - 560;
    const key = (label, colour) => {
      dot(g, keyX + 3, 666.5, 3, rgba(colour));
      write(g, label, keyX + 10, 670, 9, { colour: palette.soft });
      keyX += widthOf(g, label, 9) + 22;
    };
    data.parts.forEach((part, i) => key(part.name.toUpperCase(), palette.parts[i]));
    key('SMALL HOURS', palette.lateDot);
    paintFlame(g, 14, 680, WIDE.w - 28, 22, 4);
    write(g, `SOURCE: JACK'S SPACE  |  GIT HISTORY  |  CHANGELOG  |  GOATCOUNTER  |  UPDATED ${dayLabel(data.updated)} ${data.updated.slice(0, 4)}`, 14, WIDE.h - 9, 9.5, { colour: palette.faint });
  };
  const share = (part) => (totals.changes ? Math.round((100 * data.files[part]) / totals.changes) : 0);
  const stepChart = (g, x, y, w, h, values, colour, width) => {
    const max = Math.max(1, ...values);
    const step = w / Math.max(1, values.length);
    const points = [];
    values.forEach((v, i) => { const yy = y + h - (v / max) * h; points.push([x + i * step, yy], [x + (i + 1) * step, yy]); });
    polyline(g, points, colour, width);
  };
  const smoothChart = (g, x, y, w, h, values, colour, width) => {
    if (values.length < 2) return;
    const max = Math.max(1, ...values);
    const points = values.map((v, i) => [x + (i / (values.length - 1)) * w, y + h - (v / max) * h]);
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      const [px, py] = points[i - 1];
      const [cx, cy] = points[i];
      g.bezierCurveTo(px + (cx - px) / 2, py, px + (cx - px) / 2, cy, cx, cy);
    }
    g.strokeStyle = colour;
    g.lineWidth = width;
    g.stroke();
  };
  /** The Changelog's kinds, most first, with how they add up. */
  const pareto = (g, x, y0, w, h0) => {
    const y = y0 + 14;
    const h = h0 - 14;
    const total = kinds.reduce((s, [, n]) => s + n, 0) || 1;
    const max = kinds[0]?.[1] || 1;
    const bw = w / Math.max(1, kinds.length);
    let sum = 0;
    const points = [];
    kinds.forEach(([kind, n], i) => {
      const bh = (n / max) * h;
      g.fillStyle = rgba(palette.parts[2], i === 0 ? 0.9 : 0.55);
      g.fillRect(x + i * bw + bw * 0.18, y + h - bh, bw * 0.64, bh);
      write(g, kind.toUpperCase(), x + i * bw + bw / 2, y + h + 12, 9, { colour: palette.soft, align: 'center' });
      write(g, String(n), x + i * bw + bw / 2, y + h - bh - 5, 10, { align: 'center' });
      sum += n;
      points.push([x + i * bw + bw / 2, y + h - (sum / total) * h]);
    });
    polyline(g, points, rgba(palette.text, 0.85), 1.2);
    points.forEach(([px, py], i) => dot(g, px, py, i === points.length - 1 ? 3.5 : 2.4, rgba(i === 0 ? palette.late : palette.text)));
    const last = points[points.length - 1];
    if (last) write(g, '100%', last[0] - 8, last[1] - 6, 9, { colour: palette.soft, align: 'right' });
  };

  /** The tall poster's still parts: the title, and the frames for three numbers and the six parts. */
  const paintTall = (g) => {
    g.fillStyle = rgba(palette.text);
    g.fillRect(14, 16, 2, 30);
    // Just the log's name: Restart and Pause take the rest of the top, and the page's menu already says Jack's Space.
    write(g, 'BUILD LOG', 22, 30, 13, { spacing: 0.06 });
    write(g, `SINCE ${data.started.slice(0, 4)}  |  REBUILT ${dayLabel(data.rebuilt)}`, 22, 45, 9, { colour: palette.soft });
    ['COMMITS', 'AFTER MIDNIGHT', 'FILES CHANGED'].forEach((name, i) => {
      const x = 14 + i * 140;
      panel(g, x, 404, 132, 50, '');
      write(g, name, x + 8, 418, 8.5, { colour: i === 1 ? palette.late : palette.soft });
    });
    data.parts.forEach((part, i) => {
      const x = 14 + (i % 3) * 140;
      const y = 462 + Math.floor(i / 3) * 30;
      panel(g, x, y, 132, 24, '');
      dot(g, x + 10, y + 12, 3, rgba(palette.parts[i]));
      write(g, part.name.toUpperCase(), x + 18, y + 15.5, 8.5, { colour: palette.parts[i] });
    });
    write(g, `UPDATED ${dayLabel(data.updated)} ${data.updated.slice(0, 4)}`, TALL.w / 2, TALL.h - 8, 8.5, { colour: palette.faint, align: 'center' });
  };

  // ---- What's playing.
  let time = still ? INTRO + PLAY + 0.5 : 0;
  let lastPlay = 0;
  let fps = 60;

  /** Draws spike or wire `k` from its points, up to `upTo` of the way. */
  const trace = (g, points, count, k, upTo) => {
    const last = (count - 1) * upTo;
    const whole = Math.floor(last);
    const o = k * count * 2;
    g.moveTo(points[o], points[o + 1]);
    for (let j = 1; j <= whole; j++) g.lineTo(points[o + j * 2], points[o + j * 2 + 1]);
    const rest = last - whole;
    if (rest > 0 && whole + 1 < count) {
      const ax = points[o + whole * 2];
      const ay = points[o + whole * 2 + 1];
      g.lineTo(ax + (points[o + (whole + 1) * 2] - ax) * rest, ay + (points[o + (whole + 1) * 2 + 1] - ay) * rest);
    }
  };

  /**
   * Draws file c's wire onto `wg` and its spike onto `sg` (on the ring, its fibre with the wire), `amount` of the way
   * along them, in the ring's look or the clock's, as strongly as its side of the face shows (`side`); brighter while
   * it's still rising (`up`). On the ring its turn of wire is fainter, as thousands of them wind round the one tube;
   * and the nearer its place (`near`), the brighter and thicker, the far side of the ring dim, and the turn's and the
   * fibre's stretches round the back of the tube (`half`) fainter than those in front, so it reads as a ring in the
   * round.
   */
  const drawFile = (wg, sg, shapes, c, amount, ring, up, side = 1, near = 1, half = ringHalves) => {
    const part = cellParts[c];
    const home = part === 0;
    const colour = palette.parts[part];
    const k = clock.r1 / 206;
    const strength = light ? 1.45 : 1;
    const shade = ring ? side * (0.25 + 0.75 * near) : side;
    const thick = ring ? k * (0.75 + 0.5 * near) : k;
    const wire = ring ? (up ? 0.5 : home ? 0.07 : 0.14) : up ? 0.7 : home ? 0.24 : 0.48;
    if (ring) {
      for (const [key, count, alpha, width] of /** @type {const} */ ([['wires', WIRE_POINTS, Math.min(1, wire * strength), (up ? 0.8 : 0.75) * thick], ['fibres', FIBRE_POINTS, (home ? 0.12 : 0.26) * strength, 0.7 * thick]])) {
        wg.lineWidth = width;
        if (!half) {
          // While the face turns over, in one stroke each, about as strong as the front and the back come to: two
          // would make the ring's side twice the work to draw.
          wg.beginPath();
          trace(wg, shapes[key], count, c, amount);
          wg.strokeStyle = rgba(colour, alpha * shade * 0.65);
          wg.stroke();
          continue;
        }
        const front = new Path2D();
        const behind = new Path2D();
        traceHalves(shapes[key], count, c, amount, half[key], front, behind);
        wg.strokeStyle = rgba(colour, alpha * shade);
        wg.stroke(front);
        wg.strokeStyle = rgba(colour, alpha * shade * 0.3);
        wg.stroke(behind);
      }
    } else {
      wg.beginPath();
      trace(wg, shapes.wires, WIRE_POINTS, c, amount);
      wg.strokeStyle = rgba(colour, Math.min(1, wire * strength) * shade);
      wg.lineWidth = (up ? 0.8 : 0.75) * thick;
      wg.stroke();
    }
    sg.beginPath();
    trace(sg, shapes.spikes, SPIKE_POINTS, c, amount);
    sg.strokeStyle = rgba(colour, Math.min(1, (up ? (home ? 0.36 : 0.7) : home ? 0.3 : 0.62) * strength) * shade);
    sg.lineWidth = 0.9 * thick;
    sg.stroke();
    if (!up && traits[c].reach >= 0.6) {
      const o = (c * SPIKE_POINTS + SPIKE_POINTS - 1) * 2;
      dot(sg, shapes.spikes[o], shapes.spikes[o + 1], 1.4 * thick, rgba(colour, 0.95 * shade));
    }
  };

  /**
   * Traces wire or fibre `c`, `upTo` of the way along, into two paths: its stretches on the near half of the tube
   * (`front`, per point in `flags`) and those round the back.
   */
  const traceHalves = (points, count, c, upTo, flags, front, behind) => {
    const last = (count - 1) * upTo;
    for (let j = 1; j <= Math.ceil(last); j++) {
      const a = (c * count + j - 1) * 2;
      const b = a + 2;
      const f = Math.min(1, last - (j - 1));
      const path = flags[c * count + j - 1] && flags[c * count + j] ? front : behind;
      path.moveTo(points[a], points[a + 1]);
      path.lineTo(points[a] + (points[b] - points[a]) * f, points[a + 1] + (points[b + 1] - points[a + 1]) * f);
    }
  };

  /** Where `s` of the way along spike or wire `c` is. */
  const pointAt = (points, count, c, s) => {
    const along = clamp(s) * (count - 1);
    const j = Math.min(count - 2, Math.floor(along));
    const f = along - j;
    const o = (c * count + j) * 2;
    return [points[o] + (points[o + 2] - points[o]) * f, points[o + 1] + (points[o + 3] - points[o + 1]) * f];
  };

  /**
   * The finished ring's signals: as the pulse runs round the coil, each long bristle it passes fires a spark out along
   * it, which flares at the tip; as bright as its side of the face shows and as near as it is.
   */
  const sparks = (g, spikes, holdT, near, side = 1) => {
    const k = clock.r1 / 206;
    const out = 0.8;
    const flare = 0.5;
    for (let c = 0; c < N; c++) {
      if (traits[c].reach < 0.55) continue;
      // Seconds since the pulse passed this file's place.
      const since = ((((holdT / LAP - (c + 0.5) / N) % 1) + 1) % 1) * LAP;
      if (since > out + flare) continue;
      const bright = side * (0.35 + 0.65 * near[c]);
      const colour = light ? palette.parts[cellParts[c]] : WHITE;
      if (since < out) {
        const s = easeOut(since / out);
        const head = pointAt(spikes, SPIKE_POINTS, c, s);
        polyline(g, [pointAt(spikes, SPIKE_POINTS, c, s - 0.3), head], rgba(colour, 0.55 * bright), 1.1 * k);
        dot(g, head[0], head[1], 1.3 * k, rgba(colour, 0.95 * bright));
      } else {
        const t = (since - out) / flare;
        const tip = pointAt(spikes, SPIKE_POINTS, c, 1);
        dot(g, tip[0], tip[1], (1.6 + 2.4 * t) * k, rgba(colour, 0.8 * (1 - t) * bright));
      }
    }
  };

  /**
   * And a ripple, once a lap, spreading from the middle out across the ring's plane, through the coil and on past it,
   * fading, like a ring on water: it shows the plane the ring lies in, how it leans, and the words in the middle above
   * it. `on` is the ring's side.
   */
  const ripple = (g, on, holdT, side = 1) => {
    const t = (holdT % LAP) / 3.4;
    if (t >= 1) return;
    const k = clock.r1 / 206;
    const rho = 12 * k + easeOut(t) * (clock.dates + 24 * k);
    const points = Array.from({ length: 97 }, (_, i) => { const q = on(rho, (i / 96) * TAU, 0); return [q[0], q[1]]; });
    const fade = Math.sin(Math.PI * Math.min(1, t * 1.6)) * (1 - t);
    polyline(g, points, light ? rgba(palette.text, 0.3 * fade * side) : rgba(WHITE, 0.4 * fade * side), 1.2 * k);
  };

  /**
   * Once it's finished, a pulse runs round the coil, lighting the wire it passes, as strongly as its side of the face
   * shows (`side`). The ring's turns lie so close together that it lights only a few of them there, and those more
   * faintly.
   */
  const pulse = (g, wires, ring, holdT, side = 1) => {
    const at = Math.PI / 2 - (holdT / LAP) * TAU;
    const angles = ring ? ringAngle : wireAngle;
    const reach = ring ? 0.02 : 0.12;
    g.strokeStyle = light ? rgba(palette.text, (ring ? 0.3 : 0.6) * side) : rgba(WHITE, (ring ? 0.25 : 0.55) * side);
    g.lineWidth = clock.r1 / 206;
    g.beginPath();
    for (let c = 0; c < N; c++) {
      const off = Math.abs((((angles[c] - at) % TAU) + TAU + Math.PI) % TAU - Math.PI);
      if (off < reach) trace(g, wires, WIRE_POINTS, c, 1);
    }
    g.stroke();
  };

  /**
   * The clock's spots for the commits so far, the small hours' in red (the ring has none: `ring`), and with `from`, the
   * hand from there to the one being played; as strongly as their side of the face shows (`side`).
   */
  const spots = (g, nodes, playing, from, ring, side = 1) => {
    const k = Math.max(0.7, clock.r1 / 206);
    if (!ring) for (let i = 0; i <= playing; i++) dot(g, nodes[i * 2], nodes[i * 2 + 1], 2.4 * k, rgba(commits[i].hour < 4 ? palette.lateDot : palette.parts[commits[i].main], 0.95 * side));
    if (!from) return;
    const x = nodes[playing * 2];
    const y = nodes[playing * 2 + 1];
    polyline(g, [from, [x, y]], rgba(palette.text, 0.75 * side), 1.2 * k);
    g.strokeStyle = rgba(palette.text, 0.9 * side);
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(x, y, 6 * k, 0, TAU);
    g.stroke();
  };

  /** Draws a frame, `dt` seconds on; with `replay` false only the switch between the clock and the ring moves on. */
  const frame = (dt, replay = true) => {
    readPalette();
    if (replay) time += dt;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;
    // While the face turns over between the clock and the ring, each side is drawn each frame as far as it has turned;
    // once there, the faces and the landed files go back onto their canvases, the last frame of the turn fading into
    // them (they're sharper, and the ring's tube shaded front and back).
    if (m !== goal) {
      m = goal > m ? Math.min(goal, m + dt / MORPH) : Math.max(goal, m - dt / MORPH);
      if (m === goal) {
        dirty = true;
        stale = true;
        settle = SETTLE;
      }
    } else settle = Math.max(0, settle - dt);
    if (dirty) {
      paintStill();
      dirty = false;
    }
    const moving = m !== goal;
    // How far the face has turned from the clock's side to the ring's, which way round (the ring's side leans back at
    // RING_TILT + 180 one way, RING_TILT − 180 the other), and how far that is when it's edge-on.
    const turned = smooth(m);
    const span = (ahead ? RING_TILT + 180 : RING_TILT - 180) - TILT;
    const edge = ((span > 0 ? 90 : -90) - TILT) / span;
    const degrees = TILT + span * turned;
    const on = moving ? view(degrees) : m ? ringView : clockView;
    const onBack = moving ? backOf(on) : ringView;
    // Each side, with everything on it and its words in the middle, fades the whole way between resting and edge-on:
    // out as it turns away, in as it comes round. A little either side of edge-on both show, so it never goes dark.
    const front = 1 - smooth(clamp(turned / (edge + 0.05)));
    const back = smooth(clamp((turned - edge + 0.05) / (1 - edge + 0.05)));
    /** How much of the turn's last frame still shows over the finished picture. */
    const old = moving ? 0 : smooth(settle / SETTLE);
    if (moving) {
      const faces = /** @type {CanvasRenderingContext2D} */ (movingFaces.getContext('2d'));
      faces.setTransform(1, 0, 0, 1, 0, 0);
      faces.clearRect(0, 0, movingFaces.width, movingFaces.height);
      faces.setTransform(movingDensity * scale, 0, 0, movingDensity * scale, movingDensity * offX, movingDensity * offY);
      if (front > 0) {
        faces.globalAlpha = front;
        paintFace(faces, on);
      }
      if (back > 0) {
        faces.globalAlpha = back;
        paintRing(faces, onBack);
      }
      faces.globalAlpha = 1;
    }
    const shapes = m ? ringShapes : clockShapes;
    const playT = Math.max(0, time - INTRO);
    const holdT = time - (INTRO + PLAY);
    const phase = time < INTRO ? 'intro' : holdT < 0 ? 'play' : 'hold';
    const done = phase === 'hold';
    let playing = -1;
    if (phase !== 'intro') for (let i = 0; i < commits.length; i++) if (commitStart[i] <= playT) playing = i;

    // ---- The bright layer: wires on the coil, spikes on the face, the commits' spots, the hand.
    const k = clock.r1 / 206;
    if (stale || playT < lastPlay || phase === 'intro') {
      // A new round (or a new size, colours or mode): the landed spikes and wires go, to be drawn again as they land.
      stale = false;
      drawn.fill(0);
      for (const canvas of [landedWires, landedSpikes]) {
        const c2 = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
        c2.setTransform(1, 0, 0, 1, 0, 0);
        c2.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    lastPlay = playT;
    // In the dark, overlapping strokes add up to light; by day they're laid over one another, stronger to show.
    const blend = light ? 'source-over' : 'lighter';
    const landed = new Int32Array(partCount);
    const g = /** @type {CanvasRenderingContext2D} */ (glow.getContext('2d'));
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, glow.width, glow.height);
    g.globalCompositeOperation = blend;
    // Where the hand starts: the clock's hub, or just inside the ring, on the side of the face it's on.
    const hand = phase === 'play' && playing >= 0;
    const inside = (/** @type {View} */ side) => side(clock.ring - clock.ringTube - 16 * k, ringAngle[middleFile(Math.max(0, playing))], 0);
    if (moving) {
      const low = /** @type {CanvasRenderingContext2D} */ (movingFiles.getContext('2d'));
      low.setTransform(1, 0, 0, 1, 0, 0);
      low.clearRect(0, 0, movingFiles.width, movingFiles.height);
      low.setTransform(movingDensity * scale, 0, 0, movingDensity * scale, movingDensity * offX, movingDensity * offY);
      for (let c = 0; c < N; c++) if (phase !== 'intro' && playT - launch[c] >= GROW) landed[cellParts[c]]++;
      for (const [places, ring, side] of /** @type {const} */ ([[clockPlaces, false, front], [ringPlaces, true, back]])) {
        if (side <= 0) continue;
        const seen = turnedTo(places, on);
        const near = ring ? nearness(onBack, turningNear) : ringNear;
        low.globalCompositeOperation = blend;
        for (let c = 0; c < N; c++) {
          const age = phase === 'intro' ? -1 : playT - launch[c];
          if (age < 0) continue;
          const up = age < GROW;
          drawFile(low, low, seen, c, up ? easeOut(age / GROW) : 1, ring, up, side, near[c], null);
        }
        if (phase === 'hold') {
          pulse(low, seen.wires, ring, holdT, side);
          if (ring) {
            sparks(low, seen.spikes, holdT, near, side);
            ripple(low, onBack, holdT, side);
          }
        }
        low.globalCompositeOperation = 'source-over';
        spots(low, seen.nodes, playing, hand ? (ring ? inside(onBack) : hub) : null, ring, side);
      }
      g.drawImage(movingFiles, 0, 0, glow.width, glow.height);
      posterSpace(g);
    } else {
      const wireLayer = /** @type {CanvasRenderingContext2D} */ (landedWires.getContext('2d'));
      const spikeLayer = /** @type {CanvasRenderingContext2D} */ (landedSpikes.getContext('2d'));
      posterSpace(wireLayer);
      posterSpace(spikeLayer);
      wireLayer.globalCompositeOperation = blend;
      spikeLayer.globalCompositeOperation = blend;
      const growing = [];
      // Just after a turn, while its last frame fades out over them, the landed files go back onto their canvases a
      // share at a time: all at once would stall a frame.
      let budget = settle > 0 ? 120 : Infinity;
      for (let c = 0; c < N; c++) {
        const age = phase === 'intro' ? -1 : playT - launch[c];
        if (age < 0) continue;
        if (age < GROW) {
          growing.push(c);
          continue;
        }
        landed[cellParts[c]]++;
        if (drawn[c] || budget-- <= 0) continue;
        // Landed since the last frame: onto the landed canvases, once.
        drawn[c] = 1;
        drawFile(wireLayer, spikeLayer, shapes, c, 1, m === 1, false, 1, ringNear[c]);
      }
      g.globalAlpha = 1 - old;
      g.drawImage(landedWires, 0, 0);
      g.drawImage(landedSpikes, 0, 0);
      g.globalAlpha = old;
      if (old > 0) g.drawImage(movingFiles, 0, 0, glow.width, glow.height);
      g.globalAlpha = 1;
      posterSpace(g);
      // Spikes still rising, and their wires still winding on.
      for (const c of growing) drawFile(g, g, shapes, c, easeOut((playT - launch[c]) / GROW), m === 1, true, 1, ringNear[c]);
      if (phase === 'hold') {
        pulse(g, shapes.wires, m === 1, holdT);
        if (m === 1) {
          sparks(g, shapes.spikes, holdT, ringNear);
          ripple(g, ringView, holdT);
        }
      }
      g.globalCompositeOperation = 'source-over';
      spots(g, shapes.nodes, playing, hand ? (m ? inside(ringView) : hub) : null, m === 1);
    }
    g.globalCompositeOperation = 'source-over';

    // ---- Onto the stage: the still layers, the bright one, its glow, then the words that change.
    const main = ctx;
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.globalCompositeOperation = 'source-over';
    main.globalAlpha = 1;
    main.drawImage(still2d, 0, 0);
    if (moving) main.drawImage(movingFaces, 0, 0, glow.width, glow.height);
    else {
      main.globalAlpha = 1 - old;
      main.drawImage(m ? ringFace : clockFace, 0, 0);
      main.globalAlpha = old;
      if (old > 0) main.drawImage(movingFaces, 0, 0, glow.width, glow.height);
      main.globalAlpha = 1;
    }
    main.drawImage(glow, 0, 0);
    // The glow, only in the dark.
    if (!light) {
      let source = glow;
      for (const blur of blurs) {
        const b = /** @type {CanvasRenderingContext2D} */ (blur.getContext('2d'));
        b.setTransform(1, 0, 0, 1, 0, 0);
        b.clearRect(0, 0, blur.width, blur.height);
        b.imageSmoothingQuality = 'high';
        b.drawImage(source, 0, 0, blur.width, blur.height);
        source = blur;
      }
      main.globalCompositeOperation = 'lighter';
      [0.3, 0.45, 0.55].forEach((alpha, i) => {
        main.globalAlpha = alpha;
        main.drawImage(blurs[i], 0, 0, glow.width, glow.height);
      });
      main.globalCompositeOperation = 'source-over';
      main.globalAlpha = 1;
    }
    posterSpace(main);
    const shown = done ? commits.length : playing + 1;
    const files = done ? totals.changes : Math.round(landed.reduce((a, b) => a + b, 0) * data.per);
    const late = commits.slice(0, shown).filter((c) => c.hour < 4).length;
    if (wide) wideWords(main, { shown, files, late, landed, playing, phase, done });
    else tallWords(main, { shown, files, late, landed, done });
    // In the clock, the commits counted, above the hub; in the ring, the commit being played, in its middle: each with
    // its side of the face, so one has gone before the other comes.
    if (front > 0) {
      const [x, y] = on(0, 0, clock.lift);
      write(main, fmt(shown), x, y + (wide ? 6 : 4), wide ? 34 : 18, { alpha: front, align: 'center', spacing: 0 });
      write(main, 'COMMITS', x, y + (wide ? 24 : 14), wide ? 9 : 7, { colour: palette.soft, alpha: front, align: 'center' });
    }
    if (back > 0 && playing >= 0) callout(main, commits[playing], done, back, onBack);
    // The stage drew in CSS pixels before handing over: leave it that way.
    main.setTransform(density, 0, 0, density, 0, 0);
  };

  /**
   * Gives words `sizePx` big drawn next a shadow on the ring's plane, as if they stood a little above its point (x, y)
   * (the ring's side seen as `on`), higher for bigger words: it falls the way the ring leans, towards the bottom right.
   * Shadows are in the canvas's own pixels, whatever it's drawn at.
   * @param {CanvasRenderingContext2D} g @param {View} on
   */
  const castShadow = (g, on, x, y, sizePx) => {
    const foot = on(Math.hypot(x, y), Math.atan2(y, x), 0);
    const top = on(Math.hypot(x, y), Math.atan2(y, x), sizePx * 0.36);
    const t = g.getTransform();
    const px = Math.hypot(t.a, t.b);
    g.shadowOffsetX = (foot[0] - top[0]) * px;
    g.shadowOffsetY = (foot[1] - top[1]) * px;
    g.shadowBlur = sizePx * 0.12 * px;
    g.shadowColor = light ? rgba(palette.text, 0.3) : 'rgba(0, 0, 0, 0.9)';
  };

  /**
   * The ring's middle: the commit being played (once it's done, the newest), its day and time, subject and lines,
   * each with a shadow on the ring's plane under it (the ring's side seen as `on`).
   * @param {View} on
   */
  const callout = (g, commit, done, alpha, on) => {
    const [x, y] = hub;
    const tag = wide ? 10 : 7;
    const big = wide ? 26 : 14;
    const small = wide ? 11 : 7.5;
    const step = wide ? 15 : 10;
    g.save();
    castShadow(g, on, 0, 0, tag);
    write(g, `${done ? 'NEWEST' : 'COMMIT'}  ${commit.hash}`, x, y - (wide ? 42 : 24), tag, { colour: palette.soft, alpha, align: 'center' });
    castShadow(g, on, 0, 0, big);
    write(g, `${dayLabel(commit.day)}  ${commit.time}`, x, y - (wide ? 12 : 7), big, { colour: commit.hour < 4 ? palette.late : palette.text, alpha, align: 'center', spacing: 0 });
    castShadow(g, on, 0, 0, small);
    const lines = wrap(g, commit.subject.toLowerCase(), wide ? 250 : 112, small, wide ? 2 : 1);
    lines.forEach((line, i) => write(g, line, x, y + (wide ? 12 : 7) + i * step, small, { alpha, align: 'center' }));
    castShadow(g, on, 0, 0, tag);
    const plus = `+${fmt(commit.added)}`;
    const minus = `−${fmt(commit.removed)}`;
    const gap = wide ? 14 : 8;
    const left = x - (widthOf(g, plus, tag) + gap + widthOf(g, minus, tag)) / 2;
    const below = y + (wide ? 12 : 7) + lines.length * step + (wide ? 8 : 5);
    write(g, plus, left, below, tag, { colour: palette.added, alpha });
    write(g, minus, left + widthOf(g, plus, tag) + gap, below, tag, { colour: palette.soft, alpha });
    g.restore();
  };

  /** The landscape poster's numbers that grow as the commits play, the newest commits, and where the replay is. */
  const wideWords = (g, { shown, files, late, landed, playing, phase, done }) => {
    const lx = 14;
    const added = commits.slice(0, shown).reduce((s, c) => s + c.added, 0);
    write(g, fmt(shown), lx + 12, 118, 40, { spacing: 0 });
    write(g, fmt(files), lx + 12, 222, 40, { spacing: 0 });
    write(g, `+${kfmt(added)}`, lx + 12, 326, 40, { colour: palette.added, spacing: 0 });
    write(g, fmt(late), lx + 12, 430, 40, { colour: palette.late, spacing: 0 });
    // Where the replay is on the commits' and lines' charts.
    if (phase === 'play' && playing >= 0) {
      const day = clamp(Math.floor((commits[playing].at - spanFrom) / 86400), 0, days - 1);
      const x = lx + 196 + ((day + 0.5) / days) * (352 - 208);
      for (const y of [86, 294]) {
        g.fillStyle = rgba(palette.text, 0.7);
        g.fillRect(x - 0.5, y - 2, 1, 40);
      }
    }
    // The hours of the commits so far, the small hours in orange.
    const hours = new Array(24).fill(0);
    for (const c of commits.slice(0, shown)) hours[c.hour]++;
    const most = Math.max(1, ...allHours);
    const hx = lx + 196;
    const hw = (352 - 208) / 24;
    hours.forEach((n, h) => {
      const bh = Math.max(1, (n / most) * 24);
      g.fillStyle = rgba(h < 4 ? palette.late : palette.soft, h < 4 ? 1 : 0.6);
      g.fillRect(hx + h * hw + 1, 398 + 24 - bh, hw - 2, bh);
    });
    [0, 6, 12, 18].forEach((h) => write(g, String(h).padStart(2, '0'), hx + h * hw, 433, 9, { colour: palette.faint }));
    // The parts, filling as their files land.
    const rx = 1034;
    const rw = WIDE.w - 14 - rx;
    const most2 = Math.max(1, ...data.files);
    data.parts.forEach((_, i) => {
      const y = 94 + i * 13.4;
      const n = done ? data.files[i] : Math.round(landed[i] * data.per);
      const bx = rx + 12 + 118;
      const bw = rw - 24 - 118 - 92;
      g.fillStyle = rgba(palette.text, 0.07);
      g.fillRect(bx, y - 6, bw, 6);
      g.fillStyle = rgba(palette.parts[i]);
      g.fillRect(bx, y - 6, bw * (n / most2), 6);
      write(g, fmt(n), rx + rw - 52, y, 10, { align: 'right' });
      write(g, `${share(i)}%`, rx + rw - 12, y, 9.5, { colour: palette.soft, align: 'right' });
    });
    // The newest commits so far, the one playing first.
    commits.slice(0, shown).slice(-12).reverse().forEach((c, i) => {
      const y = 352 + i * 20;
      if (i === 0 && phase === 'play') {
        g.fillStyle = rgba(palette.text, 0.07);
        g.fillRect(rx + 6, y - 13, rw - 12, 18);
      }
      dot(g, rx + 15, y - 3.5, 2.6, rgba(c.hour < 4 ? palette.lateDot : palette.parts[c.main]));
      write(g, cut(g, c.subject.toLowerCase(), rw - 24 - 16 - 44, 9.5), rx + 26, y, 9.5, { colour: palette.text });
      write(g, c.time, rx + rw - 12, y, 9, { colour: c.hour < 4 ? palette.late : palette.faint, align: 'right' });
    });
    // Where the replay is, and how fast it's drawn.
    const current = commits[Math.max(0, done ? commits.length - 1 : playing)];
    const where = !current ? 'READY' : done ? `UP TO DATE  |  ${dayLabel(current.day)} ${current.time}` : phase === 'intro' ? 'READY' : `REPLAY ${shown} / ${totals.commits}  |  ${dayLabel(current.day)} ${current.time}`;
    const rate = stage.playing ? `  |  FRAME ${Math.round(fps)} FPS` : '';
    write(g, `${where}${rate}  |  REAL TELEMETRY`, WIDE.w - 14, WIDE.h - 9, 9.5, { colour: palette.faint, align: 'right' });
  };

  /** The tall poster's three numbers and the parts' counts. */
  const tallWords = (g, { shown, files, late, landed, done }) => {
    [[shown, palette.text], [late, palette.late], [files, palette.text]].forEach(([n, colour], i) => {
      write(g, fmt(/** @type {number} */ (n)), 14 + i * 140 + 8, 446, 20, { colour: /** @type {number[]} */ (colour), spacing: 0 });
    });
    data.parts.forEach((_, i) => {
      const x = 14 + (i % 3) * 140;
      const y = 462 + Math.floor(i / 3) * 30;
      write(g, fmt(done ? data.files[i] : Math.round(landed[i] * data.per)), x + 124, y + 15.5, 9, { align: 'right', spacing: 0 });
    });
  };

  // A font that comes after the first frame needs drawing in: the stage only draws again by itself while it plays,
  // and a still poster (less motion asked for, or paused) would go on without it.
  const arrived = () => {
    dirty = true;
    if (!stage.playing) frame(0);
  };
  document.fonts?.load(`500 16px ${mono}`).then(arrived).catch(() => {});

  /** Plays the replay again from the bare clock (the page's Restart button). */
  const restart = () => {
    time = 0;
    stale = true;
    if (!stage.playing) frame(0);
  };

  let ownFrame = 0;
  /**
   * Switches to the clock or the ring (the page's switch). With less motion asked for it's there at once; while the
   * stage is paused the switch still plays, on frames of its own, the replay staying where it is.
   */
  const show = (/** @type {'clock' | 'ring'} */ name) => {
    goal = name === 'ring' ? 1 : 0;
    // To the ring the face turns on to RING_TILT + 180, and back to the clock it comes from RING_TILT − 180: the same
    // angle, so it always turns over the same way round, as if spinning on. One changed on the way goes back the way
    // it came.
    if (m === 0 || m === 1) ahead = goal === 1;
    if (still && m !== goal) {
      m = goal;
      stale = true;
    }
    if (stage.playing || ownFrame) return;
    if (m === goal) {
      stale = true;
      frame(0, false);
      return;
    }
    let last = performance.now();
    const tick = (/** @type {number} */ now) => {
      ownFrame = 0;
      if (stage.playing) return;
      frame(Math.min(0.05, Math.max(0, (now - last) / 1000)), false);
      last = now;
      if (m !== goal || settle > 0) ownFrame = requestAnimationFrame(tick);
    };
    ownFrame = requestAnimationFrame(tick);
  };

  readPalette();
  fit();
  return { frame, resize: fit, restart, show };
}
