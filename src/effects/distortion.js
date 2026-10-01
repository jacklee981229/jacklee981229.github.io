// Distortion: a net of straight lines that swells and twists around the pointer, like looking at it through a drop
// of water. The drop trails the pointer on a spring, so it wobbles when the pointer stops. A click sends a wave out.

/** Pixels between the net's lines, and between the points each line is bent at. */
const GAP = 30;
const STEP = 12;
/** The drop: how far it reaches, how much it swells what's under it, how much it twists (in turns of a circle). */
const REACH = 240;
const SWELL = 0.6;
const TWIST = 0.16;
/** A click's wave: its speed, the width of its band, how long it lasts and how far it shifts the lines. */
const WAVE_SPEED = 560;
const WAVE_WIDTH = 80;
const WAVE_LIFE = 1.8;
const WAVE_SHIFT = 16;
/** How many strengths of colour the lit-up part is drawn in. */
const SHADES = 4;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function distortion(stage) {
  const drop = { x: stage.width / 2, y: stage.height / 2, vx: 0, vy: 0 };
  /** @type {{ x: number, y: number, age: number }[]} */
  let waves = [];

  /** Where a point of the flat net ends up, and how strongly the drop has hold of it (0 to 1). */
  const bend = (x, y) => {
    let dx = x - drop.x;
    let dy = y - drop.y;
    const far = Math.hypot(dx, dy);
    let hold = 0;
    if (far < REACH) {
      hold = (1 - far / REACH) ** 2;
      const angle = TWIST * Math.PI * 2 * hold;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const grow = 1 + SWELL * hold;
      [dx, dy] = [(dx * cos - dy * sin) * grow, (dx * sin + dy * cos) * grow];
    }
    let outX = drop.x + dx;
    let outY = drop.y + dy;
    for (const w of waves) {
      const wx = x - w.x;
      const wy = y - w.y;
      const from = Math.hypot(wx, wy) || 1;
      const band = (from - w.age * WAVE_SPEED) / WAVE_WIDTH;
      const shift = Math.sin(band * Math.PI) * Math.exp(-band * band) * (1 - w.age / WAVE_LIFE) * WAVE_SHIFT;
      outX += (wx / from) * shift;
      outY += (wy / from) * shift;
    }
    return [outX, outY, hold];
  };

  return {
    frame(dt) {
      const { ctx, pointer, colors, rgba, width, height } = stage;
      drop.vx += ((pointer.x - drop.x) * 70 - drop.vx * 8) * dt;
      drop.vy += ((pointer.y - drop.y) * 70 - drop.vy * 8) * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      if (pointer.pressed) waves.push({ x: pointer.x, y: pointer.y, age: 0 });
      waves = waves.filter((w) => (w.age += dt) < WAVE_LIFE);

      ctx.clearRect(0, 0, width, height);
      ctx.lineJoin = 'round';
      // Every line is drawn once, faintly; the pieces the drop has hold of are gathered by colour and strength, and
      // drawn again on top in a handful of strokes.
      const base = new Path2D();
      const lit = colors.lanes.map(() => Array.from({ length: SHADES }, () => new Path2D()));
      /** @param {boolean} across @param {number} fixed @param {number} length */
      const line = (across, fixed, length) => {
        let before = null;
        for (let along = -STEP; along <= length + STEP; along += STEP) {
          const [x, y, hold] = across ? bend(along, fixed) : bend(fixed, along);
          if (before) {
            base.moveTo(before[0], before[1]);
            base.lineTo(x, y);
            const grip = Math.max(hold, before[2]);
            if (grip > 0.04) {
              // The colour goes round the drop, like the dots of the Dot Grid.
              const turn = (Math.atan2(y - drop.y, x - drop.x) + Math.PI) / (2 * Math.PI);
              const path = lit[Math.floor(turn * lit.length) % lit.length][Math.min(SHADES - 1, Math.floor(grip * SHADES))];
              path.moveTo(before[0], before[1]);
              path.lineTo(x, y);
            }
          }
          before = [x, y, hold];
        }
      };
      const left = ((width % GAP) + GAP) / 2;
      const top = ((height % GAP) + GAP) / 2;
      for (let y = top - GAP; y <= height + GAP; y += GAP) line(true, y, width);
      for (let x = left - GAP; x <= width + GAP; x += GAP) line(false, x, height);

      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(colors.muted, 0.38);
      ctx.stroke(base);
      lit.forEach((shades, c) => shades.forEach((path, s) => {
        ctx.lineWidth = 1.2 + s * 0.5;
        ctx.strokeStyle = rgba(colors.lanes[c], (s + 1) / SHADES);
        ctx.stroke(path);
      }));
    },
  };
}
