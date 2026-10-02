// Flock: a shoal of fish. Each one follows three simple habits (keep off your neighbours, swim the way they swim,
// stay with the group), and out of that the shoal turns and streams as one. It trails after the pointer. A click
// frightens it, and the fish dart away from that spot before gathering again.

/** One fish for about this many square pixels of stage, within limits (every pair is compared each frame). */
const AREA_EACH = 7200;
const FEWEST = 36;
const MOST = 150;
/** How far a fish notices others, and how near is too near. */
const SEE = 64;
const TOO_NEAR = 22;
/** The three habits' strengths, and the pointer's pull (which stops close by, so they circle it, not pile on it). */
const APART = 900;
const ALONG = 1.1;
const TOGETHER = 0.9;
const PULL = 110;
const PULL_FROM = 60;
/** Speeds: what a fish settles to, its fastest, and its fastest when frightened. */
const CRUISE = 120;
const FASTEST = 210;
const BOLT = 430;
/** A click's fright: how far it reaches, how hard it drives them off, and how long it lasts. */
const FRIGHT_REACH = 380;
const FRIGHT = 2600;
const FRIGHT_FOR = 1.3;
/** Nearer the stage's edge than this, a fish turns back in. */
const MARGIN = 50;
const TURN_BACK = 520;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function flock(stage) {
  /** @type {{ x: number, y: number, vx: number, vy: number, color: number }[]} */
  const fish = [];
  const born = () => {
    const angle = Math.random() * Math.PI * 2;
    return { x: Math.random() * stage.width, y: Math.random() * stage.height, vx: Math.cos(angle) * CRUISE, vy: Math.sin(angle) * CRUISE, color: Math.floor(Math.random() * stage.colors.lanes.length) };
  };
  const fit = () => {
    const count = Math.min(MOST, Math.max(FEWEST, Math.round((stage.width * stage.height) / AREA_EACH)));
    while (fish.length < count) fish.push(born());
    fish.length = count;
  };
  fit();
  const fright = { x: 0, y: 0, left: 0 };

  return {
    resize: fit,
    frame(dt) {
      const { ctx, pointer, colors, rgba, width, height } = stage;
      if (pointer.pressed) Object.assign(fright, { x: pointer.x, y: pointer.y, left: FRIGHT_FOR });
      fright.left = Math.max(0, fright.left - dt);

      for (const f of fish) {
        let ax = 0;
        let ay = 0;
        let seen = 0;
        let alongX = 0;
        let alongY = 0;
        let midX = 0;
        let midY = 0;
        for (const other of fish) {
          if (other === f) continue;
          const dx = other.x - f.x;
          const dy = other.y - f.y;
          const far = Math.hypot(dx, dy);
          if (far >= SEE || far === 0) continue;
          seen++;
          alongX += other.vx;
          alongY += other.vy;
          midX += other.x;
          midY += other.y;
          if (far < TOO_NEAR) {
            ax -= (dx / far) * (1 - far / TOO_NEAR) * APART;
            ay -= (dy / far) * (1 - far / TOO_NEAR) * APART;
          }
        }
        if (seen) {
          ax += (alongX / seen - f.vx) * ALONG + (midX / seen - f.x) * TOGETHER;
          ay += (alongY / seen - f.vy) * ALONG + (midY / seen - f.y) * TOGETHER;
        }
        const px = pointer.x - f.x;
        const py = pointer.y - f.y;
        const off = Math.hypot(px, py) || 1;
        if (off > PULL_FROM) {
          ax += (px / off) * PULL;
          ay += (py / off) * PULL;
        }
        if (fright.left) {
          const fx = f.x - fright.x;
          const fy = f.y - fright.y;
          const from = Math.hypot(fx, fy) || 1;
          if (from < FRIGHT_REACH) {
            ax += (fx / from) * (1 - from / FRIGHT_REACH) * FRIGHT;
            ay += (fy / from) * (1 - from / FRIGHT_REACH) * FRIGHT;
          }
        }
        if (f.x < MARGIN) ax += TURN_BACK;
        else if (f.x > width - MARGIN) ax -= TURN_BACK;
        if (f.y < MARGIN) ay += TURN_BACK;
        else if (f.y > height - MARGIN) ay -= TURN_BACK;

        f.vx += ax * dt;
        f.vy += ay * dt;
        // It eases back to its own pace, and never goes faster than a fish can.
        let speed = Math.hypot(f.vx, f.vy) || 1;
        const pace = 1 + (CRUISE / speed - 1) * Math.min(1, dt * 1.5);
        const most = fright.left ? BOLT : FASTEST;
        const scale = Math.min(pace, most / speed);
        f.vx *= scale;
        f.vy *= scale;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }

      ctx.clearRect(0, 0, width, height);
      // Each fish is a dart pointing the way it swims; all of one colour are drawn in one go.
      const darts = colors.lanes.map(() => new Path2D());
      for (const f of fish) {
        const speed = Math.hypot(f.vx, f.vy) || 1;
        const hx = f.vx / speed;
        const hy = f.vy / speed;
        const dart = darts[f.color];
        dart.moveTo(f.x + hx * 10, f.y + hy * 10);
        dart.lineTo(f.x - hx * 7 - hy * 5, f.y - hy * 7 + hx * 5);
        dart.lineTo(f.x - hx * 3.5, f.y - hy * 3.5);
        dart.lineTo(f.x - hx * 7 + hy * 5, f.y - hy * 7 - hx * 5);
        dart.closePath();
      }
      darts.forEach((dart, c) => {
        ctx.fillStyle = rgba(colors.lanes[c]);
        ctx.fill(dart);
      });
    },
  };
}
