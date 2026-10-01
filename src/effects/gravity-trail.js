// Gravity Trail: the pointer sheds little balls that fall, bounce along the floor and fade. A quick move throws
// them further; a click throws a whole burst.

const GRAVITY = 1500;
/** How much speed a ball keeps when it bounces off the floor or a wall. */
const BOUNCE = 0.58;
const DRAG = 0.4;
/** Seconds a ball lasts, and how many there can be at once. */
const LIFE = 3.8;
const MOST = 700;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function gravityTrail(stage) {
  /** @type {{ x: number, y: number, vx: number, vy: number, r: number, color: number, age: number }[]} */
  let balls = [];
  let owed = 0;
  const spread = (size) => (Math.random() - 0.5) * size;
  /** @param {number} vx @param {number} vy */
  const drop = (vx, vy) => {
    if (balls.length >= MOST) balls.shift();
    balls.push({ x: stage.pointer.x, y: stage.pointer.y, vx, vy, r: 2.5 + Math.random() * 5, color: Math.floor(Math.random() * stage.colors.lanes.length), age: 0 });
  };

  return {
    frame(dt) {
      const { ctx, pointer, colors, rgba } = stage;
      const speed = Math.hypot(pointer.vx, pointer.vy);
      // A steady trickle, more the faster the pointer goes.
      owed += dt * Math.min(140, 18 + speed * 0.14);
      for (; owed >= 1; owed--) drop(pointer.vx * 0.32 + spread(220), pointer.vy * 0.32 + spread(220) - 60);
      if (pointer.pressed) {
        for (let i = 0; i < 56; i++) {
          const angle = -Math.PI / 2 + spread(2.4);
          const power = 280 + Math.random() * 520;
          drop(Math.cos(angle) * power, Math.sin(angle) * power);
        }
      }

      ctx.clearRect(0, 0, stage.width, stage.height);
      balls = balls.filter((b) => (b.age += dt) < LIFE);
      for (const b of balls) {
        b.vy += GRAVITY * dt;
        b.vx -= b.vx * DRAG * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const floor = stage.height - b.r;
        if (b.y > floor) {
          b.y = floor;
          // Too slow to bounce again: it settles and rolls to a stop.
          b.vy = Math.abs(b.vy) < 70 ? 0 : -b.vy * BOUNCE;
          b.vx *= 0.9;
        }
        if (b.x < b.r || b.x > stage.width - b.r) {
          b.x = Math.min(Math.max(b.x, b.r), stage.width - b.r);
          b.vx = -b.vx * BOUNCE;
        }
        // Fades and shrinks over its last second.
        const left = Math.min(1, LIFE - b.age);
        ctx.fillStyle = rgba(colors.lanes[b.color], 0.25 + 0.75 * left);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * (0.4 + 0.6 * left), 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}
