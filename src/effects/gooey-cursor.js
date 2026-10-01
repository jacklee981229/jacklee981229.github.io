// Gooey Cursor: soft blobs that follow the pointer at different speeds, stretching apart on a quick move and
// melting back together when they meet. They're drawn the way metaballs are: every blob adds to an unseen field,
// and wherever the field is strong enough there's goo. Worked out on a small picture and stretched to the stage,
// which is what gives the edges their softness and keeps it quick on a big screen.

/** The small picture has about this many pixels, however big the stage. */
const FIELD_PIXELS = 72000;
/** The field's strength where goo begins and where it's solid; the gap between is the soft edge. */
const EDGE_FROM = 0.86;
const EDGE_TO = 1.12;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function gooeyCursor(stage) {
  const small = document.createElement('canvas');
  const sctx = /** @type {CanvasRenderingContext2D} */ (small.getContext('2d'));
  /** @type {ImageData} */
  let image;
  let shrink = 4;

  // A chain that follows the pointer, each blob smaller and lazier than the one before, and three that circle it.
  const start = { x: stage.width / 2, y: stage.height / 2 };
  const blobs = [
    { r: 62, stiff: 150, damp: 16 },
    { r: 50, stiff: 80, damp: 12 },
    { r: 42, stiff: 46, damp: 9.5 },
    { r: 34, stiff: 28, damp: 8 },
    { r: 27, stiff: 17, damp: 6.5 },
    { r: 20, stiff: 10, damp: 5.5 },
    { r: 24, stiff: 60, damp: 9, orbit: 120, turn: 1.15, phase: 0 },
    { r: 19, stiff: 50, damp: 8, orbit: 170, turn: -0.8, phase: 2.1 },
    { r: 15, stiff: 40, damp: 7, orbit: 215, turn: 0.55, phase: 4.2 },
  ].map((b, i) => ({ orbit: 0, turn: 0, phase: 0, ...b, x: start.x, y: start.y, vx: 0, vy: 0, color: i }));

  const resize = () => {
    shrink = Math.max(3, Math.ceil(Math.sqrt((stage.width * stage.height) / FIELD_PIXELS)));
    small.width = Math.ceil(stage.width / shrink);
    small.height = Math.ceil(stage.height / shrink);
    image = sctx.createImageData(small.width, small.height);
  };
  resize();

  return {
    resize,
    frame(dt) {
      const { ctx, pointer, colors, time } = stage;
      // Smaller on a small stage, so a phone isn't one big puddle.
      const size = Math.min(1, Math.min(stage.width, stage.height) / 760);
      for (const b of blobs) {
        const tx = pointer.x + Math.cos(time * b.turn + b.phase) * b.orbit * size;
        const ty = pointer.y + Math.sin(time * b.turn + b.phase) * b.orbit * size;
        b.vx += ((tx - b.x) * b.stiff - b.vx * b.damp) * dt;
        b.vy += ((ty - b.y) * b.stiff - b.vy * b.damp) * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }

      const { data, width, height } = image;
      data.fill(0);
      // In the small picture's own pixels: each blob's centre, its radius squared and its colour.
      const field = blobs.map((b) => ({ x: b.x / shrink, y: b.y / shrink, rr: ((b.r * size) / shrink) ** 2, color: colors.lanes[b.color % colors.lanes.length] }));
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let sum = 0;
          let red = 0;
          let green = 0;
          let blue = 0;
          for (const b of field) {
            const dx = x - b.x;
            const dy = y - b.y;
            const strength = b.rr / (dx * dx + dy * dy + 0.5);
            sum += strength;
            red += strength * b.color[0];
            green += strength * b.color[1];
            blue += strength * b.color[2];
          }
          if (sum < EDGE_FROM) continue;
          // Where blobs overlap, their colours mix by how much each one adds there.
          const edge = Math.min(1, (sum - EDGE_FROM) / (EDGE_TO - EDGE_FROM));
          const at = (y * width + x) * 4;
          data[at] = red / sum;
          data[at + 1] = green / sum;
          data[at + 2] = blue / sum;
          data[at + 3] = 255 * edge * edge * (3 - 2 * edge);
        }
      }
      sctx.putImageData(image, 0, 0);
      ctx.clearRect(0, 0, stage.width, stage.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(small, 0, 0, small.width * shrink, small.height * shrink);
    },
  };
}
