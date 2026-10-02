// Moiré: two copies of one simple pattern, drawn over each other. One stays near the middle; the other goes with
// the pointer. Where their lines cross and part, broad bands appear that are in neither pattern, and sweep about
// as the pointer moves. A click changes the pattern: rings, rays, then bars.

/** Pixels between a pattern's lines, and how thick they are. */
const GAP = 16;
const THICK = 6;
/** How many rays the rays pattern has. */
const RAYS = 96;
/** How far the second set of bars turns as the pointer crosses the stage, in turns of a circle. */
const BARS_TURN = 0.06;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function moire(stage) {
  /** @type {Path2D[]} Rings, rays and bars, each drawn around 0,0 and big enough to cover the stage from anywhere on it. */
  let patterns = [];
  let which = 0;

  const draw = () => {
    const reach = Math.hypot(stage.width, stage.height);
    const rings = new Path2D();
    for (let r = GAP / 2; r < reach; r += GAP) {
      rings.moveTo(r, 0);
      rings.arc(0, 0, r, 0, Math.PI * 2);
    }
    const rays = new Path2D();
    for (let i = 0; i < RAYS; i++) {
      const angle = (i * Math.PI * 2) / RAYS;
      rays.moveTo(Math.cos(angle) * 22, Math.sin(angle) * 22);
      rays.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
    }
    const bars = new Path2D();
    for (let x = -reach; x <= reach; x += GAP) {
      bars.moveTo(x, -reach);
      bars.lineTo(x, reach);
    }
    patterns = [rings, rays, bars];
  };
  draw();

  return {
    resize: draw,
    frame() {
      const { ctx, pointer, colors, rgba, time, width, height } = stage;
      if (pointer.pressed) which = (which + 1) % patterns.length;
      const pattern = patterns[which];
      const bars = which === 2;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = which === 1 ? THICK * 0.55 : THICK;

      ctx.save();
      // The middle one isn't quite still: it wanders in a small loop, so the bands keep moving under a resting pointer.
      ctx.translate(width / 2 + Math.cos(time * 0.37) * 28, height / 2 + Math.sin(time * 0.45) * 22);
      ctx.strokeStyle = rgba(colors.lanes[0], 0.9);
      ctx.stroke(pattern);
      ctx.restore();

      ctx.save();
      ctx.translate(pointer.x, pointer.y);
      // Bars only show bands when one set is tilted against the other.
      if (bars) ctx.rotate((pointer.x / width - 0.5) * BARS_TURN * Math.PI * 2 + 0.05);
      ctx.strokeStyle = rgba(colors.lanes[colors.lanes.length - 1], 0.9);
      ctx.stroke(pattern);
      ctx.restore();
    },
  };
}
