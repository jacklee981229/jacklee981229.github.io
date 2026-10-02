// Starfield: stars rush out of one far-off point and past you, as if you were flying into them. The pointer steers:
// that point follows it. A click jumps to a far greater speed for a moment.

/** One star for about this many square pixels of stage, within limits. */
const AREA_EACH = 1600;
const FEWEST = 220;
const MOST = 900;
/** How much nearer a star comes each second (it starts at 1 and passes you at 0), and a click's speed-up. */
const SPEED = 0.26;
const HURRY = 6;
const HURRY_FOR = 1.3;
/** How wide the stars are spread when farthest off, as a share of the stage's longer side. */
const FIELD = 0.34;
/** Nearer than these, a star is drawn in the middle and then the heavy stroke. */
const DEPTHS = [0.6, 0.25];
const WIDTHS = [0.8, 1.4, 2.3];
const STRENGTHS = [0.42, 0.72, 1];

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function starfield(stage) {
  /** @type {{ x: number, y: number, z: number, color: number }[]} x and y run from -1 to 1; color -1 is plain. */
  const stars = [];
  const born = (z) => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z, color: Math.random() < 0.3 ? Math.floor(Math.random() * stage.colors.lanes.length) : -1 });
  const fit = () => {
    const count = Math.min(MOST, Math.max(FEWEST, Math.round((stage.width * stage.height) / AREA_EACH)));
    while (stars.length < count) stars.push(born(Math.random()));
    stars.length = count;
  };
  fit();
  // The far-off point the stars come from: it trails the pointer, which is what steering feels like.
  const from = { x: stage.width / 2, y: stage.height / 2 };
  let speed = SPEED;
  let hurry = 0;

  return {
    resize: fit,
    frame(dt) {
      const { ctx, pointer, colors, rgba, width, height } = stage;
      const ease = Math.min(1, dt * 2.5);
      from.x += (pointer.x - from.x) * ease;
      from.y += (pointer.y - from.y) * ease;
      if (pointer.pressed) hurry = HURRY_FOR;
      hurry = Math.max(0, hurry - dt);
      speed += (SPEED * (1 + (HURRY - 1) * Math.min(1, (hurry / HURRY_FOR) * 1.6)) - speed) * Math.min(1, dt * 5);

      const spread = Math.max(width, height) * FIELD;
      // Strokes are gathered by weight and colour: a few strokes draw every star.
      const paths = WIDTHS.map(() => [new Path2D(), ...colors.lanes.map(() => new Path2D())]);
      for (let i = 0; i < stars.length; i++) {
        let s = stars[i];
        s.z -= speed * dt;
        let x = from.x + (s.x * spread) / s.z;
        let y = from.y + (s.y * spread) / s.z;
        if (s.z < 0.03 || x < -60 || x > width + 60 || y < -60 || y > height + 60) {
          s = stars[i] = born(1);
          x = from.x + s.x * spread;
          y = from.y + s.y * spread;
        }
        // Its streak runs back to where it was a moment ago: longer the faster it goes. Never no length at all,
        // or a paused stage would show nothing.
        const tail = s.z + Math.max(speed * dt * 1.8, 0.006);
        const depth = s.z < DEPTHS[1] ? 2 : s.z < DEPTHS[0] ? 1 : 0;
        const path = paths[depth][s.color + 1];
        path.moveTo(from.x + (s.x * spread) / tail, from.y + (s.y * spread) / tail);
        path.lineTo(x, y);
      }

      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = 'round';
      paths.forEach((byColor, depth) => {
        ctx.lineWidth = WIDTHS[depth];
        byColor.forEach((path, c) => {
          ctx.strokeStyle = rgba(c ? colors.lanes[c - 1] : colors.ink, STRENGTHS[depth]);
          ctx.stroke(path);
        });
      });
    },
  };
}
