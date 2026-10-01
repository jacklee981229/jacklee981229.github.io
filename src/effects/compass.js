// Compass: a field of needles that all turn to point at the pointer. Each turns on a spring of its own, so they
// swing past and wobble before they settle; the near ones grow and take a colour. A click sets them spinning, in a
// ring that spreads across the field.

/** Pixels between needles. */
const GAP = 34;
/** A needle's length far from the pointer and right beside it, and how far "near" reaches. */
const SHORT = 12;
const LONG = 26;
const REACH = 280;
/** The spring that turns a needle to face the pointer, and how fast its wobble dies. */
const SPRING = 120;
const DAMPING = 9;
/** A click's spin: how fast its ring spreads, how wide the ring is, how long it lasts and how hard it turns. */
const SPIN_SPEED = 680;
const SPIN_WIDTH = 60;
const SPIN_LIFE = 1.7;
const SPIN_PUSH = 600;
/** How many strengths of colour the lit-up needles are drawn in. */
const SHADES = 4;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function compass(stage) {
  /** @type {{ x: number, y: number, angle: number, turn: number }[]} `turn` is how fast the needle is turning. */
  let needles = [];
  /** @type {{ x: number, y: number, age: number }[]} */
  let spins = [];

  const layout = () => {
    const cols = Math.max(2, Math.floor(stage.width / GAP));
    const rows = Math.max(2, Math.floor(stage.height / GAP));
    const left = (stage.width - (cols - 1) * GAP) / 2;
    const top = (stage.height - (rows - 1) * GAP) / 2;
    needles = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = left + c * GAP;
        const y = top + r * GAP;
        // Already facing the pointer, so a new size doesn't set the whole field swinging.
        needles.push({ x, y, angle: Math.atan2(stage.pointer.y - y, stage.pointer.x - x), turn: 0 });
      }
    }
  };
  layout();

  return {
    resize: layout,
    frame(dt) {
      const { ctx, pointer, colors, rgba } = stage;
      if (pointer.pressed) spins.push({ x: pointer.x, y: pointer.y, age: 0 });
      spins = spins.filter((s) => (s.age += dt) < SPIN_LIFE);

      // Needles of one colour and strength are gathered and drawn together: the calm ones, then each lit-up kind.
      const kind = () => ({ line: new Path2D(), head: new Path2D() });
      const calm = kind();
      const lit = colors.lanes.map(() => Array.from({ length: SHADES }, kind));
      for (const n of needles) {
        const dx = pointer.x - n.x;
        const dy = pointer.y - n.y;
        // The short way round to facing the pointer.
        const off = Math.atan2(dy, dx) - n.angle;
        let push = SPRING * Math.atan2(Math.sin(off), Math.cos(off));
        for (const s of spins) {
          // Strongest right on the ring's front, fading as the ring ages.
          const band = (Math.hypot(n.x - s.x, n.y - s.y) - s.age * SPIN_SPEED) / SPIN_WIDTH;
          push += Math.exp(-band * band) * (1 - s.age / SPIN_LIFE) * SPIN_PUSH;
        }
        n.turn += (push - DAMPING * n.turn) * dt;
        n.angle += n.turn * dt;

        const near = Math.max(0, 1 - Math.hypot(dx, dy) / REACH) ** 2;
        // A needle lights up near the pointer, and while it's still swinging.
        const glow = Math.min(1, Math.max(near, Math.abs(n.turn) / 10));
        const shade = glow < 0.06 ? -1 : Math.min(SHADES - 1, Math.floor(glow * SHADES));
        // The colour follows the way the needle points, so the colours fan out around the pointer.
        const around = ((n.angle / (Math.PI * 2)) % 1 + 1) % 1;
        const { line, head } = shade < 0 ? calm : lit[Math.floor(around * lit.length) % lit.length][shade];
        const half = (SHORT + (LONG - SHORT) * near) / 2;
        const cos = Math.cos(n.angle);
        const sin = Math.sin(n.angle);
        const hx = n.x + cos * half;
        const hy = n.y + sin * half;
        const dot = shade < 0 ? 1.5 : 1.9 + shade * 0.5;
        line.moveTo(n.x - cos * half, n.y - sin * half);
        line.lineTo(hx, hy);
        // The end that points gets a head.
        head.moveTo(hx + dot, hy);
        head.arc(hx, hy, dot, 0, Math.PI * 2);
      }

      ctx.clearRect(0, 0, stage.width, stage.height);
      ctx.lineCap = 'round';
      // Colours are mixed into the page's, not see-through: a see-through head would show darker over its needle.
      /** @param {import('./stage.js').Rgb} color @param {number} strength */
      const mixed = (color, strength) => rgba(/** @type {import('./stage.js').Rgb} */ (color.map((part, c) => Math.round(colors.paper[c] + (part - colors.paper[c]) * strength))));
      /** @param {{ line: Path2D, head: Path2D }} paths @param {string} paint @param {number} width */
      const draw = (paths, paint, width) => {
        ctx.strokeStyle = paint;
        ctx.fillStyle = paint;
        ctx.lineWidth = width;
        ctx.stroke(paths.line);
        ctx.fill(paths.head);
      };
      draw(calm, mixed(colors.muted, 0.55), 1.3);
      lit.forEach((shades, c) => shades.forEach((paths, s) => draw(paths, mixed(colors.lanes[c], 0.4 + (0.6 * (s + 1)) / SHADES), 1.5 + s * 0.5)));
    },
  };
}
