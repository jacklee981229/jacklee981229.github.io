// Dot Grid: a field of dots, each held in place by a spring. The pointer pushes the near ones away and lights them
// up in the colour of the way they went; a click sends a ripple through the whole field.

/** Pixels between dots. */
const GAP = 30;
/** How far the pointer reaches, and how hard it pushes. */
const REACH = 160;
const PUSH = 2800;
/** The spring that pulls a dot home, and how fast its wobble dies. */
const SPRING = 62;
const DAMPING = 11;
/** A click's ripple: how fast it spreads, how wide its front is, how long it lasts, how hard it shoves. */
const RIPPLE_SPEED = 640;
const RIPPLE_WIDTH = 52;
const RIPPLE_LIFE = 1.7;
const RIPPLE_PUSH = 1150;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function dotGrid(stage) {
  /** @type {{ x: number, y: number, ox: number, oy: number, vx: number, vy: number }[]} */
  let dots = [];
  /** @type {{ x: number, y: number, age: number }[]} */
  let ripples = [];

  const layout = () => {
    const cols = Math.max(2, Math.floor(stage.width / GAP));
    const rows = Math.max(2, Math.floor(stage.height / GAP));
    const left = (stage.width - (cols - 1) * GAP) / 2;
    const top = (stage.height - (rows - 1) * GAP) / 2;
    dots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) dots.push({ x: left + c * GAP, y: top + r * GAP, ox: 0, oy: 0, vx: 0, vy: 0 });
  };
  layout();

  return {
    resize: layout,
    frame(dt) {
      const { ctx, pointer, colors, rgba } = stage;
      if (pointer.pressed) ripples.push({ x: pointer.x, y: pointer.y, age: 0 });
      ripples = ripples.filter((r) => (r.age += dt) < RIPPLE_LIFE);
      ctx.clearRect(0, 0, stage.width, stage.height);
      for (const d of dots) {
        let fx = -SPRING * d.ox;
        let fy = -SPRING * d.oy;
        const dx = d.x + d.ox - pointer.x;
        const dy = d.y + d.oy - pointer.y;
        const near = Math.hypot(dx, dy) || 1;
        if (near < REACH) {
          const f = (1 - near / REACH) ** 2 * PUSH;
          fx += (dx / near) * f;
          fy += (dy / near) * f;
        }
        for (const r of ripples) {
          const rx = d.x - r.x;
          const ry = d.y - r.y;
          const far = Math.hypot(rx, ry) || 1;
          // Strongest right on the ripple's front, fading as the ripple ages.
          const f = Math.exp(-(((far - r.age * RIPPLE_SPEED) / RIPPLE_WIDTH) ** 2)) * (1 - r.age / RIPPLE_LIFE) * RIPPLE_PUSH;
          fx += (rx / far) * f;
          fy += (ry / far) * f;
        }
        d.vx += (fx - DAMPING * d.vx) * dt;
        d.vy += (fy - DAMPING * d.vy) * dt;
        d.ox += d.vx * dt;
        d.oy += d.vy * dt;

        const moved = Math.min(1, Math.hypot(d.ox, d.oy) / 24);
        // A dot barely off its spot stays grey, so the field is calm wherever nothing is happening.
        if (moved < 0.12) {
          ctx.fillStyle = rgba(colors.muted, 0.5);
        } else {
          // The colour follows the direction the dot was pushed, so the colours fan out around the pointer.
          const turn = (Math.atan2(d.oy, d.ox) + Math.PI) / (2 * Math.PI);
          ctx.fillStyle = rgba(colors.lanes[Math.floor(turn * colors.lanes.length) % colors.lanes.length], 0.55 + 0.45 * moved);
        }
        ctx.beginPath();
        ctx.arc(d.x + d.ox, d.y + d.oy, 1.6 + 4.2 * moved, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}
