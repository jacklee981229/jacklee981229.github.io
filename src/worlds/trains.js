// Jack's Train World on the Effects' stage (src/effects/stage.js): draws the network from src/lib/trains/layout.js
// and the trains from src/lib/trains/sim.js, flat and top-down like a toy train set, in the site's colours: a bed
// under each track, faint sleepers, two rails; a lamp beside every signal in the colour it shows; each station's yard
// (crates waiting at a pickup; a building at a drop-off with its stock on the roof); the depot's shed; and the
// trains, an engine and three wagons that fill with their cargo's colour at a pickup and empty at a drop-off. What
// never moves is drawn once into a picture of its own and laid down each frame. The trains move in fixed steps and
// are drawn between two steps, so they glide at any frame rate. Click a train and the view glides in on it and
// follows it (src/lib/trains/view.js); click anywhere else, or press Esc, and it glides back out. The page's Add train
// and Remove train buttons bring a train onto the railway along the line from outside, and send a parked one off. Zoomed in, what never
// moves is drawn afresh each frame, only what's in view, so it stays sharp. The stage's --c1 to --c3 are the cargo
// colours, --c5 to --c7 the signals' go, wait and stop, and --c8 the ground (the same as the Town's).
import { buildNetwork, sizesAt } from '../lib/trains/layout.js';
import { carsOf, lampOf, startTrains, STEP } from '../lib/trains/sim.js';
import { trainAt, viewOn, whole } from '../lib/trains/view.js';

/** Seconds of running worked out before the first picture, so trains are already out on the line. */
const WARM_UP = 60;
/** Seconds the view takes to glide in to a train, over to another, or back out. */
const GLIDE = 0.8;
/** How near a click has to be to a train to pick it, in pixels on the screen. */
const SLACK = 12;

/** @param {import('../effects/stage.js').Stage} stage */
export default function trains(stage) {
  const { ctx } = stage;
  const canvas = ctx.canvas;
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
  /** Each track and way, worked out once for each network: its rails, its sleepers, and the box it stays inside. */
  let parts = [];
  /** The train the view follows (null: none), the view, and the glide to it: where it started and how far it's got. */
  let followed = null;
  /** @type {import('../lib/trains/view.js').View} */
  let view = { x: 0, y: 0, zoom: 1 };
  let glideFrom = view;
  let glided = GLIDE;

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

  const prepare = () => {
    const { k } = network;
    const { tie, gauge } = sizesAt(k);
    parts = [...network.tracks, ...network.paths].map((p) => {
      // A sleeper every 7 pixels, across the track.
      const sleepers = [];
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
        sleepers.push(x - nx, y - ny, x + nx, y + ny);
      }
      const xs = p.points.map((q) => q.x);
      const ys = p.points.map((q) => q.y);
      const reach = tie + 2 * k;
      return { points: p.points, rails: [offset(p.points, gauge), offset(p.points, -gauge)], sleepers, box: [Math.min(...xs) - reach, Math.min(...ys) - reach, Math.max(...xs) + reach, Math.max(...ys) + reach] };
    });
  };

  const fit = () => {
    if (network && network.width === stage.width && network.height === stage.height) return;
    network = buildNetwork(stage.width, stage.height, seed);
    traffic = startTrains(network, seed);
    for (let i = 0; i < WARM_UP / STEP; i++) traffic.step();
    before = new Map();
    prepare();
    followed = null;
    view = whole(network);
    glided = GLIDE;
  };
  fit();

  const tick = () => {
    before = new Map(traffic.trains.map((t) => [t, { route: t.route, head: t.head }]));
    traffic.step();
  };

  /** How far along its route a train's front is now, partway between its last two steps. */
  const headOf = (train) => {
    const was = before.get(train);
    return was && was.route === train.route ? was.head + (train.head - was.head) * (behind / STEP) : train.head;
  };

  /** A drop-off's building: where it stands in its yard. */
  const buildingOf = (st, k) => ({ length: st.length * 0.7, width: Math.min(st.width - 6 * k, 30 * k) });

  /** What never moves, into `g`: all of it, or only what's inside `seen` (left, top, right, bottom). */
  const drawNetwork = (g, seen) => {
    const { colors, rgba } = stage;
    const cargo = colors.lanes.slice(0, 3);
    const ground = colors.lanes[7];
    const { k } = network;
    g.fillStyle = rgba(colors.paper);
    g.fillRect(0, 0, stage.width, stage.height);
    g.fillStyle = rgba(ground);
    g.beginPath();
    g.roundRect(3, 3, stage.width - 6, stage.height - 6, 24 * k);
    g.fill();

    const shown = seen ? parts.filter(({ box: b }) => b[0] < seen[2] && b[2] > seen[0] && b[1] < seen[3] && b[3] > seen[1]) : parts;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // The beds first, then every sleeper, then every rail, so where tracks cross the rails run over the sleepers.
    g.strokeStyle = rgba(colors.rule, 0.6);
    g.lineWidth = 2 * sizesAt(k).tie + 2 * k;
    g.beginPath();
    for (const p of shown) line(g, p.points);
    g.stroke();
    g.strokeStyle = rgba(colors.muted, 0.3);
    g.lineWidth = 1.6 * k;
    g.lineCap = 'butt';
    g.beginPath();
    for (const { sleepers: s } of shown) {
      for (let i = 0; i < s.length; i += 4) {
        g.moveTo(s[i], s[i + 1]);
        g.lineTo(s[i + 2], s[i + 3]);
      }
    }
    g.stroke();
    g.strokeStyle = rgba(colors.ink, 0.55);
    g.lineWidth = 1.3 * k;
    g.lineCap = 'round';
    g.beginPath();
    for (const p of shown) {
      line(g, p.rails[0]);
      line(g, p.rails[1]);
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

  const drawStill = () => {
    still.width = ctx.canvas.width;
    still.height = ctx.canvas.height;
    const g = /** @type {CanvasRenderingContext2D} */ (still.getContext('2d'));
    const density = still.width / stage.width;
    g.setTransform(density, 0, 0, density, 0, 0);
    drawNetwork(g, null);
  };

  /** A train's engine and wagons, partway between their last two steps. */
  const drawTrain = (train, k) => {
    const { colors, rgba } = stage;
    const cargo = colors.lanes[train.colour];
    carsOf(train, headOf(train), k).forEach((car, i) => {
      const { width } = car;
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
    const zoomed = view.zoom > 1 + 1e-6;
    if (zoomed) {
      // Zoomed in: the network drawn afresh at this size, only what's in view, on the page's colour where the view
      // reaches past the network.
      const w = stage.width / 2 / view.zoom;
      const h = stage.height / 2 / view.zoom;
      ctx.fillStyle = stage.rgba(stage.colors.paper);
      ctx.fillRect(0, 0, stage.width, stage.height);
      ctx.save();
      ctx.translate(stage.width / 2, stage.height / 2);
      ctx.scale(view.zoom, view.zoom);
      ctx.translate(-view.x, -view.y);
      drawNetwork(ctx, [view.x - w, view.y - h, view.x + w, view.y + h]);
    } else {
      const key = `${ctx.canvas.width}x${ctx.canvas.height}`;
      if (key !== stillFor || stage.colors !== stillColors) {
        drawStill();
        stillFor = key;
        stillColors = stage.colors;
      }
      ctx.drawImage(still, 0, 0, stage.width, stage.height);
    }
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
    if (zoomed) ctx.restore();
  };

  // Following: a click on a train glides the view in on it, a click anywhere else (or Esc) glides back out; under
  // the mouse a train shows the pointing hand.
  /** The train under a point on the stage, if any. @param {number[]} at */
  const trainUnder = ([x, y]) => trainAt(traffic.trains, { x: view.x + (x - stage.width / 2) / view.zoom, y: view.y + (y - stage.height / 2) / view.zoom }, SLACK / view.zoom, network.k, headOf);
  /** @param {MouseEvent} e */
  const pointOf = (e) => {
    const b = canvas.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };
  const follow = (train) => {
    if (train === followed) return;
    followed = train;
    glideFrom = view;
    glided = 0;
  };
  canvas.addEventListener('click', (e) => follow(trainUnder(pointOf(e))));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !(e.target instanceof Element && e.target.closest('dialog'))) follow(null);
  });
  /** Where the mouse is over the stage (null: elsewhere, or a finger), and the pointer shown there. */
  let mouse = null;
  let cursor = '';
  canvas.addEventListener('pointermove', (e) => { mouse = e.pointerType === 'mouse' ? pointOf(e) : null; });
  canvas.addEventListener('pointerleave', () => { mouse = null; });

  // The page's buttons: Add train brings one more onto the railway, Remove train sends a parked one off it. Each greys
  // out while it can't.
  const stageRoot = canvas.closest('[data-stage]');
  const addButton = /** @type {HTMLButtonElement | null} */ (stageRoot?.querySelector('[data-control="add-train"]') ?? null);
  const removeButton = /** @type {HTMLButtonElement | null} */ (stageRoot?.querySelector('[data-control="remove-train"]') ?? null);
  addButton?.addEventListener('click', () => traffic.addTrain());
  removeButton?.addEventListener('click', () => traffic.removeTrain());

  return {
    frame(dt) {
      behind += dt;
      while (behind >= STEP) {
        tick();
        behind -= STEP;
      }
      // A train that has left the railway can't be followed.
      if (followed && !traffic.trains.includes(followed)) follow(null);
      if (addButton && addButton.disabled === traffic.canAdd()) addButton.disabled = !traffic.canAdd();
      if (removeButton && removeButton.disabled === traffic.canRemove()) removeButton.disabled = !traffic.canRemove();
      // The view: gliding, smoothly in and out, from where it was to where it's going; then there.
      const target = followed ? viewOn(network, followed, headOf(followed)) : whole(network);
      glided = Math.min(GLIDE, glided + dt);
      const t = glided / GLIDE;
      const e = t * t * (3 - 2 * t);
      view = t < 1 ? { x: glideFrom.x + (target.x - glideFrom.x) * e, y: glideFrom.y + (target.y - glideFrom.y) * e, zoom: glideFrom.zoom * (target.zoom / glideFrom.zoom) ** e } : target;
      const want = mouse && trainUnder(mouse) ? 'pointer' : '';
      if (want !== cursor) canvas.style.cursor = cursor = want;
      draw();
    },
    resize: fit,
  };
}
