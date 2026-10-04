// Garden: plants grow up from the bottom of the stage, branch by branch, and come into flower. No two grow alike:
// short ones and tall ones, branches that fork in two or three, carry straight on, or stop early in a flower. They
// lean towards the pointer, and a quick sweep of it is a gust of wind that bends the ones it passes over most. Each
// plant swings on its own: a tall one bends far and swings slowly back and forth, a short one only a little and
// springs straight back. A click plants a new one there. The garden only has room for so many, so the oldest folds back
// into the ground as new ones come up.

/** How many times a tall plant's stem branches before it flowers; a short one starts further along, so fewer. */
const DEPTH = 5;
/** How many plants there's room for. */
const ROOM = 11;
/** Seconds between new plants coming up by themselves. */
const SOW_EVERY = 5;
/** How far a plant's tips turn (in radians): leaning to the pointer, in the wind of a sweep, and swaying on their own. */
const LEAN = 0.6;
const WIND = 1.3;
/** The most a plant bends, however hard it's pushed. */
const MOST = 1.2;
const SWAY = 0.07;
/** How far a branch sways on its own, out of step with the others. */
const FLUTTER = 0.05;
/** A plant's trunk, as a share of the stage's height: the shortest and the tallest. */
const SHORTEST = 0.1;
const TALLEST = 0.25;
/** How much of the lean the shortest and the tallest plant take: a tall stem bends further. */
const STIFF = 0.3;
const BENDY = 1.7;
/** How a gust fades with distance from the pointer: at this share of the stage's width away, to about a third. */
const GUST_REACH = 0.3;
/**
 * A plant's springiness, shortest to tallest: how quickly it swings to where the pointer and the wind would put it
 * (a swing a second, about), and how little it overshoots (1 would be not at all).
 */
const QUICKEST = 2.2;
const SLOWEST = 0.6;
const SETTLE = 0.3;
/** The pointer's speed, in pixels a second, that makes a full gust. */
const GUST_FROM = 1100;
/**
 * Each stem takes a share of that turn, the trunk a little less than the twigs, so the whole plant curves rather than
 * only its tips; the shares add up to 1 from root to tip.
 */
const SHARES = Array.from({ length: DEPTH + 1 }, (_, depth) => 1 + depth * 0.15).map((share, _, all) => share / all.reduce((a, b) => a + b));
/** A stem's width at each depth, from the trunk out. */
const WIDTHS = [4.6, 3.3, 2.4, 1.7, 1.2, 0.9];
/** Seconds a flower takes to open, and how many times faster a plant folds away than it grew. */
const OPEN_IN = 0.5;
const FOLD = 5;

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

/**
 * A plant's stems are listed trunk first, every stem after the one it grows from; each starts as that one finishes.
 * A stem with nothing growing from it is a tip, and flowers.
 * @typedef {{ parent: number, depth: number, turn: number, length: number, start: number, time: number, tip: boolean, phase: number }} Stem
 */

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function garden(stage) {
  /**
   * `lean` is how far the plant is bent right now, and `swing` how fast that's changing.
   * @type {{ x: number, age: number, folding: boolean, phase: number, bend: number, spring: number, lean: number, swing: number, color: number, stems: Stem[], ends: Float32Array }[]}
   */
  let plants = [];
  let wind = 0;
  let sinceSown = 0;

  /** A new plant rooted at x, worked out whole: growing only uncovers it. */
  const sprout = (x, age = 0) => {
    /** @type {Stem[]} */
    const stems = [];
    // 0 for the shortest plant, 1 for the tallest. A short one starts further along the depths: a thinner trunk and
    // fewer forks.
    const tall = Math.random();
    const first = tall < 0.3 ? 2 : tall < 0.6 ? 1 : 0;
    const branch = (parent, depth, turn, length, start) => {
      const time = 0.22 + Math.random() * 0.16;
      const stem = { parent, depth, turn, length, start, time, tip: true, phase: Math.random() * 6 };
      const at = stems.push(stem) - 1;
      // Past its second fork, a branch may stop early.
      if (depth === DEPTH || (depth > first + 1 && Math.random() < 0.12)) return;
      stem.tip = false;
      const roll = Math.random();
      const shoots = depth === first ? (roll < 0.7 ? 2 : 3) : roll < 0.15 ? 1 : roll < 0.8 ? 2 : 3;
      // The forks lean to one side or the other as a group, not always evenly about the stem.
      const lean = (Math.random() - 0.5) * 0.4;
      for (let k = 0; k < shoots; k++) {
        const fan = shoots === 1 ? (Math.random() - 0.5) * 0.35 : (k - (shoots - 1) / 2) * (0.45 + Math.random() * 0.5) + lean + (Math.random() - 0.5) * 0.3;
        branch(at, depth + 1, fan, length * (0.6 + Math.random() * 0.26), start + time);
      }
    };
    branch(-1, first, (Math.random() - 0.5) * 0.12, stage.height * (SHORTEST + tall * (TALLEST - SHORTEST)), 0);
    // Where each stem ends and which way it points, worked out afresh every frame: x, y, angle.
    return { x, age, folding: false, phase: Math.random() * 6, bend: STIFF + tall * (BENDY - STIFF), spring: (Math.PI * 2 * (QUICKEST + tall * (SLOWEST - QUICKEST))) ** 2, lean: 0, swing: 0, color: Math.floor(Math.random() * stage.colors.lanes.length), stems, ends: new Float32Array(stems.length * 3) };
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
        const gust = wind * WIND * Math.exp(-(((pointer.x - p.x) / (width * GUST_REACH)) ** 2));
        const want = clamp((clamp((pointer.x - p.x) / width, -1, 1) * LEAN + gust + Math.sin(time * 1.2 + p.phase) * SWAY) * p.bend, -MOST, MOST);
        // A spring with a little give: it bends towards where it's pushed, overshoots, and swings back.
        const step = Math.min(dt, 1 / 30);
        p.swing += (p.spring * (want - p.lean) - 2 * SETTLE * Math.sqrt(p.spring) * p.swing) * step;
        p.lean += p.swing * step;
        const lean = p.lean;
        p.stems.forEach((s, i) => {
          const grown = clamp((p.age - s.start) / s.time, 0, 1);
          if (grown <= 0) return;
          const fromX = s.parent < 0 ? p.x : p.ends[s.parent * 3];
          const fromY = s.parent < 0 ? height : p.ends[s.parent * 3 + 1];
          // Straight up from the ground; each stem turns from the one it grows on, and takes its share of the lean.
          const flutter = Math.sin(time * (1.6 + s.phase * 0.12) + s.phase) * FLUTTER * SHARES[s.depth] * DEPTH;
          const angle = (s.parent < 0 ? -Math.PI / 2 : p.ends[s.parent * 3 + 2]) + s.turn + lean * SHARES[s.depth] + flutter;
          const reach = s.length * (1 - (1 - grown) ** 2);
          const x = fromX + Math.cos(angle) * reach;
          const y = fromY + Math.sin(angle) * reach;
          p.ends[i * 3] = x;
          p.ends[i * 3 + 1] = y;
          p.ends[i * 3 + 2] = angle;
          stemPaths[s.depth].moveTo(fromX, fromY);
          stemPaths[s.depth].lineTo(x, y);
          if (!s.tip) return;
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
