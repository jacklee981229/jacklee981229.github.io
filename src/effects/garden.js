// Garden: plants grow up from the bottom of the stage, branch by branch, and come into flower. They lean towards
// the pointer, and a quick sweep of it is a gust of wind that bends them all. A click plants a new one there. The
// garden only has room for so many, so the oldest folds back into the ground as new ones come up.

/** How many times a stem branches before it flowers. */
const DEPTH = 5;
/** How many plants there's room for. */
const ROOM = 11;
/** Seconds between new plants coming up by themselves. */
const SOW_EVERY = 5;
/** How far a plant's tips turn (in radians): leaning to the pointer, in the wind of a sweep, and swaying on their own. */
const LEAN = 0.36;
const WIND = 0.95;
const SWAY = 0.07;
/** The pointer's speed, in pixels a second, that makes a full gust. */
const GUST_FROM = 1100;
/** Each stem takes a share of that turn, the trunk least and the twigs most; the shares add up to 1 from root to tip. */
const SHARES = Array.from({ length: DEPTH + 1 }, (_, depth) => 0.6 + depth * 0.45).map((share, _, all) => share / all.reduce((a, b) => a + b));
/** A stem's width at each depth, from the trunk out. */
const WIDTHS = [4.6, 3.3, 2.4, 1.7, 1.2, 0.9];
/** Seconds a flower takes to open, and how many times faster a plant folds away than it grew. */
const OPEN_IN = 0.5;
const FOLD = 5;

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

/**
 * A plant's stems are listed trunk first, every stem after the one it grows from; each starts as that one finishes.
 * @typedef {{ parent: number, depth: number, turn: number, length: number, start: number, time: number }} Stem
 */

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function garden(stage) {
  /** @type {{ x: number, age: number, folding: boolean, phase: number, color: number, stems: Stem[], ends: Float32Array }[]} */
  let plants = [];
  let wind = 0;
  let sinceSown = 0;

  /** A new plant rooted at x, worked out whole: growing only uncovers it. */
  const sprout = (x, age = 0) => {
    /** @type {Stem[]} */
    const stems = [];
    const branch = (parent, depth, turn, length, start) => {
      const time = 0.22 + Math.random() * 0.16;
      const at = stems.push({ parent, depth, turn, length, start, time }) - 1;
      if (depth === DEPTH) return;
      const shoots = depth === 0 || Math.random() < 0.8 ? 2 : 3;
      for (let k = 0; k < shoots; k++) {
        const fan = (k - (shoots - 1) / 2) * (0.55 + Math.random() * 0.35) + (Math.random() - 0.5) * 0.3;
        branch(at, depth + 1, fan, length * (0.66 + Math.random() * 0.14), start + time);
      }
    };
    branch(-1, 0, (Math.random() - 0.5) * 0.12, stage.height * (0.15 + Math.random() * 0.09), 0);
    // Where each stem ends and which way it points, worked out afresh every frame: x, y, angle.
    return { x, age, folding: false, phase: Math.random() * 6, color: Math.floor(Math.random() * stage.colors.lanes.length), stems, ends: new Float32Array(stems.length * 3) };
  };
  const sow = (x) => {
    plants.push(sprout(x));
    const staying = plants.filter((p) => !p.folding);
    if (staying.length > ROOM) staying[0].folding = true;
  };
  const layout = () => {
    // A garden already under way: some plants in flower, some half grown.
    plants = Array.from({ length: 6 }, (_, i) => sprout(stage.width * ((i + 0.5) / 6 + (Math.random() - 0.5) * 0.08), 3.2 - i * 0.6));
    plants.sort(() => Math.random() - 0.5);
  };
  layout();

  return {
    resize: layout,
    frame(dt) {
      const { ctx, pointer, colors, rgba, time, width, height } = stage;
      if (pointer.pressed) sow(pointer.x);
      sinceSown += dt;
      if (sinceSown > SOW_EVERY) {
        sinceSown = 0;
        sow(width * (0.06 + Math.random() * 0.88));
      }
      wind += (clamp(pointer.vx / GUST_FROM, -1, 1) - wind) * Math.min(1, dt * 2.5);

      const stemPaths = WIDTHS.map(() => new Path2D());
      const flowers = colors.lanes.map(() => new Path2D());
      for (const p of plants) {
        p.age += p.folding ? -dt * FOLD : dt;
        const lean = clamp((pointer.x - p.x) / width, -1, 1) * LEAN + wind * WIND + Math.sin(time * 1.2 + p.phase) * SWAY;
        p.stems.forEach((s, i) => {
          const grown = clamp((p.age - s.start) / s.time, 0, 1);
          if (grown <= 0) return;
          const fromX = s.parent < 0 ? p.x : p.ends[s.parent * 3];
          const fromY = s.parent < 0 ? height : p.ends[s.parent * 3 + 1];
          // Straight up from the ground; each stem turns from the one it grows on, and takes its share of the lean.
          const angle = (s.parent < 0 ? -Math.PI / 2 : p.ends[s.parent * 3 + 2]) + s.turn + lean * SHARES[s.depth];
          const reach = s.length * (1 - (1 - grown) ** 2);
          const x = fromX + Math.cos(angle) * reach;
          const y = fromY + Math.sin(angle) * reach;
          p.ends[i * 3] = x;
          p.ends[i * 3 + 1] = y;
          p.ends[i * 3 + 2] = angle;
          stemPaths[s.depth].moveTo(fromX, fromY);
          stemPaths[s.depth].lineTo(x, y);
          if (s.depth < DEPTH) return;
          const open = clamp((p.age - s.start - s.time) / OPEN_IN, 0, 1);
          if (open <= 0) return;
          // Mostly the plant's own colour, with a few of another.
          const flower = flowers[i % 4 ? p.color : (p.color + 2) % flowers.length];
          const r = 1.6 + 3 * open;
          flower.moveTo(x + r, y);
          flower.arc(x, y, r, 0, Math.PI * 2);
        });
      }
      plants = plants.filter((p) => p.age > 0 || !p.folding);

      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = 'round';
      // Stems in the ink, softened towards the page.
      ctx.strokeStyle = rgba(/** @type {import('./stage.js').Rgb} */ (colors.ink.map((part, c) => Math.round(colors.paper[c] + (part - colors.paper[c]) * 0.62))));
      stemPaths.forEach((path, depth) => {
        ctx.lineWidth = WIDTHS[depth];
        ctx.stroke(path);
      });
      flowers.forEach((path, c) => {
        ctx.fillStyle = rgba(colors.lanes[c]);
        ctx.fill(path);
      });
    },
  };
}
