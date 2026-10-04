// Orbits: the pointer is a sun, and a few dozen little planets circle it, each on its own path, pulled the way
// real ones are: harder the nearer they come. Each path is tipped its own way out of the screen's flat, so they
// cross at every angle, and some planets go round the other way. Only the sun follows the pointer: move it and the
// planets are left where they were and chase after it, the ones left furthest behind hardest, each at its own pace.
// A click flings them outwards, and they fall back.

const PLANETS = 34;
/** The sun's pull, and a softening so a planet passing straight through the sun isn't thrown off to infinity. */
const PULL = 5.5e6;
const SOFT = 34;
/** Points kept of each planet's path, for its tail. */
const TAIL = 30;
/** Further from the sun than half the stage's shorter side plus this, a planet always counts as left behind. */
const FAR = 140;
/** How quickly the sun catches up with the pointer. */
const FOLLOW = 4;
/**
 * Further from the sun than its path ever takes it (and a little more), a planet has been left behind: it's pulled
 * on harder the further it is (CHASE for each pixel too far, times its own eagerness), and its going further away is
 * slowed by DRAG a second, so it turns back and settles into its path again instead of shooting past.
 */
const LEEWAY = 1.15;
const CHASE = 2;
const DRAG = 1.6;
/** A click's fling: its reach and its strength. */
const FLING_REACH = 520;
const FLING = 300;
const FASTEST = 1100;
/** A tail is drawn in this many pieces, each fainter and thinner than the one before. */
const FADES = [0.6, 0.34, 0.14];
/** How far a path can be tipped out of the screen's flat (in radians), and the share of planets going round backwards. */
const TIP = 1.05;
const BACKWARDS = 0.3;
/** A planet's speed against the one that would hold a circle, slowest and fastest: ovals of every shape. */
const SLOW = 0.7;
const QUICK = 1.22;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function orbits(stage) {
  // The sun glides after the pointer, which smooths out a jerky mouse. Planets and their tails are measured from
  // the sun, so each move of the sun is taken off them: they stay where they were on the stage.
  const sun = { x: stage.pointer.x, y: stage.pointer.y };
  // Planets move in depth too (z, towards the viewer); only their sizes show it.
  const planets = Array.from({ length: PLANETS }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const far = 60 + Math.random() * 0.4 * Math.min(stage.width, stage.height);
    // The speed that would hold a circle at this distance, more or less, and a little in or out as well as across.
    const speed = Math.sqrt((PULL * far) / (far * far + SOFT * SOFT)) * (SLOW + Math.random() * (QUICK - SLOW));
    const way = Math.random() < BACKWARDS ? -1 : 1;
    const out = (Math.random() - 0.5) * 0.6;
    // Worked out flat, then the path is tipped about one line through the sun, and that line turned any way round.
    const tip = Math.random() * TIP;
    const turn = Math.random() * Math.PI * 2;
    const place = (x, y) => [x * Math.cos(turn) - y * Math.cos(tip) * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(tip) * Math.cos(turn), y * Math.sin(tip)];
    const [x, y, z] = place(Math.cos(angle) * far, Math.sin(angle) * far);
    const [vx, vy, vz] = place((-Math.sin(angle) * way + Math.cos(angle) * out) * speed, (Math.cos(angle) * way + Math.sin(angle) * out) * speed);
    // Its furthest from the sun, worked out as if the pull were exactly a planet's: twice the path's half-length.
    const energy = (speed * speed * (1 + out * out)) / 2 - PULL / far;
    const furthest = energy < 0 ? Math.min(3 * far, -PULL / energy) : 3 * far;
    return { x, y, z, vx, vy, vz, leash: Math.max(far, furthest) * LEEWAY, eager: 0.5 + Math.random(), r: 2 + Math.random() * 3.4, color: i % stage.colors.lanes.length, tail: Array.from({ length: TAIL }, () => [x, y]) };
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
            p.x -= movedX;
            p.y -= movedY;
            for (const point of p.tail) {
              point[0] -= movedX;
              point[1] -= movedY;
            }
          }
          const rr = p.x * p.x + p.y * p.y + p.z * p.z;
          const r = Math.sqrt(rr) || 1;
          const pull = PULL / (rr + SOFT * SOFT);
          p.vx -= (p.x / r) * pull * h;
          p.vy -= (p.y / r) * pull * h;
          p.vz -= (p.z / r) * pull * h;
          const behind = r - Math.min(p.leash, far);
          if (behind > 0) {
            const away = (p.vx * p.x + p.vy * p.y + p.vz * p.z) / r;
            const chase = CHASE * p.eager * behind * h + (away > 0 ? away * Math.min(1, DRAG * h) : 0);
            p.vx -= (p.x / r) * chase;
            p.vy -= (p.y / r) * chase;
            p.vz -= (p.z / r) * chase;
          }
          if (pointer.pressed && half === 0 && r < FLING_REACH) {
            const fling = (1 - r / FLING_REACH) * FLING;
            p.vx += (p.x / r) * fling;
            p.vy += (p.y / r) * fling;
            p.vz += (p.z / r) * fling;
          }
          const speed = Math.hypot(p.vx, p.vy, p.vz) || 1;
          const slow = Math.min(1, FASTEST / speed);
          p.vx *= slow;
          p.vy *= slow;
          p.vz *= slow;
          p.x += p.vx * h;
          p.y += p.vy * h;
          p.z += p.vz * h;
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
      const depth = Math.min(width, height);
      for (const p of planets) {
        // Nearer the viewer, bigger.
        const r = p.r * Math.min(1.5, Math.max(0.55, 1 + (p.z / depth) * 0.9));
        balls[p.color].moveTo(p.x + r, p.y);
        balls[p.color].arc(p.x, p.y, r, 0, Math.PI * 2);
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
