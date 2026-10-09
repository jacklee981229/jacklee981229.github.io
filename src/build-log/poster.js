// Jack's Build Log, drawn on the effects' stage (src/effects/stage.js), which runs it only while it's on screen and not
// paused: the site's history replayed on a clock tilted back like a dial on a desk. The day goes round (midnight at the
// top), the days since the rebuild go outwards; each file a commit changed stands up off the face at the commit's hour
// and day, as tall as its lines, and is wound once round the ring at the rim, like the wire of a coil. The commits play
// back in order; then the finished clock stays, a pulse running round its coil, until Restart plays it again.
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
/** How far the face leans back (degrees), its top left away from us. */
const TILT = -30;
/** Points along a spike, and along one turn of a wire. */
const SPIKE_POINTS = 9;
const WIRE_POINTS = 15;

const TAU = Math.PI * 2;
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const easeOut = (x) => 1 - (1 - x) ** 3;
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

/** Where the clock sits in each poster, and how big its parts are, in the poster's units. */
const CLOCKS = {
  wide: { cx: 700, cy: 366, r0: 62, r1: 206, coil: 236, tube: 12, labels: 276, plate: 258, eye: 1500, spike: 96, foot: 6, lift: 54, text: 10 },
  tall: { cx: 220, cy: 236, r0: 28, r1: 98, coil: 116, tube: 7, labels: 140, plate: 126, eye: 760, spike: 46, foot: 3, lift: 24, text: 8.5 },
};

/**
 * @param {import('../effects/stage.js').Stage} stage
 * @param {any} data what build-log-file.js worked out, with `parts` ({ name } for each of PARTS)
 * @param {HTMLElement} root
 */
export function createPoster(stage, data, root) {
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
  {
    let k = 0;
    commits.forEach((commit, i) => {
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

  // ---- Canvases: the still parts drawn once (the ground, the panels, the clock's face and its coil); the spikes and
  // wires drawn once each as they land, onto canvases of their own; and each frame, those and whatever is moving onto
  // the bright canvas, which is shrunk to a half, a quarter and an eighth of its size and laid back over itself,
  // blurred by the stretching, for the glow (canvas filters aren't in every browser).
  const layer = () => document.createElement('canvas');
  const still2d = layer();
  const glow = layer();
  const blurs = [layer(), layer(), layer()];
  const landedWires = layer();
  const landedSpikes = layer();
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
  // Each file's spike and wire on the poster, worked out again when the poster's size changes.
  let spikes = new Float32Array(0);
  let wires = new Float32Array(0);
  let nodes = new Float32Array(0);
  let hub = [0, 0];
  let hubTop = [0, 0];

  const fit = () => {
    density = ctx.canvas.width / Math.max(1, stage.width);
    wide = stage.width / Math.max(1, stage.height) >= 1.25;
    size = wide ? WIDE : TALL;
    clock = wide ? CLOCKS.wide : CLOCKS.tall;
    scale = Math.min(stage.width / size.w, stage.height / size.h);
    offX = (stage.width - size.w * scale) / 2;
    offY = (stage.height - size.h * scale) / 2;
    for (const [canvas, by] of [[still2d, 1], [glow, 1], [landedWires, 1], [landedSpikes, 1], [blurs[0], 2], [blurs[1], 4], [blurs[2], 8]]) {
      canvas.width = Math.max(1, Math.round(ctx.canvas.width / by));
      canvas.height = Math.max(1, Math.round(ctx.canvas.height / by));
    }
    shape();
    dirty = true;
    stale = true;
  };
  /** Draw in the poster's units. @param {CanvasRenderingContext2D} g */
  const posterSpace = (g) => g.setTransform(density * scale, 0, 0, density * scale, density * offX, density * offY);

  /** The clock's face, as a function of (distance from the middle, angle, height off the face): set by shape(). @type {(rho: number, a: number, z?: number, out?: number[]) => number[]} */
  let onFace;
  /** Works out where every spike, wire and commit sits on the poster. */
  const shape = () => {
    const project = tilted(clock.cx, clock.cy, TILT, clock.eye);
    onFace = (rho, a, z = 0, out = [0, 0, 0, 0]) => project(rho * Math.cos(a), rho * Math.sin(a), z, out);
    spikes = new Float32Array(N * SPIKE_POINTS * 2);
    wires = new Float32Array(N * WIRE_POINTS * 2);
    nodes = new Float32Array(commits.length * 2);
    const p = [0, 0, 0, 0];
    const ring = (commit) => clock.r0 + ringOf(commit) * (clock.r1 - clock.r0);
    for (let k = 0; k < N; k++) {
      const commit = commits[commitOf[k]];
      const t = traits[k];
      const a = hourAngle(commit) + t.turn;
      const rho = ring(commit) + t.out * (clock.r1 / 206);
      const height = clock.foot + clock.spike * t.reach;
      for (let j = 0; j < SPIKE_POINTS; j++) {
        const s = j / (SPIKE_POINTS - 1);
        onFace(rho + height * 0.16 * s * s, a + t.lean * 0.2 * s * s, height * s, p);
        spikes[(k * SPIKE_POINTS + j) * 2] = p[0];
        spikes[(k * SPIKE_POINTS + j) * 2 + 1] = p[1];
      }
      const u0 = hourAngle(commit) + t.wireTurn;
      const tube = clock.tube * t.wireLift;
      for (let j = 0; j < WIRE_POINTS; j++) {
        const s = j / (WIRE_POINTS - 1);
        const v = t.wireFrom + s * TAU;
        const u = u0 + s * t.wireStep;
        const r = clock.coil + tube * Math.cos(v);
        project(r * Math.cos(u), r * Math.sin(u), tube * Math.sin(v), p);
        wires[(k * WIRE_POINTS + j) * 2] = p[0];
        wires[(k * WIRE_POINTS + j) * 2 + 1] = p[1];
      }
    }
    commits.forEach((commit, i) => {
      onFace(ring(commit), hourAngle(commit), 0, p);
      nodes[i * 2] = p[0];
      nodes[i * 2 + 1] = p[1];
    });
    const base = onFace(0, 0, 0);
    hub = [base[0], base[1]];
    const top = onFace(0, 0, clock.lift);
    hubTop = [top[0], top[1]];
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

  // ---- The still layer.
  const paintStill = () => {
    cuts.clear();
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
    paintFace(g);
  };

  /** The tilted face: a plate with an edge, the small hours' wedge, day rings, hour spokes, labels, the coil's tube. */
  const paintFace = (g) => {
    const { r0, r1, plate } = clock;
    const p = [0, 0, 0, 0];
    const circle = (rho, z = 0, n = 96) => Array.from({ length: n + 1 }, (_, i) => { onFace(rho, (i / n) * TAU, z, p); return [p[0], p[1]]; });
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
    for (let i = 0; i <= 24; i++) { onFace(r1 + 6 * k, Math.PI / 2 - (i / 24) * (TAU / 6), 0, p); wedge.push([p[0], p[1]]); }
    for (let i = 24; i >= 0; i--) { onFace(r0 - 6 * k, Math.PI / 2 - (i / 24) * (TAU / 6), 0, p); wedge.push([p[0], p[1]]); }
    g.beginPath();
    wedge.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = rgba(palette.late, 0.08);
    g.fill();
    const arc = [];
    for (let i = 0; i <= 32; i++) { onFace(clock.coil + 32 * k, Math.PI / 2 - 0.01 - (i / 32) * (TAU / 6 - 0.02), 0, p); arc.push([p[0], p[1]]); }
    g.save();
    if (!light) {
      g.shadowColor = rgba(palette.late, 0.9);
      g.shadowBlur = 12 * k * scale * density;
    }
    polyline(g, arc, rgba(palette.late, 0.95), 2 * Math.max(0.7, k));
    g.restore();
    if (wide) {
      onFace(clock.coil + 54, Math.PI / 2 - TAU / 12, 0, p);
      write(g, `AFTER MIDNIGHT  ${Math.round(lateShare * 100)}%`, p[0] + 6, p[1], 10, { colour: palette.late });
    }
    // Day rings, hour spokes and their labels.
    for (let i = 0; i <= days; i++) polyline(g, circle(r0 + (i / days) * (r1 - r0)), rgba(palette.line, i % 7 === 0 ? 0.9 : 0.45), 1);
    for (let h = 0; h < 24; h++) {
      const a = Math.PI / 2 - (h / 24) * TAU;
      const from = onFace(r0 - 8 * k, a, 0, [0, 0, 0, 0]);
      const to = onFace(r1 + (h % 3 === 0 ? 14 : 8) * k, a, 0, [0, 0, 0, 0]);
      polyline(g, [[from[0], from[1]], [to[0], to[1]]], rgba(palette.line, h % 3 === 0 ? 0.9 : 0.45), 1);
      if (h % 3 === 0) {
        onFace(clock.labels, a, 0, p);
        write(g, String(h).padStart(2, '0'), p[0], p[1] + 3.5, clock.text * p[3], { colour: h < 4 ? palette.late : palette.soft, align: 'center' });
      }
    }
    if (wide) {
      [0, 7, 14].filter((i) => i < days).forEach((i) => {
        onFace(r0 + ((i + 0.5) / days) * (r1 - r0), -Math.PI / 2, 0, p);
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
        onFace(r, u, tube * Math.sin(v), p);
        return [p[0], p[1]];
      });
      polyline(g, section, rgba(palette.line, 0.55), 0.7);
    }
    for (let j = 0; j < 8; j++) {
      const v = (j / 8) * TAU;
      polyline(g, Array.from({ length: 145 }, (_, i) => { onFace(clock.coil + tube * Math.cos(v), (i / 144) * TAU, tube * Math.sin(v), p); return [p[0], p[1]]; }), rgba(palette.line, 0.4), 0.7);
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
    polyline(g, [hub, hubTop], rgba(palette.text, 0.35), 1);
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

  const frame = (dt) => {
    readPalette();
    time += dt;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;
    if (dirty) {
      paintStill();
      dirty = false;
    }
    const playT = Math.max(0, time - INTRO);
    const holdT = time - (INTRO + PLAY);
    const phase = time < INTRO ? 'intro' : holdT < 0 ? 'play' : 'hold';
    const done = phase === 'hold';
    let playing = -1;
    if (phase !== 'intro') for (let i = 0; i < commits.length; i++) if (commitStart[i] <= playT) playing = i;

    // ---- The bright layer: wires on the coil, spikes on the face, the commits' spots, the hand.
    const k = clock.r1 / 206;
    if (stale || playT < lastPlay || phase === 'intro') {
      // A new round (or a new size or colours): the landed spikes and wires go, to be drawn again as they land.
      stale = false;
      drawn.fill(0);
      for (const canvas of [landedWires, landedSpikes]) {
        const c2 = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
        c2.setTransform(1, 0, 0, 1, 0, 0);
        c2.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    lastPlay = playT;
    const wireLayer = /** @type {CanvasRenderingContext2D} */ (landedWires.getContext('2d'));
    const spikeLayer = /** @type {CanvasRenderingContext2D} */ (landedSpikes.getContext('2d'));
    posterSpace(wireLayer);
    posterSpace(spikeLayer);
    // In the dark, overlapping strokes add up to light; by day they're laid over one another, stronger to show.
    const blend = light ? 'source-over' : 'lighter';
    const strength = light ? 1.45 : 1;
    wireLayer.globalCompositeOperation = blend;
    spikeLayer.globalCompositeOperation = blend;
    const landed = new Int32Array(partCount);
    const growing = [];
    for (let c = 0; c < N; c++) {
      const age = phase === 'intro' ? -1 : playT - launch[c];
      if (age < 0) continue;
      if (age < GROW) {
        growing.push(c);
        continue;
      }
      const part = cellParts[c];
      landed[part]++;
      if (drawn[c]) continue;
      // Landed since the last frame: onto the landed canvases, once.
      drawn[c] = 1;
      wireLayer.beginPath();
      trace(wireLayer, wires, WIRE_POINTS, c, 1);
      wireLayer.strokeStyle = rgba(palette.parts[part], (part === 0 ? 0.24 : 0.48) * strength);
      wireLayer.lineWidth = 0.75 * k;
      wireLayer.stroke();
      spikeLayer.beginPath();
      trace(spikeLayer, spikes, SPIKE_POINTS, c, 1);
      spikeLayer.strokeStyle = rgba(palette.parts[part], (part === 0 ? 0.3 : 0.62) * strength);
      spikeLayer.lineWidth = 0.9 * k;
      spikeLayer.stroke();
      if (traits[c].reach >= 0.6) {
        const o = (c * SPIKE_POINTS + SPIKE_POINTS - 1) * 2;
        dot(spikeLayer, spikes[o], spikes[o + 1], 1.4 * k, rgba(palette.parts[part], 0.95));
      }
    }
    const g = /** @type {CanvasRenderingContext2D} */ (glow.getContext('2d'));
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, glow.width, glow.height);
    g.globalCompositeOperation = blend;
    g.drawImage(landedWires, 0, 0);
    g.drawImage(landedSpikes, 0, 0);
    posterSpace(g);
    // Spikes still rising, and their wires still winding on.
    for (const c of growing) {
      const part = cellParts[c];
      const amount = easeOut((playT - launch[c]) / GROW);
      g.beginPath();
      trace(g, spikes, SPIKE_POINTS, c, amount);
      g.strokeStyle = rgba(palette.parts[part], Math.min(1, (part === 0 ? 0.36 : 0.7) * strength));
      g.lineWidth = 0.9 * k;
      g.stroke();
      g.beginPath();
      trace(g, wires, WIRE_POINTS, c, amount);
      g.strokeStyle = rgba(palette.parts[part], Math.min(1, 0.7 * strength));
      g.lineWidth = 0.8 * k;
      g.stroke();
    }
    // Once it's finished, a pulse runs round the coil, lighting the wire it passes.
    if (phase === 'hold') {
      const pulse = Math.PI / 2 - (holdT / LAP) * TAU;
      g.strokeStyle = light ? rgba(palette.text, 0.6) : rgba(WHITE, 0.55);
      g.lineWidth = 1 * k;
      g.beginPath();
      for (let c = 0; c < N; c++) {
        const off = Math.abs((((wireAngle[c] - pulse) % TAU) + TAU + Math.PI) % TAU - Math.PI);
        if (off < 0.12) trace(g, wires, WIRE_POINTS, c, 1);
      }
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    // The commits' spots, the small hours' in red.
    for (let i = 0; i <= playing; i++) dot(g, nodes[i * 2], nodes[i * 2 + 1], 2.4 * Math.max(0.7, k), rgba(commits[i].hour < 4 ? palette.lateDot : palette.parts[commits[i].main], 0.95));
    // The hand, pointing at the commit being played.
    if (phase === 'play' && playing >= 0) {
      const x = nodes[playing * 2];
      const y = nodes[playing * 2 + 1];
      polyline(g, [hub, [x, y]], rgba(palette.text, 0.75), 1.2 * Math.max(0.7, k));
      g.strokeStyle = rgba(palette.text, 0.9);
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(x, y, 6 * Math.max(0.7, k), 0, TAU);
      g.stroke();
    }

    // ---- Onto the stage: the still layer, the bright one, its glow, then the words that change.
    const main = ctx;
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.globalCompositeOperation = 'source-over';
    main.globalAlpha = 1;
    main.drawImage(still2d, 0, 0);
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
    // The commits counted, above the hub.
    write(main, fmt(shown), hubTop[0], hubTop[1] + (wide ? 6 : 4), wide ? 34 : 18, { align: 'center', spacing: 0 });
    write(main, 'COMMITS', hubTop[0], hubTop[1] + (wide ? 24 : 14), wide ? 9 : 7, { colour: palette.soft, align: 'center' });
    // The stage drew in CSS pixels before handing over: leave it that way.
    main.setTransform(density, 0, 0, density, 0, 0);
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

  readPalette();
  fit();
  return { frame, resize: fit, restart };
}
