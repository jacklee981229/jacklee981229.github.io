// Orbits: the pointer is a sun, and a few dozen little planets circle it, each on its own path, pulled the way
// real ones are: harder the nearer they come. Move the sun and they trail behind and swing back round it. A click
// flings them outwards, and they fall back.

const PLANETS = 34;
/** The sun's pull, and a softening so a planet passing straight through the sun isn't thrown off to infinity. */
const PULL = 5.5e6;
const SOFT = 34;
/** Points kept of each planet's path, for its tail. */
const TAIL = 30;
/** Further from the sun than half the stage's shorter side plus this, a planet is slowed, so it falls back. */
const FAR = 140;
/** How quickly the sun catches up with the pointer, and how much of each move the planets are left behind by. */
const FOLLOW = 9;
const LAG = 0.3;
/** A click's fling: its reach and its strength. */
const FLING_REACH = 520;
const FLING = 300;
const FASTEST = 1100;
/** A tail is drawn in this many pieces, each fainter and thinner than the one before. */
const FADES = [0.6, 0.34, 0.14];

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function orbits(stage) {
  // The sun glides after the pointer, which smooths out a jerky mouse. Planets and their tails are measured from
  // the sun, so the whole system travels with it.
  const sun = { x: stage.pointer.x, y: stage.pointer.y };
  const planets = Array.from({ length: PLANETS }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const far = 60 + Math.random() * 0.4 * Math.min(stage.width, stage.height);
    // The speed that would hold a circle at this distance, a little off, so the paths come out as ovals.
    const speed = Math.sqrt((PULL * far) / (far * far + SOFT * SOFT)) * (0.82 + Math.random() * 0.3);
    const x = Math.cos(angle) * far;
    const y = Math.sin(angle) * far;
    return { x, y, vx: -Math.sin(angle) * speed, vy: Math.cos(angle) * speed, r: 2 + Math.random() * 3.4, color: i % stage.colors.lanes.length, tail: Array.from({ length: TAIL }, () => [x, y]) };
  });

  return {
    frame(dt) {
      const { ctx, pointer, colors, rgba, width, height } = stage;
      const far = Math.min(width, height) / 2 + FAR;
      const ease = Math.min(1, dt * FOLLOW);
      const movedX = (pointer.x - sun.x) * ease;
      const movedY = (pointer.y - sun.y) * ease;
      sun.x += movedX;
      sun.y += movedY;
      // Two small steps a frame keep the fast swing past the sun smooth.
      for (let half = 0; half < 2 && dt > 0; half++) {
        const h = dt / 2;
        for (const p of planets) {
          if (half === 0) {
            p.x -= movedX * LAG;
            p.y -= movedY * LAG;
          }
          const rr = p.x * p.x + p.y * p.y;
          const r = Math.sqrt(rr) || 1;
          const pull = PULL / (rr + SOFT * SOFT);
          p.vx -= (p.x / r) * pull * h;
          p.vy -= (p.y / r) * pull * h;
          if (pointer.pressed && half === 0 && r < FLING_REACH) {
            p.vx += (p.x / r) * (1 - r / FLING_REACH) * FLING;
            p.vy += (p.y / r) * (1 - r / FLING_REACH) * FLING;
          }
          const speed = Math.hypot(p.vx, p.vy) || 1;
          const slow = Math.min(r > far ? 1 - Math.min(1, 1.4 * h) : 1, FASTEST / speed);
          p.vx *= slow;
          p.vy *= slow;
          p.x += p.vx * h;
          p.y += p.vy * h;
        }
      }
      if (dt > 0) {
        for (const p of planets) {
          p.tail.pop();
          p.tail.unshift([p.x, p.y]);
        }
      }

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(sun.x, sun.y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const each = Math.floor(TAIL / FADES.length);
      FADES.forEach((strength, piece) => {
        const tails = colors.lanes.map(() => new Path2D());
        for (const p of planets) {
          const tail = tails[p.color];
          tail.moveTo(p.tail[piece * each][0], p.tail[piece * each][1]);
          for (let i = piece * each + 1; i <= Math.min(TAIL - 1, (piece + 1) * each); i++) tail.lineTo(p.tail[i][0], p.tail[i][1]);
        }
        ctx.lineWidth = 2.6 - piece * 0.8;
        tails.forEach((tail, c) => {
          ctx.strokeStyle = rgba(colors.lanes[c], strength);
          ctx.stroke(tail);
        });
      });
      const balls = colors.lanes.map(() => new Path2D());
      for (const p of planets) {
        balls[p.color].moveTo(p.x + p.r, p.y);
        balls[p.color].arc(p.x, p.y, p.r, 0, Math.PI * 2);
      }
      balls.forEach((ball, c) => {
        ctx.fillStyle = rgba(colors.lanes[c]);
        ctx.fill(ball);
      });
      // The sun: a bright centre in a faint glow.
      ctx.fillStyle = rgba(colors.ink, 0.1);
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(colors.ink, 0.92);
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };
}
