// Sand: the pointer pours coloured sand, one grain to a square, and it settles into dunes the old way: a grain
// falls if it can, or slips down to one side. The colour changes as it pours, and each colour pours a little more
// or less, so the dunes come out in stripes of different widths. Grains come in a few sizes. A click bursts out a
// heap, small or big, never the same shape twice: lumpy, stretched one way, with clumps and loose grains thrown
// beyond it. When the stage is filling up, the floor lets some out.

/** Pixels to a square's side, and the sizes a grain in it comes in (a bigger one spills a little over its square). */
const CELL = 4;
const SIZES = [3, 4, 5];
/** Grains poured a second, how much more or less one colour pours, and how many squares from the pointer they start. */
const POUR = 1100;
const POUR_VARIES = 0.2;
const SPOUT = 3;
/** A click's heap: its reach in squares, smallest and biggest, grains to a square within it, and seconds to burst out. */
const HEAP_LEAST = 4;
const HEAP_MOST = 22;
const HEAP_THICK = 1.3;
const BURST_FOR = 0.16;
/** How lumpy a heap's edge gets, and how far it can be stretched one way (shares of its reach). */
const LUMPS = 0.16;
const STRETCH = 0.4;
/** Seconds of pouring in one colour. */
const COLOUR_FOR = 1.3;
/** How many times a second the sand settles: a grain falls that many squares a second at most. */
const SETTLES = 170;
/** The share of the stage that's sand when the floor opens and when it shuts again, and rows let out a second. */
const TOO_FULL = 0.4;
const ENOUGH = 0.28;
const LET_OUT = 6;
/** Each grain is one of this many strengths of its colour, which gives the dunes their grain. */
const SHADES = 4;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function sand(stage) {
  // The sand is worked out a square to a grain, drawn on a picture a pixel to the stage's pixel, and laid on the stage
  // with hard edges.
  const small = document.createElement('canvas');
  const sctx = /** @type {CanvasRenderingContext2D} */ (small.getContext('2d'));
  let cols = 0;
  let rows = 0;
  /** A square is 0 when empty, else 1 + (colour * SHADES + shade) * SIZES.length + size. */
  let grid = new Uint8Array(0);
  /** @type {ImageData} */
  let image;
  let pixels = new Uint32Array(0);
  /** A square's value to its grain's pixel, in the theme's colours (mixed again when the theme changes), and to its size. */
  let palette = new Uint32Array(0);
  let sideOf = new Uint8Array(0);
  let mixedFor = null;
  let grains = 0;
  let tick = 0;
  let pourOwed = 0;
  let settleOwed = 0;
  let outOwed = 0;
  let floorOpen = false;
  /** Which colour is pouring, and how much of POUR it pours. */
  let pouring = -1;
  let pourShare = 1;
  /**
   * Heaps still bursting out. `grown` is how far out it has got (a share of its edge); `lumps` are the edge's waves
   * ([size, how many round, where they start]); `clumps` are thrown beyond it ([angle, distance, reach]).
   * @type {{ x: number, y: number, wide: number, color: number, grown: number, lumps: number[][], axis: number, stretch: number, clumps: number[][] }[]}
   */
  let bursts = [];

  const pick = (n) => Math.floor(Math.random() * n);
  const grain = (color) => 1 + (color * SHADES + pick(SHADES)) * SIZES.length + pick(SIZES.length);
  const put = (x, y, value) => {
    if (x < 0 || x >= cols || y < 0 || y >= rows || grid[y * cols + x]) return;
    grid[y * cols + x] = value;
    grains++;
  };

  const layout = () => {
    cols = Math.max(1, Math.ceil(stage.width / CELL));
    rows = Math.max(1, Math.ceil(stage.height / CELL));
    grid = new Uint8Array(cols * rows);
    grains = 0;
    small.width = cols * CELL;
    small.height = rows * CELL;
    image = sctx.createImageData(small.width, small.height);
    pixels = new Uint32Array(image.data.buffer);
    // Striped dunes to start with, so there's a landscape to pour on, the stripes as uneven as the pouring makes them.
    const lanes = stage.colors.lanes.length;
    const a = Math.random() * 6;
    const b = Math.random() * 6;
    const stripes = [];
    for (let up = 0; up < rows; ) stripes.push((up += 4 + pick(3)));
    for (let x = 0; x < cols; x++) {
      const tall = Math.round(rows * (0.16 + 0.07 * Math.sin(x * 0.045 + a) + 0.04 * Math.sin(x * 0.13 + b)));
      for (let up = 0, stripe = 0; up < tall; up++) {
        if (up >= stripes[stripe]) stripe++;
        put(x, rows - 1 - up, grain(stripe % lanes));
      }
    }
  };
  const mix = () => {
    const { lanes, paper } = stage.colors;
    palette = new Uint32Array(1 + lanes.length * SHADES * SIZES.length);
    sideOf = new Uint8Array(palette.length);
    lanes.forEach((lane, l) => {
      for (let s = 0; s < SHADES; s++) {
        const [r, g, b] = lane.map((part, c) => Math.round(paper[c] + (part - paper[c]) * (1 - s * 0.11)));
        SIZES.forEach((side, z) => {
          const value = 1 + (l * SHADES + s) * SIZES.length + z;
          // A pixel's four bytes as one number: alpha, blue, green, red, lowest byte first.
          palette[value] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
          sideOf[value] = side;
        });
      }
    });
    mixedFor = stage.colors;
  };
  /** Every grain moves one square if it can: straight down, or down to a side. From the floor up, so none moves twice. */
  const settle = () => {
    tick++;
    for (let y = rows - 2; y >= 0; y--) {
      // Rows are swept from alternate ends, and the side tried first alternates, so the sand leans neither way.
      const flip = (y + tick) & 1;
      for (let i = 0; i < cols; i++) {
        const x = flip ? cols - 1 - i : i;
        const at = y * cols + x;
        const value = grid[at];
        if (!value) continue;
        const below = at + cols;
        if (!grid[below]) {
          grid[below] = value;
          grid[at] = 0;
          continue;
        }
        const side = (x + tick) & 1 ? 1 : -1;
        if (x + side >= 0 && x + side < cols && !grid[below + side]) {
          grid[below + side] = value;
          grid[at] = 0;
        } else if (x - side >= 0 && x - side < cols && !grid[below - side]) {
          grid[below - side] = value;
          grid[at] = 0;
        }
      }
    }
  };
  const letOut = () => {
    for (let at = (rows - 1) * cols; at < grid.length; at++) {
      if (!grid[at]) continue;
      grid[at] = 0;
      grains--;
    }
  };
  layout();

  return {
    resize: layout,
    frame(dt) {
      const { ctx, pointer, time, width, height } = stage;
      if (mixedFor !== stage.colors) mix();
      const lanes = stage.colors.lanes.length;
      // The grid's last row sits on the stage's bottom edge; any part-row is cut off at the top.
      const top = height - rows * CELL;
      const px = Math.floor(pointer.x / CELL);
      const py = Math.floor((pointer.y - top) / CELL);
      const color = Math.floor(time / COLOUR_FOR) % lanes;
      if (color !== pouring) {
        pouring = color;
        pourShare = 1 + (Math.random() * 2 - 1) * POUR_VARIES;
      }
      const spread = () => Math.round((Math.random() - 0.5) * 2 * SPOUT);
      for (pourOwed += dt * POUR * pourShare; pourOwed >= 1; pourOwed--) put(px + spread(), py + spread(), grain(color));
      if (pointer.pressed) {
        const wide = HEAP_LEAST + Math.random() * (HEAP_MOST - HEAP_LEAST);
        bursts.push({
          x: px,
          y: py,
          wide,
          color: (color + 2) % lanes,
          grown: 0,
          lumps: [2, 3, 4, 5].map((round) => [Math.random() * LUMPS, round, Math.random() * Math.PI * 2]),
          axis: Math.random() * Math.PI,
          stretch: Math.random() * STRETCH,
          clumps: Array.from({ length: pick(6) }, () => [Math.random() * Math.PI * 2, wide * (1 + Math.random() * 0.6), wide * (0.1 + Math.random() * 0.2)]),
        });
      }
      // A heap grows out from where it was dropped, a ring at a time, so its first grains are falling before its last
      // land; its clumps and loose grains come with the last ring.
      for (const b of bursts) {
        const from = b.grown;
        b.grown = Math.min(1, from + dt / BURST_FOR);
        const edge = (angle) => b.wide * (1 + b.stretch * Math.cos(2 * (angle - b.axis))) * b.lumps.reduce((n, [size, round, start]) => n + size * Math.sin(round * angle + start), 1);
        const scatter = (x, y, angle, far) => put(x + Math.round(Math.cos(angle) * far), y + Math.round(Math.sin(angle) * far), grain(b.color));
        for (let i = Math.round(Math.PI * b.wide * b.wide * HEAP_THICK * (b.grown ** 2 - from ** 2)); i > 0; i--) {
          const angle = Math.random() * Math.PI * 2;
          scatter(b.x, b.y, angle, edge(angle) * Math.sqrt(from ** 2 + Math.random() * (b.grown ** 2 - from ** 2)));
        }
        if (b.grown < 1) continue;
        for (const [angle, far, reach] of b.clumps) {
          const cx = b.x + Math.round(Math.cos(angle) * far);
          const cy = b.y + Math.round(Math.sin(angle) * far);
          for (let i = Math.round(Math.PI * reach * reach * HEAP_THICK); i > 0; i--) scatter(cx, cy, Math.random() * Math.PI * 2, Math.sqrt(Math.random()) * reach);
        }
        for (let i = Math.round(b.wide * 4); i > 0; i--) {
          const angle = Math.random() * Math.PI * 2;
          scatter(b.x, b.y, angle, edge(angle) * (1 + Math.random() * 0.7));
        }
      }
      bursts = bursts.filter((b) => b.grown < 1);
      for (settleOwed += dt * SETTLES; settleOwed >= 1; settleOwed--) settle();
      if (grains > TOO_FULL * grid.length) floorOpen = true;
      else if (grains < ENOUGH * grid.length) floorOpen = false;
      if (floorOpen) for (outOwed += dt * LET_OUT; outOwed >= 1; outOwed--) letOut();

      // Each grain is a square of its size, standing on the bottom of its own square and centred across it.
      pixels.fill(0);
      const across = cols * CELL;
      const down = rows * CELL;
      for (let i = 0; i < grid.length; i++) {
        const value = grid[i];
        if (!value) continue;
        const side = sideOf[value];
        const colour = palette[value];
        const left = (i % cols) * CELL + ((CELL - side) >> 1);
        const bottom = (Math.floor(i / cols) + 1) * CELL;
        const fromX = Math.max(0, left);
        const toX = Math.min(across, left + side);
        for (let y = Math.max(0, bottom - side); y < bottom; y++) pixels.fill(colour, y * across + fromX, y * across + toX);
      }
      sctx.putImageData(image, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, top, across, down);
    },
  };
}
