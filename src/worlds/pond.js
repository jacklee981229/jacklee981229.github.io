// Jack's Pond on the Effects' stage (src/effects/stage.js): a clear spring pond seen from above, whose koi swim by
// themselves. The look is the Sunlit Spring mockup's: clear shallow water over sand and a winding bar of gravel,
// sunlight rippling over the bed, mossy boulders along the left bank, maple leaves floating with their shadows below,
// and the sun's glints. What never moves (the bed, the boulders) is drawn once into pictures of its own; each frame
// lays them down with the ripples, the shadows, the fish, the leaves and the glints over them. The swimming is the old
// fishing pond's: a spine that bends as the head turns, a wave down it, calm wandering, changing depth, keeping off the
// edges and out of each other's way. Every colour is a --pond-* token (tokens.css) or a lighter or darker mix of one.

const TAU = Math.PI * 2;
/** The stage at which the mockup's sizes hold: 1280 by 800. Sizes grow with the stage's area, not its count of things. */
const MOCK = Math.sqrt(1280 * 800);
/** The pond's colours, each from its --pond-* token. */
const NAMES = ['sand', 'pebble-grey', 'pebble-tan', 'pebble-brown', 'water', 'shade', 'stone', 'moss', 'leaf-red', 'leaf-orange', 'koi-red', 'koi-white', 'koi-ink', 'koi-gold', 'koi-brown', 'light'];
/** Sunlight comes from the top right, so shadows fall down and a little to the right. */
const SHADOW = { x: 0.55, y: 0.85 };
/** The koi: their looks and lengths, in pixels at the mockup's size. */
const SCHOOL = [['kohaku', 100], ['kohaku', 92], ['kohaku', 80], ['kohaku', 70], ['kohaku', 62], ['showa', 96], ['showa', 74], ['tancho', 76], ['yamabuki', 94], ['yamabuki', 68], ['chagoi', 102], ['chagoi', 78]];
/** Half a body's width along its length, nose (0) to the tail's root (1), as a share of its widest: a torpedo, widest
 *  just behind the gills, with a wide head and a tail root that stays thick. */
const PROFILE = [0.64, 0.88, 0.98, 1, 0.98, 0.92, 0.82, 0.69, 0.55, 0.42, 0.32];
/** The floating maple leaves: where (shares of the stage), how they lie, their size and colour. */
const LEAVES = [[0.79, 0.15, 20, 50, 'leaf-red'], [0.44, 0.86, -40, 44, 'leaf-orange'], [0.93, 0.6, 75, 38, 'leaf-red'], [0.28, 0.12, 130, 42, 'leaf-orange']];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** @param {number[]} a @param {number[]} b @param {number} t */
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
/** @param {number[]} c @param {number} t */
const lighter = (c, t) => mix(c, [255, 255, 255], t);
/** @param {number[]} c @param {number} t */
const darker = (c, t) => mix(c, [0, 0, 0], t);
/** @param {number[]} c */
const css = (c, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
/** A gaussian number, for the swimming's wander. */
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(TAU * Math.random());

/** Seeded, so the pond and its fish look the same every time it opens; only the swimming uses Math.random. @param {number} seed */
function makeRand(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A canvas of a size in CSS pixels, drawn on at the stage's density. @param {number} w @param {number} h @param {number} density */
function layer(w, h, density) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * density));
  c.height = Math.max(1, Math.round(h * density));
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.setTransform(density, 0, 0, density, 0, 0);
  return { c, g };
}

/** Curves through the midpoints of a list of points, so outlines come out round. @param {Path2D} path @param {number[][]} pts */
function smoothOpen(path, pts) {
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) path.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  const end = pts[pts.length - 1];
  path.lineTo(end[0], end[1]);
}

/** @param {Path2D} path @param {number[][]} pts */
function smoothClosed(path, pts) {
  const n = pts.length;
  const mid = (/** @type {number} */ i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
  const start = mid(n - 1);
  path.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    path.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  path.closePath();
}

/** A stone's or a boulder's outline: a circle with a few soft bumps. */
function blob(/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ R, /** @type {() => number} */ r, squash = 0.9) {
  const ph = [r() * TAU, r() * TAU, r() * TAU];
  const pts = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    const k = 1 + 0.08 * Math.sin(2 * a + ph[0]) + 0.05 * Math.sin(3 * a + ph[1]) + 0.03 * Math.sin(5 * a + ph[2]);
    pts.push([cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k * squash]);
  }
  const path = new Path2D();
  smoothClosed(path, pts);
  return path;
}

/** A maple leaf of radius R round its middle: five lobes, small teeth, veins and a stem. @param {number} R */
function maple(R) {
  const lobes = [[155, 0.62], [212, 0.92], [270, 1], [328, 0.92], [25, 0.62]].map(([d, l]) => [(d * Math.PI) / 180, l]);
  const shape = new Path2D();
  for (let k = 0; k < 150; k++) {
    const ph = (k / 150) * TAU;
    let m = 0.3;
    for (const [th, l] of lobes) {
      const d = Math.abs(Math.atan2(Math.sin(ph - th), Math.cos(ph - th)));
      if (d < 0.42) m = Math.max(m, 0.3 + (l - 0.3) * Math.pow(1 - d / 0.42, 1.25));
    }
    const reach = R * (m + (k % 4 === 0 && m > 0.45 ? 0.05 : 0));
    if (k) shape.lineTo(Math.cos(ph) * reach, Math.sin(ph) * reach);
    else shape.moveTo(Math.cos(ph) * reach, Math.sin(ph) * reach);
  }
  shape.closePath();
  const veins = new Path2D();
  for (const [th, l] of lobes) {
    veins.moveTo(0, R * 0.05);
    veins.lineTo(Math.cos(th) * R * l * 0.88, Math.sin(th) * R * l * 0.88);
  }
  const stem = new Path2D();
  stem.moveTo(0, R * 0.2);
  stem.quadraticCurveTo(R * 0.04, R * 0.5, R * 0.12, R * 0.82);
  return { shape, veins, stem };
}

/**
 * Noise from the browser's own SVG turbulence, as a picture: the bed's mottle and grain, and the sunlight's ripples.
 * The matrix turns the noise into one colour and how much of it shows. Resolves to null if the picture can't be made.
 * @param {number} w @param {number} h @param {number} density
 * @param {{ type: string, freq: string, octaves: number, seed: number, matrix: string, blur?: number }} o
 * @returns {Promise<HTMLImageElement | null>}
 */
function turbulence(w, h, density, o) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * density)}" height="${Math.round(h * density)}" viewBox="0 0 ${w} ${h}"><filter id="f" x="0" y="0" width="100%" height="100%"><feTurbulence type="${o.type}" baseFrequency="${o.freq}" numOctaves="${o.octaves}" seed="${o.seed}"/><feColorMatrix type="matrix" values="${o.matrix}"/>${o.blur ? `<feGaussianBlur stdDeviation="${o.blur}"/>` : ''}</filter><rect width="${w}" height="${h}" filter="url(#f)"/></svg>`;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
/** A colour matrix that paints `c` with the noise's alpha scaled and shifted. @param {number[]} c @param {string} alpha */
const tint = (c, alpha) => `0 0 0 0 ${(c[0] / 255).toFixed(3)} 0 0 0 0 ${(c[1] / 255).toFixed(3)} 0 0 0 0 ${(c[2] / 255).toFixed(3)} ${alpha}`;

/** @param {import('../effects/stage.js').Stage} stage */
export default function pond(stage) {
  const { ctx } = stage;
  const taster = /** @type {CanvasRenderingContext2D} */ (document.createElement('canvas').getContext('2d'));
  /** @param {string} value @returns {number[]} */
  const rgbOf = (value) => {
    taster.fillStyle = '#808080';
    taster.fillStyle = value.trim();
    const set = String(taster.fillStyle);
    if (set[0] === '#') return [1, 3, 5].map((i) => parseInt(set.slice(i, i + 2), 16));
    return (set.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  };
  /** @type {Record<string, number[]>} */
  let C = {};
  let colorsSeen = stage.colors;
  const readTokens = () => {
    const style = getComputedStyle(ctx.canvas);
    C = Object.fromEntries(NAMES.map((n) => [n, rgbOf(style.getPropertyValue(`--pond-${n}`) || '#808080')]));
  };

  let W = 1, H = 1, unit = 1, density = 1;
  /** @type {HTMLCanvasElement | null} */ let bed = null;
  /** @type {HTMLCanvasElement | null} */ let over = null;
  /** @type {(HTMLImageElement | null)[]} */ let ripples = [null, null];
  /** The fish's and the leaves' shadows, drawn small and scaled up, which softens them for free. */
  let shade = layer(1, 1, 1);
  let built = 0;

  // The pond's layout, seeded: the same pond every time, laid out over whatever size the stage has.
  const lay = makeRand(2026);
  const pebbleSeeds = { bar: lay() * 1e9, deep: lay() * 1e9, fine: lay() * 1e9 };
  const boulderSpots = [[-40, 0.14, 150], [30, 0.54, 105], [-60, 0.9, 150], [150, 0.34, 40], [118, 0.73, 30]];
  const glints = Array.from({ length: 18 }, () => ({ x: lerp(0.766, 0.97, lay()), y: lerp(0.05, 0.3, lay()), s: 3 + lay() * 5, at: lay() * 2.8 }));
  const leaves = LEAVES.map(([x, y, angle, R, colour], i) => ({ x, y, angle: (Number(angle) * Math.PI) / 180, R: Number(R), colour: String(colour), shape: maple(Number(R)), at: -i * 2.3 }));

  /** Draws `paint` at a fraction `k` of the size and lays it down scaled up: a soft blur that works in every browser,
   *  where the canvas's own blur filter doesn't (Safari). @param {CanvasRenderingContext2D} g @param {number} k
   *  @param {(small: CanvasRenderingContext2D) => void} paint */
  const soften = (g, k, paint) => {
    const small = layer(W * k, H * k, 1);
    small.g.scale(k, k);
    paint(small.g);
    g.drawImage(small.c, 0, 0, W, H);
  };

  /** The bed (sand, its mottle and grain, a sunk leaf, the gravel, the boulders' shade on the water) and what lies over
   *  the fish (the boulders and the sun's glow), drawn for this size and these colours. */
  const build = () => {
    const stamp = ++built;
    const { c: bedC, g } = layer(W, H, density);
    const sand = g.createLinearGradient(0, 0, W, H);
    sand.addColorStop(0, css(lighter(C.sand, 0.4)));
    sand.addColorStop(0.6, css(C.sand));
    sand.addColorStop(1, css(darker(C.sand, 0.12)));
    g.fillStyle = sand;
    g.fillRect(0, 0, W, H);

    // A leaf that sank long ago, soft under the water.
    const sunk = maple(38 * unit);
    soften(g, 0.35, (s) => {
      s.translate(W * 0.64, H * 0.86);
      s.rotate((-25 * Math.PI) / 180);
      s.fillStyle = css(darker(C['leaf-red'], 0.45), 0.55);
      s.fill(sunk.shape);
    });

    // A bar of gravel winds across the bed; the shallows by the bank stay sandy and the deep side has bigger stones.
    const tones = [C['pebble-grey'], C['pebble-tan'], C['pebble-brown'], mix(C['pebble-grey'], C['pebble-brown'], 0.5), lighter(C['pebble-tan'], 0.15), darker(C['pebble-grey'], 0.12)];
    const s = g;
    const pebble = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ rx, /** @type {() => number} */ r) => {
      const ry = rx * (0.66 + r() * 0.28), rot = r() * Math.PI, tone = tones[Math.floor(r() * tones.length)];
      s.fillStyle = css(darker(C.shade, 0.15), 0.32);
      s.beginPath();
      s.ellipse(x + rx * 0.18, y + ry * 0.3, rx * 1.08, ry * 1.08, rot, 0, TAU);
      s.fill();
      const gr = s.createRadialGradient(x - rx * 0.3, y - ry * 0.35, 0, x, y, Math.max(rx, ry));
      gr.addColorStop(0, css(lighter(tone, 0.12)));
      gr.addColorStop(0.75, css(tone));
      gr.addColorStop(1, css(darker(tone, 0.22)));
      s.fillStyle = gr;
      s.beginPath();
      s.ellipse(x, y, rx, ry, rot, 0, TAU);
      s.fill();
    };
    const area = (W * H) / (MOCK * MOCK);
    const bar = makeRand(pebbleSeeds.bar), deep = makeRand(pebbleSeeds.deep), fine = makeRand(pebbleSeeds.fine);
    const bell = (/** @type {() => number} */ r) => (r() + r() + r() + r() - 2) / 2;
    for (let i = 0; i < 260 * area; i++) {
      const u = lerp(0.14, 1, bar());
      pebble(u * W, H * (0.7 - 0.512 * u + 0.0875 * Math.sin(7.53 * u)) + bell(bar) * 110 * unit, (3.5 + 8 * Math.pow(bar(), 1.6)) * unit, bar);
    }
    for (let i = 0; i < 36 * area; i++) pebble(lerp(0.44, 1, deep()) * W, deep() * H, (12 + 14 * deep()) * unit, deep);
    for (let i = 0; i < 50 * area; i++) pebble(lerp(0.125, 1, fine()) * W, fine() * H, (2 + 3 * fine()) * unit, fine);

    // The boulders' shade falls on the water beside them.
    const rocks = makeRand(77);
    const boulders = boulderSpots.map(([x, y, R]) => {
      const path = blob(x * unit, y * H, R * unit, rocks);
      const moss = Array.from({ length: 7 }, () => {
        const a = rocks() * TAU, d = rocks() * R * 0.8 * unit;
        return { x: x * unit + Math.cos(a) * d, y: y * H + Math.sin(a) * d, r: R * unit * (0.25 + rocks() * 0.3) };
      });
      return { path, moss, x: x * unit, y: y * H, R: R * unit };
    });
    soften(g, 1 / 12, (s) => {
      s.translate(26 * unit, 34 * unit);
      s.fillStyle = css(darker(C.shade, 0.2), 0.5);
      for (const b of boulders) s.fill(b.path);
    });
    bed = bedC;

    // What lies over the fish: the boulders, wet and mossy, and the sun's glow from the top right.
    const top = layer(W, H, density);
    const o = top.g;
    // The water darkens round each boulder where it meets the stone.
    soften(o, 0.2, (s) => {
      s.strokeStyle = css(darker(C.shade, 0.25), 0.55);
      s.lineWidth = 18 * unit;
      for (const b of boulders) s.stroke(b.path);
    });
    for (const b of boulders) {
      const stone = o.createRadialGradient(b.x - b.R * 0.36, b.y - b.R * 0.44, 0, b.x, b.y, b.R * 1.05);
      stone.addColorStop(0, css(lighter(C.stone, 0.25)));
      stone.addColorStop(0.55, css(C.stone));
      stone.addColorStop(1, css(darker(C.stone, 0.34)));
      o.fillStyle = stone;
      o.fill(b.path);
      o.save();
      o.clip(b.path);
      for (const m of b.moss) {
        const gm = o.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
        gm.addColorStop(0, css(C.moss, 0.95));
        gm.addColorStop(1, css(darker(C.moss, 0.24), 0));
        o.fillStyle = gm;
        o.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
      }
      // Wet at the waterline: the stone darkens towards its edge.
      soften(o, 0.2, (s) => {
        s.strokeStyle = css(darker(C.shade, 0.3), 0.45);
        s.lineWidth = 22 * unit;
        s.stroke(b.path);
      });
      o.restore();
    }
    const glow = o.createRadialGradient(W * 0.88, H * 0.12, 0, W * 0.88, H * 0.12, Math.max(W, H) * 0.45);
    glow.addColorStop(0, css(C.light, 0.22));
    glow.addColorStop(1, css(C.light, 0));
    o.fillStyle = glow;
    o.fillRect(0, 0, W, H);
    over = top.c;

    // The bed's mottle and grain, and the sunlight's two ripple layers, from the browser's noise: they come a moment later.
    const pad = 80 * unit;
    Promise.all([
      turbulence(W, H, density, { type: 'fractalNoise', freq: `${(0.006 / unit).toFixed(5)} ${(0.009 / unit).toFixed(5)}`, octaves: 3, seed: 21, matrix: tint(darker(C.sand, 0.5), '0 0 0 -2.6 1.45') }),
      turbulence(W, H, density, { type: 'fractalNoise', freq: '0.85', octaves: 2, seed: 7, matrix: tint(darker(C.sand, 0.62), '0 0 0 -1.6 1') }),
      turbulence(W + pad * 2, H + pad * 2, Math.min(density, 1.5), { type: 'turbulence', freq: `${(0.0105 / unit).toFixed(5)} ${(0.0145 / unit).toFixed(5)}`, octaves: 2, seed: 11, matrix: tint(C.light, '-9 0 0 0 1.3'), blur: 1.1 * unit }),
      turbulence(W + pad * 2, H + pad * 2, Math.min(density, 1.5), { type: 'turbulence', freq: `${(0.0135 / unit).toFixed(5)} ${(0.0115 / unit).toFixed(5)}`, octaves: 2, seed: 29, matrix: tint(C.light, '-10 0 0 0 1.25'), blur: 1.4 * unit }),
    ]).then(([mottle, grain, a, b]) => {
      if (stamp !== built) return;
      g.save();
      if (mottle) { g.globalAlpha = 0.55; g.drawImage(mottle, 0, 0, W, H); }
      if (grain) { g.globalAlpha = 0.4; g.drawImage(grain, 0, 0, W, H); }
      g.restore();
      ripples = [a, b];
      // A still pond (paused, or with reduced motion) gets its picture again, now with these in it.
      if (!stage.playing) draw(0);
    });
  };

  // ---- The koi --------------------------------------------------------------------------------------------------

  /** A patch of colour on a fish, in body terms (see `at`), with its jagged edge; `soft` softens its front edge. */
  const patch = (/** @type {number} */ s, /** @type {number} */ t, /** @type {number} */ rs, /** @type {number} */ rt, /** @type {string} */ colour, jag = 0.22, soft = false) => ({ s, t, rs, rt, colour, soft, jag: Array.from({ length: 12 }, () => (lay() * 2 - 1) * jag) });
  /** Red blocks down a white or black back, as on a kohaku or a showa, the first on the head. */
  const blocks = (/** @type {boolean} */ head) => {
    const out = [];
    if (head) out.push(patch(0.09, (lay() - 0.5) * 0.3, 0.075, 0.95, 'koi-red', 0.22, true));
    let at = 0.2 + lay() * 0.08;
    while (at < 0.72) {
      const rs = 0.07 + lay() * 0.07;
      out.push(patch(at + rs, (lay() - 0.5) * 0.6, rs, 1 + lay() * 0.6, 'koi-red', 0.22, true));
      at += rs * 2 + 0.05 + lay() * 0.08;
    }
    return out;
  };
  /** @type {Record<string, () => { base: string, fin: string, patches: ReturnType<typeof patch>[], sheen: number, dark?: boolean }>} */
  const LOOKS = {
    kohaku: () => ({ base: 'koi-white', fin: 'koi-white', patches: blocks(lay() < 0.8), sheen: 0.16 }),
    tancho: () => ({ base: 'koi-white', fin: 'koi-white', patches: [patch(0.1, 0, 0.055, 0.42, 'koi-red', 0.06)], sheen: 0.16 }),
    showa: () => ({ base: 'koi-ink', fin: 'koi-ink', patches: [...blocks(true), patch(0.45, 0.4, 0.08, 0.6, 'koi-white'), patch(0.66, -0.5, 0.06, 0.5, 'koi-white')], sheen: 0.12, dark: true }),
    yamabuki: () => ({ base: 'koi-gold', fin: 'koi-gold', patches: [], sheen: 0.38 }),
    chagoi: () => ({ base: 'koi-brown', fin: 'koi-brown', patches: [], sheen: 0.22 }),
  };

  // The scales: a faint net of arcs, one for dark fish and one for light, turned with each fish.
  const scaleTile = (/** @type {boolean} */ light) => {
    const t = layer(9, 8, 2);
    t.g.strokeStyle = light ? 'rgba(255, 255, 255, 1)' : css(darker(C['koi-brown'] ?? [58, 42, 26], 0.55));
    t.g.lineWidth = 0.7;
    t.g.beginPath();
    t.g.moveTo(0, 0); t.g.quadraticCurveTo(4.5, 4, 0, 8);
    t.g.moveTo(4.5, -4); t.g.quadraticCurveTo(9, 0, 4.5, 4);
    t.g.moveTo(4.5, 4); t.g.quadraticCurveTo(9, 8, 4.5, 12);
    t.g.stroke();
    return ctx.createPattern(t.c, 'repeat');
  };
  /** @type {(CanvasPattern | null)[]} */
  let scales = [null, null];

  const fishes = SCHOOL.map(([look, size]) => {
    const n = 14;
    return {
      look: LOOKS[look](), size: Number(size), n,
      heading: Math.random() * TAU, turn: 0, speed: 0, goal: 0, next: 0,
      depth: lerp(0.05, 0.85, Math.random()), depthGoal: 0, dive: lerp(4, 16, Math.random()), phase: Math.random() * TAU,
      len: 0, seg: 0, wid: 0, tail: 0, fin: 0, cruise: 0, maxTurn: 1.3,
      /** @type {{ x: number, y: number }[]} */ pts: [],
      rp: Array.from({ length: n }, () => ({ x: 0, y: 0, tx: 1, ty: 0 })),
      body: new Path2D(), tailPath: new Path2D(), rays: new Path2D(),
    };
  });
  /** @typedef {typeof fishes[number]} Fish */

  /** Sizes and speeds follow the stage, so a bigger stage gets bigger fish, not more of them. @param {Fish} f */
  const fit = (f) => {
    f.len = f.size * unit;
    f.seg = f.len / (f.n - 1);
    f.wid = f.len * 0.27;
    f.tail = f.len * 0.3;
    f.fin = f.len * 0.27;
    f.cruise = f.len * 0.36;
  };
  /** @param {Fish} f @param {number} s */
  const halfWidth = (f, s) => {
    const x = clamp(s, 0, 1) * 10, i = Math.min(9, Math.floor(x));
    return (lerp(PROFILE[i], PROFILE[i + 1], x - i) * f.wid) / 2;
  };

  /** @param {Fish} f @param {number} dt */
  const swim = (f, dt) => {
    // The turn drifts at random but keeps settling back to straight, which reads as a calm wander.
    f.turn += -f.turn * 0.9 * dt + 0.9 * Math.sqrt(dt) * gauss();
    const head = f.pts[0];
    const m = Math.min(W, H) * 0.07 + f.len * 0.5;
    let ax = 0, ay = 0;
    if (head.x < m) ax += (m - head.x) / m; else if (head.x > W - m) ax -= (head.x - W + m) / m;
    if (head.y < m) ay += (m - head.y) / m; else if (head.y > H - m) ay -= (head.y - H + m) / m;
    // Fish at about the same depth keep a little apart; at different depths they pass over each other.
    for (const o of fishes) {
      if (o === f || Math.abs(o.depth - f.depth) > 0.3) continue;
      const dx = head.x - o.pts[0].x, dy = head.y - o.pts[0].y, d = Math.hypot(dx, dy), reach = (f.len + o.len) * 0.5;
      if (d > 0 && d < reach) {
        ax += (dx / d) * (1 - d / reach) * 0.8;
        ay += (dy / d) * (1 - d / reach) * 0.8;
      }
    }
    let steer = 0;
    if (ax || ay) steer = wrapAngle(Math.atan2(ay, ax) - f.heading) * Math.min(1.5, Math.hypot(ax, ay)) * 1.6;
    f.heading = wrapAngle(f.heading + clamp(f.turn + steer, -f.maxTurn, f.maxTurn) * dt);
    if ((f.next -= dt) <= 0) {
      f.goal = f.cruise * (Math.random() < 0.2 ? 0.45 : lerp(0.75, 1.25, Math.random()));
      f.next = lerp(3, 10, Math.random());
    }
    f.speed += (f.goal - f.speed) * Math.min(1, dt * 0.7);
    if ((f.dive -= dt) <= 0) {
      f.dive = lerp(8, 20, Math.random());
      f.depthGoal = lerp(0.05, 0.9, Math.random());
    }
    f.depth += clamp(f.depthGoal - f.depth, -0.04 * dt, 0.04 * dt);
    f.phase += dt * TAU * 1.1 * (0.35 + 0.65 * (f.speed / f.cruise));
    head.x += Math.cos(f.heading) * f.speed * dt;
    head.y += Math.sin(f.heading) * f.speed * dt;
    // Each joint follows the one ahead at a fixed distance, so the body bends along the path the head took.
    let prev = f.heading;
    for (let i = 1; i < f.n; i++) {
      const p = f.pts[i], q = f.pts[i - 1];
      let a = Math.atan2(q.y - p.y, q.x - p.x);
      const bend = wrapAngle(a - prev);
      if (bend > 0.18) a = prev + 0.18; else if (bend < -0.18) a = prev - 0.18;
      p.x = q.x - Math.cos(a) * f.seg;
      p.y = q.y - Math.sin(a) * f.seg;
      prev = a;
    }
  };

  /** The body's outline, the tail and its rays, with the swimming wave down the spine. @param {Fish} f */
  const buildBody = (f) => {
    const n = f.n, p = f.pts, rp = f.rp;
    const effort = 0.3 + 0.7 * Math.min(1.2, f.speed / f.cruise);
    const swing = f.len * 0.045 * effort;
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1);
      const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
      const l = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const off = swing * (0.1 + 0.9 * s * s) * Math.sin(f.phase - s * 4.5);
      rp[i].x = p[i].x - ((a.y - b.y) / l) * off;
      rp[i].y = p[i].y + ((a.x - b.x) / l) * off;
    }
    for (let i = 0; i < n; i++) {
      const a = rp[Math.max(0, i - 1)], b = rp[Math.min(n - 1, i + 1)];
      const l = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      rp[i].tx = (a.x - b.x) / l;
      rp[i].ty = (a.y - b.y) / l;
    }
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const q = rp[i], hw = halfWidth(f, i / (n - 1));
      left.push([q.x - q.ty * hw, q.y + q.tx * hw]);
      right.push([q.x + q.ty * hw, q.y - q.tx * hw]);
    }
    // A wide, rounded nose.
    const h = rp[0], hw0 = halfWidth(f, 0), nose = [];
    for (let k = 1; k < 8; k++) {
      const th = Math.PI / 2 - (k * Math.PI) / 8;
      const fw = hw0 * 0.95 * Math.cos(th), sw = hw0 * Math.sin(th);
      nose.push([h.x + h.tx * fw - h.ty * sw, h.y + h.ty * fw + h.tx * sw]);
    }
    f.body = new Path2D();
    smoothOpen(f.body, [...left.reverse(), ...nose, ...right]);
    f.body.closePath();
    // The tail fin trails the body's wave a little, and its tips trail further still.
    const a = rp[n - 2], b = rp[n - 1];
    let ux = b.x - a.x, uy = b.y - a.y;
    const ul = Math.hypot(ux, uy) || 1;
    ux /= ul;
    uy /= ul;
    const sw = Math.sin(f.phase - 5.2) * 0.35 * effort, cs = Math.cos(sw), sn = Math.sin(sw);
    const dx = ux * cs - uy * sn, dy = ux * sn + uy * cs;
    const T = f.tail, hw = halfWidth(f, 1);
    const curl = Math.sin(f.phase - 6) * T * 0.22 * effort;
    const P = (/** @type {number} */ u, /** @type {number} */ v) => {
      const w = v + curl * (u / T) ** 2;
      return [b.x + dx * u - dy * w, b.y + dy * u + dx * w];
    };
    const tail = new Path2D();
    const start = P(-T * 0.08, hw);
    tail.moveTo(start[0], start[1]);
    for (const [c1, p1] of [[P(T * 0.45, T * 0.3), P(T, T * 0.5)], [P(T * 0.85, T * 0.12), P(T * 0.62, 0)], [P(T * 0.85, -T * 0.12), P(T, -T * 0.5)], [P(T * 0.45, -T * 0.3), P(-T * 0.08, -hw)]]) tail.quadraticCurveTo(c1[0], c1[1], p1[0], p1[1]);
    tail.closePath();
    f.tailPath = tail;
    f.rays = new Path2D();
    for (const [u, v] of [[0.95, 0.46], [0.8, 0.28], [0.66, 0.08], [0.66, -0.08], [0.8, -0.28], [0.95, -0.46]]) {
      const o = P(0, 0), e = P(T * u, T * v);
      f.rays.moveTo(o[0], o[1]);
      f.rays.lineTo(e[0], e[1]);
    }
  };

  /** A point on the fish in body terms: s runs nose (0) to tail root (1), t across from one edge (-1) to the other (1). @param {Fish} f @param {number} s @param {number} t */
  const at = (f, s, t) => {
    const n = f.n, rp = f.rp;
    const x = clamp(s, 0, 1) * (n - 1), i = Math.min(n - 2, Math.floor(x)), u = x - i;
    const a = rp[i], b = rp[i + 1];
    const tx = lerp(a.tx, b.tx, u), ty = lerp(a.ty, b.ty, u);
    let px = lerp(a.x, b.x, u), py = lerp(a.y, b.y, u);
    if (s < 0) { px += a.tx * -s * f.len; py += a.ty * -s * f.len; } else if (s > 1) { px -= b.tx * (s - 1) * f.len; py -= b.ty * (s - 1) * f.len; }
    const hw = halfWidth(f, s) * t;
    return { x: px - ty * hw, y: py + tx * hw, tx, ty };
  };

  /** @param {Fish} f @param {ReturnType<typeof patch>} p */
  const patchPath = (f, p) => {
    const pts = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU, j = 1 + p.jag[k];
      const q = at(f, p.s + Math.cos(a) * p.rs * j, p.t + Math.sin(a) * p.rt * j);
      pts.push([q.x, q.y]);
    }
    const path = new Path2D();
    smoothClosed(path, pts);
    return path;
  };

  /** A pectoral or pelvic fin: a wide fan with a few rays and a pale edge. @param {Fish} f */
  const drawFin = (f, /** @type {number} */ s, /** @type {number} */ side, /** @type {number} */ size, /** @type {number} */ spread, /** @type {number[]} */ colour, /** @type {number} */ alpha) => {
    const q = at(f, s, side * 0.7);
    const bx = -q.tx, by = -q.ty, ox = -q.ty * side, oy = q.tx * side;
    const ang = Math.atan2(by * Math.cos(spread) + oy * Math.sin(spread), bx * Math.cos(spread) + ox * Math.sin(spread));
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(ang);
    ctx.scale(1, side);
    const fan = new Path2D();
    fan.moveTo(0, size * 0.14);
    fan.bezierCurveTo(size * 0.3, size * 0.62, size * 0.92, size * 0.6, size, size * 0.06);
    fan.bezierCurveTo(size * 0.92, -size * 0.3, size * 0.42, -size * 0.28, 0, -size * 0.12);
    fan.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = css(colour);
    ctx.fill(fan);
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = css(lighter(colour, 0.45));
    ctx.lineWidth = Math.max(0.6, size * 0.035);
    ctx.stroke(fan);
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = css(darker(colour, 0.25));
    ctx.lineWidth = Math.max(0.4, size * 0.012);
    ctx.beginPath();
    for (const v of [0.4, 0.15, -0.08]) {
      ctx.moveTo(size * 0.04, 0);
      ctx.lineTo(size * 0.85, size * v);
    }
    ctx.stroke();
    ctx.restore();
  };

  /** @param {Fish} f */
  const drawFish = (f) => {
    const lk = f.look, base = C[lk.base], finColour = lk.dark ? lighter(C[lk.fin], 0.18) : C[lk.fin];
    const finAlpha = 0.58 * (1 - 0.35 * f.depth);
    const pace = clamp(f.speed / f.cruise, 0, 1);
    // Pectoral fins spread and paddle when slow, fold back when swimming fast.
    const paddle = lerp(1.05, 0.5, pace);
    for (const side of [1, -1]) {
      drawFin(f, 0.2, side, f.fin, paddle + 0.22 * Math.sin(f.phase * 0.5 + (side > 0 ? 0 : Math.PI)), finColour, finAlpha);
      drawFin(f, 0.55, side, f.fin * 0.42, 0.7 + 0.1 * Math.sin(f.phase * 0.5), finColour, finAlpha * 0.8);
    }
    ctx.globalAlpha = finAlpha * 1.07;
    ctx.fillStyle = css(finColour);
    ctx.fill(f.tailPath);
    ctx.globalAlpha = finAlpha * 0.6;
    ctx.strokeStyle = css(lk.dark ? lighter(base, 0.6) : darker(C.sand, 0.35));
    ctx.lineWidth = Math.max(0.5, f.len * 0.006);
    ctx.stroke(f.rays);
    ctx.globalAlpha = 1;

    ctx.fillStyle = css(base);
    ctx.fill(f.body);
    ctx.save();
    ctx.clip(f.body);
    for (const p of lk.patches) {
      const path = patchPath(f, p);
      ctx.fillStyle = css(C[p.colour]);
      ctx.fill(path);
      // A kohaku's red ends sharp behind (kiwa) but fades in front, where the white scales lie over it (sashi).
      if (p.soft) {
        const a = at(f, p.s - p.rs * 1.05, p.t), b = at(f, p.s - p.rs * 0.35, p.t);
        const fade = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        fade.addColorStop(0, css(base, 0.9));
        fade.addColorStop(1, css(base, 0));
        ctx.fillStyle = fade;
        ctx.fill(path);
      }
    }
    const scale = scales[lk.dark ? 1 : 0];
    if (scale) {
      scale.setTransform(new DOMMatrix().rotateSelf((Math.atan2(f.rp[0].ty, f.rp[0].tx) * 180) / Math.PI));
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = scale;
      ctx.fill(f.body);
      ctx.globalAlpha = 1;
    }
    // Roundness: the sides a little darker, a soft light along the back. Many faint strokes of shrinking width stack
    // into a smooth fade; a few strong ones would show as stripes.
    ctx.strokeStyle = css(darker(C.water, 0.7), 0.06);
    for (const w of [0.84, 0.66, 0.5, 0.34, 0.18]) {
      ctx.lineWidth = f.wid * w;
      ctx.stroke(f.body);
    }
    const back = new Path2D();
    const spine = [];
    for (let s = 0.04; s <= 0.82; s += 0.06) {
      const q = at(f, s, 0);
      spine.push([q.x, q.y]);
    }
    smoothOpen(back, spine);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255, 255, 255, ${lk.sheen / 5})`;
    for (const w of [0.5, 0.4, 0.3, 0.2, 0.1]) {
      ctx.lineWidth = f.wid * w;
      ctx.stroke(back);
    }
    ctx.restore();
    // The eyes at the sides of the head, a triangle with the nose.
    ctx.fillStyle = css(darker(C['koi-ink'], 0.1), 0.65);
    for (const side of [1, -1]) {
      const q = at(f, 0.09, side * 0.8);
      ctx.beginPath();
      ctx.arc(q.x, q.y, f.wid * 0.055, 0, TAU);
      ctx.fill();
    }
    // Deeper fish fade into the water's colour.
    ctx.fillStyle = css(lighter(C.water, 0.12), f.depth * 0.3);
    ctx.fill(f.body);
  };

  /** The fish's and the leaves' shadows on the bed: further from what casts them the nearer it is to the surface. */
  const drawShadows = (/** @type {number} */ t) => {
    const g = shade.g, k = shade.c.width / W;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, shade.c.width, shade.c.height);
    g.fillStyle = '#000';
    for (const f of fishes) {
      const off = (10 + 30 * (1 - f.depth)) * unit;
      g.setTransform(k, 0, 0, k, SHADOW.x * off * k, SHADOW.y * off * k);
      g.globalAlpha = 0.75 + 0.25 * f.depth;
      g.fill(f.body);
      g.fill(f.tailPath);
    }
    g.globalAlpha = 1;
    for (const l of leaves) {
      const sway = leafSway(l, t);
      g.setTransform(k, 0, 0, k, (l.x * W + 26 * unit + sway.dx) * k, (l.y * H + 40 * unit + sway.dy) * k);
      g.rotate(l.angle + sway.turn);
      g.scale(unit, unit);
      g.fill(l.shape.shape);
    }
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    // The shade is black: drawn through the pond's shadow colour, it takes that colour.
    ctx.drawImage(tintShade(), 0, 0, W, H);
    ctx.restore();
  };
  let tinted = layer(1, 1, 1);
  const tintShade = () => {
    if (tinted.c.width !== shade.c.width || tinted.c.height !== shade.c.height) tinted = layer(shade.c.width, shade.c.height, 1);
    const g = tinted.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, tinted.c.width, tinted.c.height);
    g.drawImage(shade.c, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = css(C.shade);
    g.fillRect(0, 0, tinted.c.width, tinted.c.height);
    return tinted.c;
  };

  /** How a floating leaf sways on the ripples: a little turn and drift, back and forth over 9 seconds. */
  const leafSway = (/** @type {typeof leaves[number]} */ l, /** @type {number} */ t) => {
    const k = (1 - Math.cos(((t + l.at) / 9) * Math.PI)) / 2;
    return { turn: ((lerp(-5, 5, k)) * Math.PI) / 180, dx: lerp(-3, 3, k) * unit, dy: lerp(0, 2, k) * unit };
  };

  const resize = () => {
    const oldW = W, oldH = H, oldUnit = unit;
    W = stage.width;
    H = stage.height;
    unit = Math.sqrt(W * H) / MOCK;
    density = ctx.canvas.width / W;
    shade = layer(W / 5, H / 5, 1);
    build();
    for (const f of fishes) {
      if (!f.pts.length) {
        fit(f);
        const x = lerp(0.25, 0.9, Math.random()) * W, y = lerp(0.15, 0.85, Math.random()) * H;
        for (let i = 0; i < f.n; i++) f.pts.push({ x: x - Math.cos(f.heading) * f.seg * i, y: y - Math.sin(f.heading) * f.seg * i });
        f.depthGoal = f.depth;
        f.speed = f.goal = f.cruise;
        continue;
      }
      const h = f.pts[0], hx = (h.x * W) / oldW, hy = (h.y * H) / oldH, k = unit / oldUnit;
      for (const p of f.pts) {
        p.x = hx + (p.x - h.x) * k;
        p.y = hy + (p.y - h.y) * k;
      }
      fit(f);
    }
  };

  readTokens();
  scales = [scaleTile(false), scaleTile(true)];
  resize();

  /** One frame: the fish swim `dt` seconds on, then everything is drawn. @param {number} dt */
  function draw(dt) {
    // The theme changed: new colours, so the pictures are drawn again.
    if (stage.colors !== colorsSeen) {
      colorsSeen = stage.colors;
      readTokens();
      scales = [scaleTile(false), scaleTile(true)];
      build();
    }
    const t = stage.time;
    for (const f of fishes) swim(f, dt);
    fishes.sort((a, b) => b.depth - a.depth);
    for (const f of fishes) buildBody(f);

    if (bed) ctx.drawImage(bed, 0, 0, W, H);
    // Sunlight through the ripples: two layers drifting different ways.
    const pad = 80 * unit;
    const ease = (/** @type {number} */ period) => (1 - Math.cos((t / period) * Math.PI)) / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    if (ripples[0]) {
      const k = ease(16);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(ripples[0], -pad + lerp(-34, 34, k) * unit, -pad + lerp(-14, 16, k) * unit, W + pad * 2, H + pad * 2);
    }
    if (ripples[1]) {
      const k = ease(12), grow = lerp(1.04, 1, k);
      ctx.globalAlpha = 0.38;
      ctx.translate(W / 2 + lerp(28, -26, k) * unit, H / 2 + lerp(20, -18, k) * unit);
      ctx.scale(grow, grow);
      ctx.drawImage(ripples[1], -W / 2 - pad, -H / 2 - pad, W + pad * 2, H + pad * 2);
    }
    ctx.restore();
    drawShadows(t);
    // The water itself: clear by the shallow bank, deeper and bluer away from it.
    const water = ctx.createLinearGradient(0, H * 0.4, W, H * 0.6);
    water.addColorStop(0, css(lighter(C.water, 0.3), 0.08));
    water.addColorStop(0.42, css(C.water, 0.28));
    water.addColorStop(1, css(darker(C.water, 0.32), 0.52));
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, W, H);
    for (const f of fishes) drawFish(f);
    if (over) ctx.drawImage(over, 0, 0, W, H);
    for (const l of leaves) {
      const sway = leafSway(l, t);
      ctx.save();
      ctx.translate(l.x * W + sway.dx, l.y * H + sway.dy);
      ctx.rotate(l.angle + sway.turn);
      ctx.scale(unit, unit);
      const colour = C[l.colour];
      const fill = ctx.createRadialGradient(-l.R * 0.05, 0, 0, 0, 0, l.R);
      fill.addColorStop(0, css(lighter(colour, 0.25)));
      fill.addColorStop(1, css(colour));
      ctx.fillStyle = fill;
      ctx.fill(l.shape.shape);
      ctx.strokeStyle = css(lighter(C['leaf-orange'], 0.45), 0.55);
      ctx.lineWidth = 0.9;
      ctx.stroke(l.shape.veins);
      ctx.strokeStyle = css(darker(C['leaf-red'], 0.4));
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.stroke(l.shape.stem);
      ctx.restore();
    }
    // The sun's glints on the ripples, each brightening and fading in turn.
    ctx.save();
    ctx.fillStyle = css(lighter(C.light, 0.5));
    ctx.shadowColor = css(C.light);
    ctx.shadowBlur = 3 * unit * density;
    for (const g of glints) {
      const k = Math.sin((((t + g.at) % 2.8) / 2.8) * Math.PI);
      if (k < 0.05) continue;
      const x = g.x * W, y = g.y * H, s = g.s * unit * lerp(0.3, 1, k);
      ctx.globalAlpha = k;
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.18, y - s * 0.18);
      ctx.lineTo(x + s, y);
      ctx.lineTo(x + s * 0.18, y + s * 0.18);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 0.18, y + s * 0.18);
      ctx.lineTo(x - s, y);
      ctx.lineTo(x - s * 0.18, y - s * 0.18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  return { resize, frame: draw };
}
