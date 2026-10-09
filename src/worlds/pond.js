// Jack's Pond on the Effects' stage (src/effects/stage.js): a clear spring pond seen from above, whose koi swim by
// themselves. The look is the Sunlit Spring mockup's: clear shallow water over sand and a winding bar of gravel,
// sunlight rippling over the bed, mossy boulders along the left bank, maple leaves floating with their shadows below,
// and the sun's glints. What never moves (the bed, the boulders) is drawn once into pictures of its own; each frame
// lays them down with the ripples, the shadows, the fish, the leaves and the glints over them. The swimming is the old
// fishing pond's: a spine that bends as the head turns, a wave down it, calm wandering, changing depth, keeping off the
// edges and out of each other's way. Every colour is a --pond-* token (tokens.css) or a lighter or darker mix of one.
// By night (the dark theme, the night sky too) the same pond lies under the moon, in the Moonlit Pond mockup's colours:
// the sunlight on the bed gives way to the moon's reflection breaking on the ripples, glints near it, a few stars and
// fireflies. Switching the theme fades the pond from one to the other.

const TAU = Math.PI * 2;
/** The stage at which the mockup's sizes hold: 1280 by 800. Sizes grow with the stage's area, not its count of things. */
const MOCK = Math.sqrt(1280 * 800);
/** The pond's colours, each from its --pond-* token. */
const NAMES = ['sand', 'pebble-grey', 'pebble-tan', 'pebble-brown', 'water', 'shade', 'stone', 'moss', 'leaf-red', 'leaf-orange', 'koi-red', 'koi-white', 'koi-ink', 'koi-gold', 'koi-brown', 'light', 'firefly'];
/** Where the moon's reflection lies, as shares of the stage: the Moonlit Pond mockup's place for it. */
const MOON = { x: 0.6875, y: 0.29 };
/** Where the fireflies gather (shares of the stage) and how far they spread (pixels at the mockup's size). */
const FLY_SPOTS = [[0.1875, 0.2875, 160], [0.828, 0.75, 140], [0.547, 0.15, 260]];
/** A firefly's round, as the mockup's: how bright it glows through it, and where it drifts (pixels at the mockup's size),
 *  each at a share of the way. */
const FLY_GLOW = [[0, 0], [0.35, 1], [0.55, 0.9], [0.8, 0], [1, 0]];
const FLY_PATH = [[0, 0, 0], [0.55, 14, -10], [0.8, 22, -4], [1, 0, 0]];
/** Seconds the pond takes to fade from day to night or back. */
const FADE = 2;
/** How far the ripples and the moon's glints reach past the stage's edges, so their drift never shows an edge (pixels
 *  at the mockup's size). */
const PAD = 80;
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
/** Eases in and out, as CSS's ease-in-out does between two keyframes. @param {number} u */
const smooth = (u) => u * u * (3 - 2 * u);
/** The values at a share `u` of the way through keyframes [share, ...values], eased between each two. @param {number[][]} keys @param {number} u */
const keyframe = (keys, u) => {
  let i = 1;
  while (i < keys.length - 1 && u > keys[i][0]) i++;
  const a = keys[i - 1], b = keys[i], e = smooth(clamp((u - a[0]) / (b[0] - a[0]), 0, 1));
  return a.slice(1).map((v, j) => lerp(v, b[j + 1], e));
};

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
  /** The theme's colours as its tokens give them; `C` is what each frame draws with, which differs from them only while
   *  the pond fades from one theme to the other. @type {Record<string, number[]>} */
  let target = {};
  /** @type {Record<string, number[]>} */
  let C = {};
  let colorsSeen = stage.colors;
  /** Night is the dark theme, the night sky included. */
  const isNight = () => document.documentElement.dataset.theme === 'dark';
  let nightTo = isNight();
  /** How far into night the frame being drawn is: 0 by day, 1 by night, in between while fading. */
  let night = nightTo ? 1 : 0;
  const readTokens = () => {
    const style = getComputedStyle(ctx.canvas);
    target = Object.fromEntries(NAMES.map((n) => [n, rgbOf(style.getPropertyValue(`--pond-${n}`) || '#808080')]));
  };

  let W = 1, H = 1, unit = 1, density = 1;
  /** @type {HTMLCanvasElement | null} */ let bed = null;
  /** @type {HTMLCanvasElement | null} */ let over = null;
  /** @type {(HTMLCanvasElement | null)[]} */ let ripples = [null, null];
  /** The fish's and the leaves' shadows, drawn small and scaled up, which softens them for free. */
  let shade = layer(1, 1, 1);
  /** @type {{ mottle: HTMLCanvasElement | null, grain: HTMLCanvasElement | null, ripples: (HTMLCanvasElement | null)[], glints: HTMLCanvasElement | null } | null} */
  let noise = null;
  let noiseFor = 0;
  /** The glints near the moon: streaks of the browser's noise, faded out away from it. @type {HTMLCanvasElement | null} */
  let moonGlints = null;
  /** The moon's slivers, drawn small round the moon and scaled up: soft at their edges, as on the ripples. */
  let moonBox = { ...layer(1, 1, 1), x: 0, y: 0, w: 1, h: 1 };
  /** A firefly's glow, drawn once for its colour and laid down at each firefly's size. */
  let flyGlow = { c: document.createElement('canvas'), colour: '' };
  /** While fading between day and night: the pictures and colours being left, and when the fade began. */
  /** @type {{ bed: HTMLCanvasElement | null, over: HTMLCanvasElement | null, C: Record<string, number[]>, night: number, start: number } | null} */
  let fading = null;

  // The pond's layout, seeded: the same pond every time, laid out over whatever size the stage has.
  const lay = makeRand(2026);
  const pebbleSeeds = { bar: lay() * 1e9, deep: lay() * 1e9, fine: lay() * 1e9 };
  const boulderSpots = [[-40, 0.14, 150], [30, 0.54, 105], [-60, 0.9, 150], [150, 0.34, 40], [118, 0.73, 30]];
  const glints = Array.from({ length: 18 }, () => ({ x: lerp(0.766, 0.97, lay()), y: lerp(0.05, 0.3, lay()), s: 3 + lay() * 5, at: lay() * 2.8 }));
  const leaves = LEAVES.map(([x, y, angle, R, colour], i) => ({ x, y, angle: (Number(angle) * Math.PI) / 180, R: Number(R), colour: String(colour), shape: maple(Number(R)), at: -i * 2.3 }));

  // The night's things, as the Moonlit Pond mockup lays them out, from a seed of their own so the day pond stays as it was.
  const dark = makeRand(777);
  // The moon breaks into uneven slivers on the ripples: bright near its middle, scattered and faint further out. Each
  // is an offset from the moon, a width and height, how bright, and when it shimmers (all in pixels at the mockup's size).
  const slivers = [];
  for (let i = 0; i < 22; i++) {
    const dy = (dark() - 0.5) * 96, w = Math.sqrt(Math.max(0, 1 - (dy / 50) ** 2)) * 40;
    slivers.push({ dx: (dark() - 0.5) * 26, dy, rx: 4 + w * dark(), ry: 1.4 + dark() * 1.6, o: 0.35 + dark() * 0.55, at: dark() * 2.4 });
  }
  for (let i = 0; i < 20; i++) {
    const dy = (dark() - 0.5) * 240;
    slivers.push({ dx: (dark() - 0.5) * 190, dy, rx: 3 + dark() * 12, ry: 0.8 + dark(), o: 0.15 + dark() * 0.35, at: dark() * 2.4 });
  }
  // Only the brightest stars show beside a moon this bright, reflected here and there; some of them twinkle. The
  // mockup's 34 at its size: a bigger stage shows more of these, up to twice as many.
  const stars = Array.from({ length: 68 }, () => ({ x: dark(), y: dark(), r: 0.4 + dark() * 0.8, o: 0.15 + dark() * 0.4, twinkle: dark() < 0.3, at: dark() * 3.2 }));
  const flies = Array.from({ length: 16 }, (_, i) => {
    const [x, y, spread] = FLY_SPOTS[i % FLY_SPOTS.length];
    return { x, y, dx: (dark() - 0.5) * spread * 2, dy: (dark() - 0.5) * spread, r: 6 + dark() * 5, at: dark() * 5, period: 3.6 + dark() * 2.4 };
  });

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
    // Built in the theme's own colours, by day or by night.
    const C = target, moonlit = nightTo;
    const moon = { x: MOON.x * W, y: MOON.y * H };
    const { c: bedC, g } = layer(W, H, density);
    const sand = g.createLinearGradient(0, 0, W, H);
    // By night the bank's side isn't the bright one: the light is round the moon.
    sand.addColorStop(0, css(lighter(C.sand, moonlit ? 0.1 : 0.4)));
    sand.addColorStop(0.6, css(C.sand));
    sand.addColorStop(1, css(darker(C.sand, 0.12)));
    g.fillStyle = sand;
    g.fillRect(0, 0, W, H);
    if (moonlit) {
      const lit = g.createRadialGradient(moon.x, moon.y, 0, moon.x, moon.y, Math.max(W, H) * 0.85);
      lit.addColorStop(0, css(C.light, 0.16));
      lit.addColorStop(0.45, css(C.light, 0.05));
      lit.addColorStop(1, css(C.light, 0));
      g.fillStyle = lit;
      g.fillRect(0, 0, W, H);
    }

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

    // What lies over the fish: the boulders, wet and mossy, and the sun's glow from the top right; by night the moon's
    // halo on the water under the boulders, and the dark closing in at the edges over everything.
    const top = layer(W, H, density);
    const o = top.g;
    if (moonlit) {
      const halo = o.createRadialGradient(moon.x, moon.y, 0, moon.x, moon.y, 190 * unit);
      halo.addColorStop(0, css(lighter(C.light, 0.3), 0.3));
      halo.addColorStop(0.35, css(C.light, 0.1));
      halo.addColorStop(1, css(C.light, 0));
      o.fillStyle = halo;
      o.fillRect(0, 0, W, H);
    }
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
    if (moonlit) {
      const edge = o.createRadialGradient(W * 0.52, H * 0.45, 0, W * 0.52, H * 0.45, Math.hypot(W, H) * 0.55);
      edge.addColorStop(0.55, css(darker(C.water, 0.6), 0));
      edge.addColorStop(1, css(darker(C.water, 0.6), 0.6));
      o.fillStyle = edge;
      o.fillRect(0, 0, W, H);
    } else {
      const glow = o.createRadialGradient(W * 0.88, H * 0.12, 0, W * 0.88, H * 0.12, Math.max(W, H) * 0.45);
      glow.addColorStop(0, css(C.light, 0.22));
      glow.addColorStop(1, css(C.light, 0));
      o.fillStyle = glow;
      o.fillRect(0, 0, W, H);
    }
    over = top.c;

    // The bed's mottle and grain, in this theme's colours, once the noise is made; and the sunlight's two ripple layers
    // by day, or by night the glints near the moon. Those are kept until the next build for their time of day, so a
    // fade from one to the other still has them.
    if (!noise) return;
    g.save();
    if (noise.mottle) { g.globalAlpha = 0.55; g.drawImage(inColour(noise.mottle, darker(C.sand, 0.5)), 0, 0, W, H); }
    if (noise.grain) { g.globalAlpha = 0.4; g.drawImage(inColour(noise.grain, darker(C.sand, 0.62)), 0, 0, W, H); }
    g.restore();
    if (!moonlit) ripples = noise.ripples.map((r) => r && inColour(r, C.light));
    else if (noise.glints) {
      // The glints show only near the moon: an oval round it, fading out.
      const lit = inColour(noise.glints, C.light), gl = /** @type {CanvasRenderingContext2D} */ (lit.getContext('2d'));
      const k = lit.width / (W + PAD * 2 * unit);
      gl.globalCompositeOperation = 'destination-in';
      gl.translate((moon.x + PAD * unit) * k, (moon.y + PAD * unit) * k);
      gl.scale(1, lit.height / lit.width);
      const fade = gl.createRadialGradient(0, 0, 0, 0, 0, lit.width * 0.42);
      fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
      fade.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
      fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
      gl.fillStyle = fade;
      gl.fillRect(-lit.width * 2, -lit.width * 2, lit.width * 4, lit.width * 4);
      moonGlints = lit;
    }
  };

  /** A white picture of the noise in a colour: the colour wherever the noise shows. @param {HTMLCanvasElement} mask @param {number[]} colour */
  const inColour = (mask, colour) => {
    const c = document.createElement('canvas');
    c.width = mask.width;
    c.height = mask.height;
    const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
    g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = css(colour);
    g.fillRect(0, 0, c.width, c.height);
    return c;
  };

  /** The browser's noise for this size, in white: the bed's mottle and grain, the sunlight's two ripple layers and the
   *  glints near the moon. Making it takes a long moment on a big stage, so it's made once for each size and each
   *  build only tints it, quickly: a change of theme doesn't stall the fade. It comes a moment after the rest. */
  const makeNoise = () => {
    const stamp = ++noiseFor;
    noise = null;
    const wide = W + PAD * 2 * unit, high = H + PAD * 2 * unit, fine = Math.min(density, 1.5), white = [255, 255, 255];
    /** @param {HTMLImageElement | null} img @param {number} w @param {number} h @param {number} d */
    const raster = (img, w, h, d) => {
      if (!img) return null;
      const l = layer(w, h, d);
      l.g.drawImage(img, 0, 0, w, h);
      return l.c;
    };
    Promise.all([
      turbulence(W, H, density, { type: 'fractalNoise', freq: `${(0.006 / unit).toFixed(5)} ${(0.009 / unit).toFixed(5)}`, octaves: 3, seed: 21, matrix: tint(white, '0 0 0 -2.6 1.45') }),
      turbulence(W, H, density, { type: 'fractalNoise', freq: '0.85', octaves: 2, seed: 7, matrix: tint(white, '0 0 0 -1.6 1') }),
      turbulence(wide, high, fine, { type: 'turbulence', freq: `${(0.0105 / unit).toFixed(5)} ${(0.0145 / unit).toFixed(5)}`, octaves: 2, seed: 11, matrix: tint(white, '-9 0 0 0 1.3'), blur: 1.1 * unit }),
      turbulence(wide, high, fine, { type: 'turbulence', freq: `${(0.0135 / unit).toFixed(5)} ${(0.0115 / unit).toFixed(5)}`, octaves: 2, seed: 29, matrix: tint(white, '-10 0 0 0 1.25'), blur: 1.4 * unit }),
      turbulence(wide, high, fine, { type: 'fractalNoise', freq: `${(0.02 / unit).toFixed(5)} ${(0.11 / unit).toFixed(5)}`, octaves: 3, seed: 21, matrix: tint(white, '9 0 0 0 -5.9') }),
    ]).then(([mottle, grain, a, b, glints]) => {
      if (stamp !== noiseFor) return;
      noise = { mottle: raster(mottle, W, H, density), grain: raster(grain, W, H, density), ripples: [raster(a, wide, high, fine), raster(b, wide, high, fine)], glints: raster(glints, wide, high, fine) };
      build();
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
    t.g.strokeStyle = light ? 'rgba(255, 255, 255, 1)' : css(darker(target['koi-brown'] ?? [58, 42, 26], 0.55));
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
    // Roundness: the sides a little darker, a soft light along the back (the sun's, or the moon's). Many faint strokes
    // of shrinking width stack into a smooth fade; a few strong ones would show as stripes.
    ctx.strokeStyle = css(darker(C.water, 0.7), lerp(0.06, 0.1, night));
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
    ctx.strokeStyle = css(mix([255, 255, 255], C.light, night), lk.sheen / 5);
    for (const w of [0.5, 0.4, 0.3, 0.2, 0.1]) {
      ctx.lineWidth = f.wid * w;
      ctx.stroke(back);
    }
    ctx.restore();
    // The eyes at the sides of the head, a triangle with the nose; by night each catches a speck of moonlight.
    for (const side of [1, -1]) {
      const q = at(f, 0.09, side * 0.8), r = f.wid * 0.055;
      ctx.fillStyle = css(darker(C['koi-ink'], 0.1), 0.65);
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, TAU);
      ctx.fill();
      if (night < 0.01) continue;
      ctx.fillStyle = css(lighter(C.light, 0.3), 0.85 * night);
      ctx.beginPath();
      ctx.arc(q.x - r * 0.3, q.y - r * 0.3, r * 0.32, 0, TAU);
      ctx.fill();
    }
    // Deeper fish fade into the water's colour; by night the dark water hides them more.
    ctx.fillStyle = css(lighter(C.water, 0.12 * (1 - night)), lerp(f.depth * 0.3, 0.24 + f.depth * 0.55, night));
    ctx.fill(f.body);
  };

  /** The fish's and the leaves' shadows on the bed: further from what casts them the nearer it is to the surface. The
   *  moon's are fainter and fall closer than the sun's. */
  const drawShadows = (/** @type {number} */ t) => {
    const g = shade.g, k = shade.c.width / W;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, shade.c.width, shade.c.height);
    g.fillStyle = '#000';
    for (const f of fishes) {
      const off = lerp(10 + 30 * (1 - f.depth), 4 + 10 * (1 - f.depth), night) * unit;
      g.setTransform(k, 0, 0, k, SHADOW.x * off * k, SHADOW.y * off * k);
      g.globalAlpha = 0.75 + 0.25 * f.depth;
      g.fill(f.body);
      g.fill(f.tailPath);
    }
    g.globalAlpha = 1;
    for (const l of leaves) {
      const sway = leafSway(l, t);
      g.setTransform(k, 0, 0, k, (l.x * W + lerp(26, 5, night) * unit + sway.dx) * k, (l.y * H + lerp(40, 8, night) * unit + sway.dy) * k);
      g.rotate(l.angle + sway.turn);
      g.scale(unit, unit);
      g.fill(l.shape.shape);
    }
    ctx.save();
    ctx.globalAlpha = lerp(0.45, 0.3, night);
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

  /** By night: the moon's reflection breaking on the ripples, the glints near it and the stars, on the surface over the
   *  fish. @param {number} t */
  const drawMoon = (t) => {
    const mx = MOON.x * W, my = MOON.y * H;
    // Its bright middle, breathing a little.
    ctx.save();
    ctx.globalAlpha = night * lerp(0.82, 1, (1 - Math.cos((t / 3.6) * Math.PI)) / 2);
    ctx.translate(mx, my + 2 * unit);
    ctx.scale(1, 58 / 64);
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 64 * unit);
    core.addColorStop(0, css(lighter(C.light, 0.4), 0.55));
    core.addColorStop(0.55, css(C.light, 0.2));
    core.addColorStop(1, css(C.light, 0));
    ctx.fillStyle = core;
    ctx.fillRect(-64 * unit, -64 * unit, 128 * unit, 128 * unit);
    ctx.restore();
    // The slivers, each sliding a little to and fro, drawn small and scaled up so their edges come out soft.
    const b = moonBox, s = b.c.width / b.w;
    b.g.setTransform(1, 0, 0, 1, 0, 0);
    b.g.clearRect(0, 0, b.c.width, b.c.height);
    b.g.setTransform(s, 0, 0, s, (mx - b.x) * s, (my - b.y) * s);
    b.g.fillStyle = css(lighter(C.light, 0.4));
    for (const v of slivers) {
      const e = (1 - Math.cos(((t + v.at) / 2.4) * Math.PI)) / 2;
      b.g.globalAlpha = v.o * lerp(0.55, 1, e);
      b.g.beginPath();
      b.g.ellipse((v.dx + lerp(-5, 5, e)) * unit, v.dy * unit, v.rx * unit, v.ry * unit, 0, 0, TAU);
      b.g.fill();
    }
    ctx.globalAlpha = night;
    ctx.drawImage(b.c, b.x, b.y, b.w, b.h);
    // The glints near it, drifting slowly.
    if (moonGlints) {
      const e = (1 - Math.cos((t / 12) * Math.PI)) / 2, pad = PAD * unit;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.38 * night;
      ctx.drawImage(moonGlints, -pad + lerp(-24, 24, e) * unit, -pad + lerp(0, 8, e) * unit, W + pad * 2, H + pad * 2);
      ctx.restore();
    }
    ctx.fillStyle = css(lighter(C.light, 0.2));
    const many = Math.round((stars.length / 2) * Math.min(2, (W * H) / (MOCK * MOCK)));
    for (const star of stars.slice(0, many)) {
      ctx.globalAlpha = night * (star.twinkle ? lerp(0.2, 0.8, (1 - Math.cos(((t + star.at) / 3.2) * TAU)) / 2) : star.o);
      ctx.beginPath();
      ctx.arc(star.x * W, star.y * H, Math.max(0.5, star.r * unit), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  /** By night: the fireflies over the water, each with its reflection below it, glowing up, drifting off and fading,
   *  each in its own time. @param {number} t */
  const drawFlies = (t) => {
    const colour = css(C.firefly);
    if (flyGlow.colour !== colour) {
      const R = 32, sprite = layer(R * 2, R * 2, 1);
      const glow = sprite.g.createRadialGradient(R, R, 0, R, R, R);
      glow.addColorStop(0, css(lighter(C.firefly, 0.7)));
      glow.addColorStop(0.25, css(C.firefly, 0.6));
      glow.addColorStop(1, css(darker(C.firefly, 0.15), 0));
      sprite.g.fillStyle = glow;
      sprite.g.fillRect(0, 0, R * 2, R * 2);
      flyGlow = { c: sprite.c, colour };
    }
    ctx.fillStyle = css(lighter(C.firefly, 0.75));
    for (const f of flies) {
      const u = (((t + f.at) % f.period) + f.period) % f.period / f.period;
      const [o] = keyframe(FLY_GLOW, u);
      if (o < 0.01) continue;
      const [dx, dy] = keyframe(FLY_PATH, u);
      const x = f.x * W + (f.dx + dx) * unit, y = f.y * H + (f.dy + dy) * unit, r = f.r * unit;
      ctx.globalAlpha = o * night * 0.35;
      ctx.drawImage(flyGlow.c, x - r * 0.7, y + 9 * unit - r * 0.7, r * 1.4, r * 1.4);
      ctx.globalAlpha = o * night;
      ctx.drawImage(flyGlow.c, x - r, y - r, r * 2, r * 2);
      ctx.beginPath();
      ctx.arc(x, y, 1.3 * unit, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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
    // The slivers spread about 100 pixels either side of the moon and 120 above and below it, at the mockup's size.
    const bw = 260 * unit, bh = 300 * unit;
    moonBox = { ...layer(bw * 0.4, bh * 0.4, 1), x: MOON.x * W - bw / 2, y: MOON.y * H - bh / 2, w: bw, h: bh };
    makeNoise();
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
  C = target;
  scales = [scaleTile(false), scaleTile(true)];
  resize();

  /** One frame: the fish swim `dt` seconds on, then everything is drawn. @param {number} dt */
  function draw(dt) {
    // The theme changed: the pictures are drawn again in its colours, and a playing pond fades across to them; a still
    // one (paused, or with reduced motion) shows them at once. The night sky keeps the dark theme's pond: no change.
    if (stage.colors !== colorsSeen) {
      colorsSeen = stage.colors;
      const before = { bed, over, C, night };
      const was = JSON.stringify(target), wasNight = nightTo;
      readTokens();
      nightTo = isNight();
      if (JSON.stringify(target) !== was || nightTo !== wasNight) {
        scales = [scaleTile(false), scaleTile(true)];
        build();
        fading = stage.playing ? { ...before, start: stage.time } : null;
      }
    }
    // How far the fade has come, eased; the colours between the two themes', and how far into night.
    let blend = 1;
    if (fading) {
      blend = smooth(clamp((stage.time - fading.start) / FADE, 0, 1));
      if (stage.time - fading.start >= FADE) fading = null;
    }
    night = fading ? lerp(fading.night, nightTo ? 1 : 0, blend) : nightTo ? 1 : 0;
    const from = fading?.C;
    C = from ? Object.fromEntries(NAMES.map((n) => [n, mix(from[n], target[n], blend)])) : target;
    const sun = 1 - night;

    const t = stage.time;
    for (const f of fishes) swim(f, dt);
    fishes.sort((a, b) => b.depth - a.depth);
    for (const f of fishes) buildBody(f);

    if (fading?.bed) ctx.drawImage(fading.bed, 0, 0, W, H);
    if (bed) {
      ctx.globalAlpha = fading ? blend : 1;
      ctx.drawImage(bed, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // Sunlight through the ripples: two layers drifting different ways. By night they're gone.
    const pad = PAD * unit;
    const ease = (/** @type {number} */ period) => (1 - Math.cos((t / period) * Math.PI)) / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    if (ripples[0] && sun > 0.01) {
      const k = ease(16);
      ctx.globalAlpha = 0.5 * sun;
      ctx.drawImage(ripples[0], -pad + lerp(-34, 34, k) * unit, -pad + lerp(-14, 16, k) * unit, W + pad * 2, H + pad * 2);
    }
    if (ripples[1] && sun > 0.01) {
      const k = ease(12), grow = lerp(1.04, 1, k);
      ctx.globalAlpha = 0.38 * sun;
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
    if (night > 0.01) drawMoon(t);
    if (fading?.over) {
      ctx.globalAlpha = 1 - blend;
      ctx.drawImage(fading.over, 0, 0, W, H);
    }
    if (over) {
      ctx.globalAlpha = fading ? blend : 1;
      ctx.drawImage(over, 0, 0, W, H);
    }
    ctx.globalAlpha = 1;
    for (const l of leaves) {
      const sway = leafSway(l, t);
      ctx.save();
      ctx.translate(l.x * W + sway.dx, l.y * H + sway.dy);
      ctx.rotate(l.angle + sway.turn);
      ctx.scale(unit, unit);
      // Sunlit in the middle by day; by night dark all over, with the moon on its edge.
      const colour = C[l.colour];
      const fill = ctx.createRadialGradient(-l.R * 0.05, 0, 0, 0, 0, l.R);
      fill.addColorStop(0, css(lighter(colour, lerp(0.25, 0.05, night))));
      fill.addColorStop(1, css(colour));
      ctx.fillStyle = fill;
      ctx.fill(l.shape.shape);
      if (night > 0.01) {
        ctx.strokeStyle = css(C.light, 0.3 * night);
        ctx.lineWidth = 0.8;
        ctx.stroke(l.shape.shape);
      }
      ctx.strokeStyle = css(lighter(C['leaf-orange'], lerp(0.45, 0.15, night)), 0.55);
      ctx.lineWidth = 0.9;
      ctx.stroke(l.shape.veins);
      ctx.strokeStyle = css(darker(C['leaf-red'], 0.4));
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.stroke(l.shape.stem);
      ctx.restore();
    }
    // The sun's glints on the ripples, each brightening and fading in turn; by night, the fireflies instead.
    if (night > 0.01) drawFlies(t);
    if (sun < 0.01) return;
    ctx.save();
    ctx.fillStyle = css(lighter(C.light, 0.5));
    ctx.shadowColor = css(C.light);
    ctx.shadowBlur = 3 * unit * density;
    for (const g of glints) {
      const k = Math.sin((((t + g.at) % 2.8) / 2.8) * Math.PI);
      if (k < 0.05) continue;
      const x = g.x * W, y = g.y * H, s = g.s * unit * lerp(0.3, 1, k);
      ctx.globalAlpha = k * sun;
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
