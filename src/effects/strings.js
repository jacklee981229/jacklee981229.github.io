// Strings: a row of strings from top to bottom, like a harp's. The pointer plucks each one it crosses, harder the
// faster it goes, and the string swings and settles. A click strums the lot, outwards from where it landed.

/** Pixels between strings. */
const GAP = 34;
/** How fast a string swings: the first one on the left, and how much faster the last one on the right. */
const SWING = 15;
const SWING_MORE = 10;
/** How quickly a swing dies away. */
const DAMPING = 1.9;
/** A pluck's push: the gentlest, the hardest, and how much of the pointer's speed goes into it. */
const SOFTEST = 240;
const HARDEST = 1300;
const FROM_SPEED = 0.5;
/** A click's strum: how fast it spreads along the strings, and how hard it plucks each. */
const STRUM_SPEED = 1500;
const STRUM = 620;
/** Further than this in one frame isn't a sweep: the pointer arrived from somewhere else, and plucks nothing. */
const JUMP = 260;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function strings(stage) {
  /** @type {{ x: number, swing: number, bend: number, speed: number, at: number, due: number, push: number }[]}
      `bend` is how far the string is pulled aside, at the height `at` (0 is the top, 1 the bottom). */
  let all = [];
  let before = stage.pointer.x;

  const layout = () => {
    const count = Math.max(3, Math.floor(stage.width / GAP));
    const left = (stage.width - (count - 1) * GAP) / 2;
    all = Array.from({ length: count }, (_, i) => ({ x: left + i * GAP, swing: SWING + (SWING_MORE * i) / count, bend: 0, speed: 0, at: 0.5, due: Infinity, push: 0 }));
  };
  layout();

  return {
    resize: layout,
    frame(dt) {
      const { ctx, pointer, colors, rgba, time, width, height } = stage;
      const went = pointer.x - before;
      const sweeping = went !== 0 && Math.abs(went) < JUMP;
      const push = Math.sign(went) * Math.min(HARDEST, Math.max(SOFTEST, Math.abs(pointer.vx) * FROM_SPEED));
      const calm = new Path2D();
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = 'round';
      all.forEach((s, i) => {
        if (pointer.pressed) {
          s.due = time + Math.abs(s.x - pointer.x) / STRUM_SPEED;
          s.push = (i % 2 ? 1 : -1) * STRUM;
          s.at = pointer.y / height;
        } else if (sweeping && (before - s.x) * (pointer.x - s.x) < 0) {
          s.speed += push;
          s.at = pointer.y / height;
        }
        if (time >= s.due) {
          s.speed += s.push;
          s.due = Infinity;
        }
        s.speed += (-s.swing * s.swing * s.bend - DAMPING * s.speed) * dt;
        s.bend = Math.min(GAP * 1.3, Math.max(-GAP * 1.3, s.bend + s.speed * dt));

        // A string pulled to one side is a curve through its pulled point; drawn by a point twice as far out.
        const lively = Math.min(1, (Math.abs(s.bend) + Math.abs(s.speed) / s.swing) / 16);
        const path = lively < 0.04 ? calm : new Path2D();
        path.moveTo(s.x, 0);
        path.quadraticCurveTo(s.x + s.bend * 2, s.at * height, s.x, height);
        if (path === calm) return;
        ctx.strokeStyle = rgba(colors.lanes[i % colors.lanes.length], 0.45 + 0.55 * lively);
        ctx.lineWidth = 1.4 + 1.8 * lively;
        ctx.stroke(path);
      });
      ctx.strokeStyle = rgba(colors.muted, 0.5);
      ctx.lineWidth = 1.2;
      ctx.stroke(calm);
      before = pointer.x;
    },
  };
}
