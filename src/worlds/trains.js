// Jack's Train World on the Effects' stage (src/effects/stage.js): draws the network from src/lib/trains/layout.js
// and the trains from src/lib/trains/sim.js, flat and top-down like a toy train set, in the site's colours: a bed
// under each track, faint sleepers, two rails; a lamp beside every signal in the colour it shows; each station's yard
// (crates waiting at a pickup; a building at a drop-off with its stock on the roof); the depot's shed; and the
// trains, an engine and three wagons that fill with their cargo's colour at a pickup and empty at a drop-off. What
// never moves is drawn once into a picture of its own and laid down each frame. The trains move in fixed steps and
// are drawn between two steps, so they glide at any frame rate. The stage's --c1 to --c3 are the cargo colours, --c5
// to --c7 the signals' go, wait and stop, and --c8 the ground (the same as the Town's).
import { buildNetwork, sizesAt } from '../lib/trains/layout.js';
import { carsOf, lampOf, startTrains, STEP } from '../lib/trains/sim.js';

/** Seconds of running worked out before the first picture, so trains are already out on the line. */
const WARM_UP = 60;

/** @param {import('../effects/stage.js').Stage} stage */
export default function trains(stage) {
  const { ctx } = stage;
  const seed = Math.floor(Math.random() * 1e9);
  /** @type {import('../lib/trains/layout.js').Network} */
  let network;
  /** @type {ReturnType<typeof startTrains>} */
  let traffic;
  let behind = 0;
  /** Each train's route and place one step ago, so a picture between steps can put it partway. */
  let before = new Map();
  /** The picture of the network, and the size and colours it was drawn for (the stage swaps in new colours when the
   *  theme changes). */
  const still = document.createElement('canvas');
  let stillFor = '';
  let stillColors = null;

  const fit = () => {
    if (network && network.width === stage.width && network.height === stage.height) return;
    network = buildNetwork(stage.width, stage.height, seed);
    traffic = startTrains(network, seed);
    for (let i = 0; i < WARM_UP / STEP; i++) traffic.step();
    before = new Map();
  };
  fit();

  const tick = () => {
    before = new Map(traffic.trains.map((t) => [t, { route: t.route, head: t.head }]));
    traffic.step();
  };

  /** A line through points, offset sideways by `by` (to the right of the way it runs). */
  const offset = (points, by) => points.map((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: p.x - (b.y - a.y) / len * by, y: p.y + (b.x - a.x) / len * by };
  });
  const line = (g, points) => {
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  };
  const box = (g, x, y, angle, length, width, r) => {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.beginPath();
    g.roundRect(-length / 2, -width / 2, length, width, r);
    g.fill();
    g.restore();
  };

  /** A drop-off's building: where it stands in its yard. */
  const buildingOf = (st, k) => ({ length: st.length * 0.7, width: Math.min(st.width - 6 * k, 30 * k) });

  const drawStill = () => {
    const { colors, rgba } = stage;
    const cargo = colors.lanes.slice(0, 3);
    const ground = colors.lanes[7];
    const { k } = network;
    const { tie, gauge } = sizesAt(k);
    still.width = ctx.canvas.width;
    still.height = ctx.canvas.height;
    const g = /** @type {CanvasRenderingContext2D} */ (still.getContext('2d'));
    const density = still.width / stage.width;
    g.setTransform(density, 0, 0, density, 0, 0);
    g.fillStyle = rgba(colors.paper);
    g.fillRect(0, 0, stage.width, stage.height);
    g.fillStyle = rgba(ground);
    g.beginPath();
    g.roundRect(3, 3, stage.width - 6, stage.height - 6, 24 * k);
    g.fill();

    const parts = [...network.tracks, ...network.paths];
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // The beds first, then every sleeper, then every rail, so where tracks cross the rails run over the sleepers.
    g.strokeStyle = rgba(colors.rule, 0.6);
    g.lineWidth = 2 * tie + 2 * k;
    g.beginPath();
    for (const p of parts) line(g, p.points);
    g.stroke();
    g.strokeStyle = rgba(colors.muted, 0.3);
    g.lineWidth = 1.6 * k;
    g.lineCap = 'butt';
    g.beginPath();
    for (const p of parts) {
      for (let s = 3 * k, i = 1; s < p.len; s += 7 * k) {
        while (i < p.lengths.length - 1 && p.lengths[i] < s) i++;
        const a = p.points[i - 1];
        const b = p.points[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const t = (s - p.lengths[i - 1]) / len;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const nx = -(b.y - a.y) / len * tie;
        const ny = (b.x - a.x) / len * tie;
        g.moveTo(x - nx, y - ny);
        g.lineTo(x + nx, y + ny);
      }
    }
    g.stroke();
    g.strokeStyle = rgba(colors.ink, 0.55);
    g.lineWidth = 1.3 * k;
    g.lineCap = 'round';
    g.beginPath();
    for (const p of parts) {
      line(g, offset(p.points, gauge));
      line(g, offset(p.points, -gauge));
    }
    g.stroke();

    // Stations: a platform edge beside the track trains stop at, and in the yard crates waiting at a pickup or a
    // building at a drop-off, in its cargo's colour.
    for (const st of network.stations) {
      g.save();
      g.translate(st.x, st.y);
      g.rotate(st.angle);
      const colour = cargo[st.colour];
      g.fillStyle = rgba(colors.ink, 0.22);
      g.beginPath();
      g.roundRect(-st.length / 2, st.edge * (st.width / 2) - 2 * k, st.length, 4 * k, 1.5 * k);
      g.fill();
      if (st.kind === 'pickup') {
        g.fillStyle = rgba(colour, 0.22);
        g.beginPath();
        g.roundRect(-st.length * 0.4, -st.width / 2 + 3 * k, st.length * 0.8, st.width - 6 * k, 4 * k);
        g.fill();
        g.fillStyle = rgba(colour);
        const crate = Math.min(7 * k, (st.width - 12 * k) / 2);
        for (let col = 0; col < 3; col++) for (let row = 0; row < 2; row++) box(g, (col - 1) * (crate + 3 * k), (row - 0.5) * (crate + 3 * k), 0, crate, crate, 1.5 * k);
      } else {
        const b = buildingOf(st, k);
        g.fillStyle = rgba(colour);
        box(g, 0, 0, 0, b.length, b.width, 3 * k);
      }
      g.restore();
    }

    // The depot's shed, beside its sidings.
    g.save();
    g.translate(network.depot.x, network.depot.y);
    g.rotate(network.depot.angle);
    g.fillStyle = rgba(colors.muted, 0.45);
    box(g, 0, 0, 0, 30 * k, 18 * k, 3 * k);
    g.fillStyle = rgba(colors.paper, 0.5);
    box(g, 0, 0, 0, 24 * k, 1.6 * k, 0.8 * k);
    g.restore();
  };

  /** A train's engine and wagons, partway between their last two steps. */
  const drawTrain = (train, k) => {
    const { colors, rgba } = stage;
    const cargo = colors.lanes[train.colour];
    const was = before.get(train);
    const head = was && was.route === train.route ? was.head + (train.head - was.head) * (behind / STEP) : train.head;
    const width = 9 * k;
    carsOf(train, head, k).forEach((car, i) => {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = rgba(colors.ink, 0.14);
      ctx.beginPath();
      ctx.roundRect(-car.length / 2 + 0.6 * k, -width / 2 + 1.2 * k, car.length, width, 2.5 * k);
      ctx.fill();
      if (car.engine) {
        ctx.fillStyle = rgba(colors.ink, 0.88);
        ctx.beginPath();
        ctx.roundRect(-car.length / 2, -width / 2, car.length, width, [2 * k, 4 * k, 4 * k, 2 * k]);
        ctx.fill();
        // The cab's window, at the front.
        ctx.fillStyle = rgba(colors.paper, 0.6);
        ctx.beginPath();
        ctx.roundRect(car.length / 2 - 8 * k, -width / 2 + 2 * k, 4 * k, width - 4 * k, 1 * k);
        ctx.fill();
      } else {
        ctx.fillStyle = rgba(colors.muted, 0.75);
        ctx.beginPath();
        ctx.roundRect(-car.length / 2, -width / 2, car.length, width, 2 * k);
        ctx.fill();
        // The cargo in this wagon: they fill from the front, one after another, and empty the same way.
        const fill = Math.max(0, Math.min(1, train.cargo * 3 - (i - 1)));
        if (fill > 0) {
          const inner = car.length - 4 * k;
          ctx.fillStyle = rgba(cargo);
          ctx.beginPath();
          ctx.roundRect(inner / 2 - inner * fill, -width / 2 + 2 * k, inner * fill, width - 4 * k, 1.2 * k);
          ctx.fill();
        }
      }
      ctx.restore();
    });
  };

  const draw = () => {
    const key = `${ctx.canvas.width}x${ctx.canvas.height}`;
    if (key !== stillFor || stage.colors !== stillColors) {
      drawStill();
      stillFor = key;
      stillColors = stage.colors;
    }
    ctx.drawImage(still, 0, 0, stage.width, stage.height);
    const { colors, rgba } = stage;
    const { k } = network;
    const lamps = { go: colors.lanes[4], wait: colors.lanes[5], stop: colors.lanes[6] };

    // Each drop-off's stock, as a bar on its roof.
    for (const st of traffic.stations) {
      if (st.kind !== 'drop') continue;
      const b = buildingOf(st, k);
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.rotate(st.angle);
      ctx.fillStyle = rgba(colors.paper, 0.55);
      box(ctx, 0, 0, 0, b.length - 8 * k, 5 * k, 2 * k);
      ctx.fillStyle = rgba(colors.ink, 0.6);
      const full = (b.length - 10 * k) * st.stock;
      ctx.beginPath();
      ctx.roundRect(-(b.length - 10 * k) / 2, -1.5 * k, full, 3 * k, 1.5 * k);
      ctx.fill();
      ctx.restore();
    }

    // The signals, each lamp in what it shows: a ring round a look-ahead one.
    for (const t of network.tracks) {
      for (const sig of t.signals) {
        ctx.fillStyle = rgba(colors.ink, 0.7);
        ctx.beginPath();
        ctx.arc(sig.x, sig.y, (sig.kind === 'chain' ? 3.4 : 2.8) * k, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba(lamps[lampOf(traffic, t, sig)]);
        ctx.beginPath();
        ctx.arc(sig.x, sig.y, (sig.kind === 'chain' ? 2.2 : 1.9) * k, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const train of traffic.trains) drawTrain(train, k);
  };

  return {
    frame(dt) {
      behind += dt;
      while (behind >= STEP) {
        tick();
        behind -= STEP;
      }
      draw();
    },
    resize: fit,
  };
}
