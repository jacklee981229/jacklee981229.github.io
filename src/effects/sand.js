// Sand: the pointer pours coloured sand, one grain to a square, and it settles into dunes the old way: a grain
// falls if it can, or slips down to one side. The colour changes as it pours, so the dunes come out striped. A
// click drops a whole heap. When the stage is filling up, the floor lets some out.

/** Pixels to a grain's side. */
const CELL = 4;
/** Grains poured a second, and how many squares from the pointer they can start. */
const POUR = 1100;
const SPOUT = 3;
/** A click's heap: how many grains, and how many squares wide. */
const HEAP = 700;
const HEAP_WIDE = 13;
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
  // The sand is worked out on a small picture, a pixel to a grain, and stretched to the stage with hard edges.
  const small = document.createElement('canvas');
  const sctx = /** @type {CanvasRenderingContext2D} */ (small.getContext('2d'));
  let cols = 0;
  let rows = 0;
  /** A square is 0 when empty, else 1 + colour * SHADES + shade. */
  let grid = new Uint8Array(0);
  /** @type {ImageData} */
  let image;
  let pixels = new Uint32Array(0);
  /** A square's value to its pixel, in the theme's colours; mixed again when the theme changes. */
  let palette = new Uint32Array(0);
  let mixedFor = null;
  let grains = 0;
  let tick = 0;
  let pourOwed = 0;
  let settleOwed = 0;
  let outOwed = 0;
  let floorOpen = false;

  const grain = (color) => 1 + color * SHADES + Math.floor(Math.random() * SHADES);
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
    small.width = cols;
    small.height = rows;
    image = sctx.createImageData(cols, rows);
    pixels = new Uint32Array(image.data.buffer);
    // Striped dunes to start with, so there's a landscape to pour on.
    const lanes = stage.colors.lanes.length;
    const a = Math.random() * 6;
    const b = Math.random() * 6;
    for (let x = 0; x < cols; x++) {
      const tall = Math.round(rows * (0.16 + 0.07 * Math.sin(x * 0.045 + a) + 0.04 * Math.sin(x * 0.13 + b)));
      for (let up = 0; up < tall; up++) put(x, rows - 1 - up, grain(Math.floor(up / 5) % lanes));
    }
  };
  const mix = () => {
    const { lanes, paper } = stage.colors;
    palette = new Uint32Array(1 + lanes.length * SHADES);
    lanes.forEach((lane, l) => {
      for (let s = 0; s < SHADES; s++) {
        const [r, g, b] = lane.map((part, c) => Math.round(paper[c] + (part - paper[c]) * (1 - s * 0.11)));
        // A pixel's four bytes as one number: alpha, blue, green, red, lowest byte first.
        palette[1 + l * SHADES + s] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
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
      const spread = () => Math.round((Math.random() - 0.5) * 2 * SPOUT);
      for (pourOwed += dt * POUR; pourOwed >= 1; pourOwed--) put(px + spread(), py + spread(), grain(color));
      if (pointer.pressed) {
        for (let i = 0; i < HEAP; i++) {
          const angle = Math.random() * Math.PI * 2;
          const far = Math.sqrt(Math.random()) * HEAP_WIDE;
          put(px + Math.round(Math.cos(angle) * far), py + Math.round(Math.sin(angle) * far), grain((color + 2) % lanes));
        }
      }
      for (settleOwed += dt * SETTLES; settleOwed >= 1; settleOwed--) settle();
      if (grains > TOO_FULL * grid.length) floorOpen = true;
      else if (grains < ENOUGH * grid.length) floorOpen = false;
      if (floorOpen) for (outOwed += dt * LET_OUT; outOwed >= 1; outOwed--) letOut();

      for (let i = 0; i < grid.length; i++) pixels[i] = palette[grid[i]];
      sctx.putImageData(image, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, top, cols * CELL, rows * CELL);
    },
  };
}
