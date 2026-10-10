// The mangroves of Jack's Firefly River (src/worlds/fireflies.js): three rows of trees across the river, grown for the
// stage's shape from a fixed seed, so every visit sees the same bank. Each tree grows by space colonization (Runions
// et al. 2007): points scattered through the shape its crown should fill pull the branches towards them, a step at a
// time, and each point is used up once a branch reaches it. That gives the broad, irregular crown of a berembang tree
// without drawing one by hand. Its leaves gather at the ends of the outer branches, which droop as they reach out, and
// its breathing roots poke out of the mud along the waterline. Sizes are in CSS pixels of the stage.

/** The bank's own seed: the same trees on every visit. */
export const SEED = 20261010;

/**
 * The three rows, far to near. `crown` is a crown's height as a share of the scene's size (see `unitOf`), `wide` how
 * many times wider than tall it grows, `gap` the room between trunks as a share of a crown's width (below 1, crowns
 * overlap), `tall` how much their heights vary, `clearing` how often a wider gap follows a tree (so the far bank's
 * skyline has notches, not one smooth line), `trunk` how far the crown sits above the water, `points` how many points
 * its branches grow towards (more makes finer branches), `rise` how much higher the row's foot stands (further off,
 * a touch higher up the picture), `fireflies` the row's share of the fireflies: half far and small, a third in the
 * middle, the rest near and larger.
 */
export const ROWS = [
  { crown: 0.14, wide: [1.5, 2.2], gap: [0.45, 0.85], tall: [0.6, 1.45], clearing: 0.22, trunk: 0.02, points: 300, rise: 0.012, fireflies: 0.5 },
  { crown: 0.23, wide: [1.5, 2.1], gap: [0.55, 0.9], tall: [0.8, 1.25], clearing: 0.12, trunk: 0.035, points: 520, rise: 0.006, fireflies: 1 / 3 },
  { crown: 0.34, wide: [1.5, 2.05], gap: [0.7, 1.1], tall: [0.85, 1.2], clearing: 0, trunk: 0.05, points: 820, rise: 0, fireflies: 1 / 6 },
];

/** Numbers that look random but are the same for the same seed. @param {number} seed */
export function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * The size the scene is drawn at: the stage's height, but no more than its width allows, so a tall phone card gets
 * trees that still fit two or three across.
 * @param {number} width @param {number} height
 */
export const unitOf = (width, height) => Math.min(height, width * 0.95);

/** Where the water meets the far bank, in CSS pixels from the top: a little over halfway down, leaving the river
 *  room for the trees' reflections. @param {number} width @param {number} height */
export const waterlineOf = (width, height) => Math.round(height * (height > width ? 0.58 : 0.6));

/**
 * @typedef {{ segments: number[][], clumps: number[][], leaves: number[][], roots: number[][], mud: number[], x: number, top: number }} Tree
 * `segments` are [x0, y0, x1, y1, width] from a branch's base to its tip, trunk first; `clumps` are the leafy clumps as
 * [x, y, radius], solid in their middle (the fireflies sit on these); `leaves` are the single leaves round their edges,
 * [x, y, length, angle]; `roots` are the breathing roots as [x, y, height, width, lean]; `mud` is the mound at the
 * foot, [x, y, half width, height].
 */

/**
 * One tree, its trunk rising from (x, waterline) and its crown `height` tall and `width` wide.
 * @param {() => number} rand @param {{ x: number, waterline: number, width: number, height: number, trunk: number, points: number }} o
 * @returns {Tree}
 */
export function growTree(rand, { x, waterline, width, height, trunk, points }) {
  const a = width / 2;
  // The crown leans a little to one side of its trunk, as these trees do on a soft bank.
  const cx = x + (rand() - 0.5) * a * 0.45;
  // The crown's middle, low over a short trunk: its edges droop down almost to the water.
  const cy = waterline - trunk - height * 0.42;
  // A lumpy dome: two or three swellings along the top, and an underside that hangs lower towards the edges, where
  // the long branches droop.
  const lumps = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
  const lumpy = (/** @type {number} */ u) => 1 + 0.14 * Math.sin(u * 3.7 + lumps[0]) + 0.09 * Math.sin(u * 7.3 + lumps[1]) + 0.05 * Math.sin(u * 13 + lumps[2]);
  const topOf = (/** @type {number} */ u) => cy - height * 0.58 * Math.pow(Math.max(0, 1 - u * u), 0.45) * lumpy(u);
  const underOf = (/** @type {number} */ u) => Math.min(waterline - trunk * 0.25, cy + height * (0.18 + 0.5 * u * u));
  /** @type {number[][]} */
  const attract = [];
  for (let tries = 0; attract.length < points && tries < points * 20; tries++) {
    const u = rand() * 2 - 1;
    const px = cx + u * a;
    const py = lerp(cy - height * 0.75, waterline, rand());
    if (py > topOf(u) && py < underOf(u)) attract.push([px, py]);
  }

  // Branches grow in steps of `step`; a point pulls the nearest branch end within `reach`, and is used up once one
  // comes within `kill`. A grid of cells `reach` wide keeps the search for the nearest to the cells around a point.
  const step = Math.max(1.5, width / 40);
  const reach = step * 5;
  const kill = step * 1.4;
  /** @type {number[]} */ const xs = [];
  /** @type {number[]} */ const ys = [];
  /** @type {number[]} */ const parent = [];
  /** @type {Map<number, number[]>} */
  const cells = new Map();
  const key = (/** @type {number} */ gx, /** @type {number} */ gy) => (gx + 4096) * 8192 + gy + 4096;
  const cellOf = (/** @type {number} */ px, /** @type {number} */ py) => key(Math.floor(px / reach), Math.floor(py / reach));
  const add = (/** @type {number} */ px, /** @type {number} */ py, /** @type {number} */ from) => {
    xs.push(px);
    ys.push(py);
    parent.push(from);
    const k = cellOf(px, py);
    const cell = cells.get(k);
    if (cell) cell.push(xs.length - 1);
    else cells.set(k, [xs.length - 1]);
    return xs.length - 1;
  };

  // The trunk: short and thick, leaning from the mud up into the crown's underside in one easy bow.
  let at = add(x, waterline + 2, -1);
  const rise = waterline + 2 - (cy + height * 0.12);
  const legs = Math.max(2, Math.round(rise / step));
  const bow = (rand() - 0.5) * width * 0.12;
  for (let i = 1; i <= legs; i++) {
    const t = i / legs;
    at = add(lerp(x, cx, t * t) + bow * Math.sin(Math.PI * t), waterline + 2 - rise * t, at);
  }

  const alive = attract.map(() => true);
  for (let round = 0; round < 160; round++) {
    /** @type {Map<number, number[]>} */
    const pulls = new Map();
    let left = 0;
    for (let i = 0; i < attract.length; i++) {
      if (!alive[i]) continue;
      const [px, py] = attract[i];
      const gx = Math.floor(px / reach);
      const gy = Math.floor(py / reach);
      let best = -1;
      let bestD = reach * reach;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (const n of cells.get(key(gx + ox, gy + oy)) ?? []) {
            const d = (xs[n] - px) ** 2 + (ys[n] - py) ** 2;
            if (d < bestD) {
              bestD = d;
              best = n;
            }
          }
        }
      }
      if (best < 0) {
        left++;
        continue;
      }
      if (bestD < kill * kill) {
        alive[i] = false;
        continue;
      }
      left++;
      const d = Math.sqrt(bestD);
      const pull = pulls.get(best) ?? [0, 0];
      pull[0] += (px - xs[best]) / d;
      pull[1] += (py - ys[best]) / d;
      pulls.set(best, pull);
    }
    if (!pulls.size || !left) break;
    for (const [n, [px, py]] of pulls) {
      // The further out a branch reaches, the more it droops under its own weight.
      const out = Math.min(1, Math.abs(xs[n] - cx) / a);
      const length = Math.hypot(px, py) || 1;
      let dx = px / length;
      let dy = py / length + 0.35 * out * out;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      const nx = xs[n] + dx * step;
      const ny = ys[n] + dy * step;
      // Two points pulling a branch end evenly from either side would make it grow on the spot forever.
      if ((cells.get(cellOf(nx, ny)) ?? []).some((/** @type {number} */ m) => (xs[m] - nx) ** 2 + (ys[m] - ny) ** 2 < step * step * 0.2)) continue;
      add(nx, ny, n);
    }
  }

  // How thick each branch is: as thick as all the twigs it carries (the pipe model), so the trunk is stout and the
  // tips are threads.
  const tips = new Float64Array(xs.length);
  const kids = new Int32Array(xs.length);
  for (let n = 1; n < xs.length; n++) kids[parent[n]]++;
  for (let n = xs.length - 1; n >= 0; n--) {
    if (!kids[n]) tips[n] = 1;
    if (parent[n] >= 0) tips[parent[n]] += tips[n];
  }
  const twig = Math.max(0.45, width / 480);
  const widthOf = (/** @type {number} */ n) => twig * Math.pow(tips[n], 0.5);
  /** @type {number[][]} */
  const segments = [];
  for (let n = 1; n < xs.length; n++) segments.push([xs[parent[n]], ys[parent[n]], xs[n], ys[n], widthOf(n)]);

  // Leaves, in clumps round the outer twigs: each a dense middle with single leaves round its edge, so the crown is a
  // solid mass with a fine, ragged outline and gaps for the sky. Strands hang from some tips, leafy all the way down,
  // and make the crown weep.
  /** @type {number[][]} */
  const clumps = [];
  /** @type {number[][]} */
  const leaves = [];
  const size = Math.max(1.1, width / 125);
  const clump = (/** @type {number} */ px, /** @type {number} */ py, /** @type {number} */ r) => {
    clumps.push([px, py, r]);
    for (let k = 0; k < 6; k++) {
      const angle = rand() * Math.PI * 2;
      const d = r * lerp(0.4, 1.05, rand());
      leaves.push([px + Math.cos(angle) * d, py + Math.sin(angle) * d, size * lerp(0.75, 1.3, rand()), angle + (rand() - 0.5) * 1.2]);
    }
  };
  const leaf = step * 0.62;
  for (let n = 0; n < xs.length; n++) {
    if (tips[n] > 14 || ys[n] > waterline - 2) continue;
    const outer = tips[n] <= 2;
    for (let k = outer ? 2 : 1; k > 0; k--) {
      clump(xs[n] + (rand() - 0.5) * step * 1.4, ys[n] + (rand() - 0.5) * step * 1.2, leaf * lerp(0.65, 1.3, rand()) * (outer ? 1 : 1.35));
    }
    if (kids[n] || rand() > 0.55) continue;
    const long = step * lerp(1, 3.4, rand()) * (0.4 + Math.min(1, Math.abs(xs[n] - cx) / a));
    const sway = (rand() - 0.5) * step * 0.7;
    for (let d = leaf; d < long; d += leaf) {
      const t = d / long;
      if (ys[n] + d > waterline - 3) break;
      segments.push([xs[n] + sway * Math.max(0, t - 0.15), ys[n] + d - leaf, xs[n] + sway * t, ys[n] + d, twig * 0.8]);
      clump(xs[n] + sway * t + (rand() - 0.5) * leaf * 0.6, ys[n] + d, leaf * lerp(0.4, 0.75, rand()) * (1 - t * 0.35));
    }
  }

  // The breathing roots: thin spikes poking up from the mud around the foot, thickest near the trunk.
  /** @type {number[][]} */
  const roots = [];
  const spread = a * 0.85;
  const many = Math.round(spread / Math.max(1.6, width / 150));
  for (let i = 0; i < many; i++) {
    const off = (rand() * 2 - 1) * spread;
    const near = 1 - Math.abs(off) / spread;
    roots.push([x + off, waterline + 1, Math.max(1.2, height * 0.05 * lerp(0.35, 1, rand()) * (0.5 + near)), Math.max(0.6, twig * lerp(1, 2.2, rand())), (rand() - 0.5) * 0.25]);
  }
  return { segments, clumps, leaves, roots, mud: [x, waterline, spread * 0.9, Math.max(1.5, height * 0.03)], x, top: cy - height * 0.75 };
}

/**
 * @typedef {{ x: number, waterline: number, width: number, height: number, trunk: number, points: number, seed: number }} Plant
 * Where a tree stands and how big it grows, with its own seed: growing it (growTree) is the slow part.
 */

/**
 * The bank's plan for a stage of this size: three rows of trees, far to near, each tree placed and sized from the
 * bank's seed, ready to grow.
 * @param {number} width @param {number} height @param {number} [seed]
 * @returns {{ width: number, height: number, waterline: number, rows: { plants: Plant[], fireflies: number }[] }}
 */
export function plant(width, height, seed = SEED) {
  const unit = unitOf(width, height);
  const waterline = waterlineOf(width, height);
  const rand = seeded(seed);
  const rows = ROWS.map((row) => {
    const own = seeded(Math.floor(rand() * 2 ** 31));
    /** @type {Plant[]} */
    const plants = [];
    const height = row.crown * unit;
    const base = waterline - Math.round(row.rise * unit);
    // From just past the left edge to just past the right, so no row ends in the picture.
    let x = -height * lerp(0.3, 0.9, own());
    while (x < width + height * 0.6) {
      const wide = height * lerp(row.wide[0], row.wide[1], own());
      const tall = height * lerp(row.tall[0], row.tall[1], own());
      plants.push({ x, waterline: base, width: wide, height: tall, trunk: row.trunk * unit * lerp(0.8, 1.25, own()), points: row.points, seed: Math.floor(own() * 2 ** 31) });
      x += wide * lerp(row.gap[0], row.gap[1], own()) * (own() < row.clearing ? 2 : 1);
    }
    return { plants, fireflies: row.fireflies };
  });
  return { width, height, waterline, rows };
}

/** Grows one planned tree. @param {Plant} p */
export const grow = (p) => growTree(seeded(p.seed), p);

/**
 * The whole bank for a stage of this size, grown at once.
 * @param {number} width @param {number} height @param {number} [seed]
 */
export function growBank(width, height, seed = SEED) {
  const plan = plant(width, height, seed);
  return { ...plan, rows: plan.rows.map((row) => ({ trees: row.plants.map(grow), fireflies: row.fireflies })) };
}

/**
 * Where the fireflies sit: `count` points on the leaves of a row's trees, each clump getting its share by its area,
 * and none off the stage. Returns [x, y, x, y, ...] in CSS pixels.
 * @param {Tree[]} trees @param {number} count @param {number} width @param {() => number} rand
 */
export function scatter(trees, count, width, rand) {
  const clumps = trees.flatMap((t) => t.clumps).filter(([x, , r]) => x + r > 0 && x - r < width);
  const out = new Float32Array(count * 2);
  if (!clumps.length) return out;
  const areas = [];
  let total = 0;
  for (const [, , r] of clumps) areas.push((total += r * r));
  for (let i = 0; i < count; i++) {
    let x = -1;
    let y = 0;
    for (let tries = 0; tries < 8 && (x < 0 || x >= width); tries++) {
      const pick = rand() * total;
      let lo = 0;
      let hi = areas.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (areas[mid] < pick) lo = mid + 1;
        else hi = mid;
      }
      const [cx, cy, r] = clumps[lo];
      // Evenly over the clump's disc: the square root keeps the middle from crowding.
      const d = r * Math.sqrt(rand());
      const angle = rand() * Math.PI * 2;
      x = cx + Math.cos(angle) * d;
      y = cy + Math.sin(angle) * d;
    }
    out[i * 2] = Math.min(width - 0.5, Math.max(0.5, x));
    out[i * 2 + 1] = y;
  }
  return out;
}
