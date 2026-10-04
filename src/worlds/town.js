// Jack's Town on the Effects' stage (src/effects/stage.js): draws the map from src/lib/town/layout.js and the
// traffic from src/lib/town/sim.js, flat and top-down in the site's colours. What never moves (the ground, the
// roads, the buildings) is drawn once into a picture of its own and laid down each frame; the lights and
// the cars are drawn over it. The traffic moves in fixed steps and the picture is drawn between two steps, so cars
// glide at any frame rate. The stage brings Pause, the still picture under reduced motion, and rest while off
// screen. The stage's --c1 to --c4 are the homes' colours, --c5 to --c7 the lights' go, wait and stop, and --c8 the
// ground.
import { BAY_DEPTH, buildTown, CAR_LENGTH, CAR_WIDTH, JUNCTION, ROAD } from '../lib/town/layout.js';
import { carPlace, lightFor, startTraffic, STEP } from '../lib/town/sim.js';

/** About this many pixels from one junction to the next. */
const BLOCK_PX = 165;
/** Seconds of traffic worked out before the first picture, so the town is already busy. */
const WARM_UP = 90;
/** The thin line of page colour between a road and the ground beside it. */
const KERB = 0.014;

/** @param {import('../effects/stage.js').Stage} stage */
export default function town(stage) {
  const { ctx } = stage;
  const seed = Math.floor(Math.random() * 1e9);
  /** @type {ReturnType<typeof startTraffic>} */
  let world;
  let scale = 1;
  let left = 0;
  let top = 0;
  let behind = 0;
  /** Each car's place one step ago, so a picture between steps can put it partway. */
  let before = new Map();
  /** The picture of what never moves, and the size and colours it was drawn for (the stage swaps in new colours
   *  when the theme changes). */
  const still = document.createElement('canvas');
  let stillFor = '';
  let stillColors = null;

  const fit = () => {
    const cols = Math.min(14, Math.max(3, Math.round(stage.width / BLOCK_PX)));
    const rows = Math.min(9, Math.max(2, Math.round(stage.height / BLOCK_PX)));
    if (!world || world.town.cols !== cols || world.town.rows !== rows) {
      world = startTraffic(buildTown(cols, rows, seed), seed);
      for (let i = 0; i < WARM_UP / STEP; i++) world.step();
      before = new Map();
    }
    scale = Math.min(stage.width / cols, stage.height / rows);
    left = (stage.width - cols * scale) / 2;
    top = (stage.height - rows * scale) / 2;
  };
  fit();

  const tick = () => {
    before = new Map(world.cars.filter((c) => c.mode !== 'away').map((c) => [c, carPlace(c)]));
    world.step();
  };

  /** A box `length` by `width` around (x, y), turned to `angle`, with round corners. */
  const box = (g, x, y, angle, length, width, r) => {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.beginPath();
    g.roundRect(-length / 2, -width / 2, length, width, r);
    g.fill();
    g.restore();
  };

  /** Everything that never moves, into `still`, in the colours of the moment. */
  const drawStill = () => {
    const { colors, rgba } = stage;
    const homeColours = colors.lanes.slice(0, 4);
    const ground = colors.lanes[7];
    const t = world.town;
    still.width = ctx.canvas.width;
    still.height = ctx.canvas.height;
    const g = /** @type {CanvasRenderingContext2D} */ (still.getContext('2d'));
    const density = still.width / stage.width;
    g.setTransform(density, 0, 0, density, 0, 0);
    g.fillStyle = rgba(colors.paper);
    g.fillRect(0, 0, stage.width, stage.height);
    g.translate(left, top);
    g.scale(scale, scale);

    // The ground: the town's blocks, as one rounded piece the roads are laid over.
    g.fillStyle = rgba(ground);
    g.beginPath();
    g.roundRect(0.02, 0.02, t.cols - 0.04, t.rows - 0.04, 0.24);
    g.fill();

    // Roads and the bays' paving: first a little wider in the page's colour, which leaves a kerb line around them,
    // then the road itself.
    const sideOf = (b) => ({ x: Math.sin(b.angle), y: -Math.cos(b.angle) });
    const pavings = t.buildings.map((b) => ({ x: b.paving.x + sideOf(b).x * BAY_DEPTH / 2, y: b.paving.y + sideOf(b).y * BAY_DEPTH / 2, angle: b.angle, length: b.paving.length }));
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [colour, extra] of [[colors.paper, KERB], [colors.rule, 0]]) {
      g.strokeStyle = rgba(colour);
      g.fillStyle = rgba(colour);
      g.lineWidth = 2 * (ROAD + extra);
      g.beginPath();
      for (const [a, b] of t.roads) {
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
      }
      // The roads out of town run on past the edge of the picture.
      for (const gate of t.gates) {
        g.moveTo(gate.at.x, gate.at.y);
        g.lineTo(gate.at.x + gate.dir.x * 20, gate.at.y + gate.dir.y * 20);
      }
      g.stroke();
      for (const p of pavings) box(g, p.x, p.y, p.angle, p.length + 2 * extra, BAY_DEPTH + 2 * extra, 0.03 + extra);
    }
    // Lines between a place's bays, and a dashed line down the middle of each road between its junctions.
    g.strokeStyle = rgba(colors.paper, 0.75);
    g.lineWidth = 0.008;
    g.beginPath();
    for (const b of t.buildings) {
      if (b.kind !== 'place') continue;
      const side = sideOf(b);
      for (let i = 0; i < b.bays.length - 1; i++) {
        const s = (b.bays[i].s + b.bays[i + 1].s) / 2 - b.bays[1].s;
        const at = { x: b.paving.x + Math.cos(b.angle) * s, y: b.paving.y + Math.sin(b.angle) * s };
        g.moveTo(at.x + side.x * 0.03, at.y + side.y * 0.03);
        g.lineTo(at.x + side.x * (BAY_DEPTH - 0.02), at.y + side.y * (BAY_DEPTH - 0.02));
      }
    }
    g.stroke();
    g.setLineDash([0.035, 0.045]);
    g.beginPath();
    for (const [a, b] of t.roads) {
      const d = { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) };
      g.moveTo(a.x + d.x * JUNCTION, a.y + d.y * JUNCTION);
      g.lineTo(b.x - d.x * JUNCTION, b.y - d.y * JUNCTION);
    }
    for (const gate of t.gates) {
      g.moveTo(gate.at.x + gate.dir.x * JUNCTION, gate.at.y + gate.dir.y * JUNCTION);
      g.lineTo(gate.at.x + gate.dir.x * 20, gate.at.y + gate.dir.y * 20);
    }
    g.stroke();
    g.setLineDash([]);

    // Homes: a house with a pitched roof, its ridge along the road. Places: a wider building with a flat roof and
    // a ring on it, where cars of its colour go.
    for (const b of t.buildings) {
      g.fillStyle = rgba(homeColours[b.colour]);
      box(g, b.x, b.y, b.angle, b.length, b.depth, b.kind === 'home' ? 0.018 : 0.03);
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.angle);
      if (b.kind === 'home') {
        // The roof's far slope a shade darker, and the ridge between the two slopes.
        g.fillStyle = rgba(colors.ink, 0.16);
        g.beginPath();
        g.roundRect(-b.length / 2, -b.depth / 2, b.length, b.depth / 2, [0.018, 0.018, 0, 0]);
        g.fill();
        g.fillStyle = rgba(colors.paper, 0.45);
        g.fillRect(-b.length / 2 + 0.012, -0.004, b.length - 0.024, 0.008);
      } else {
        g.fillStyle = rgba(colors.paper, 0.2);
        g.beginPath();
        g.roundRect(-b.length / 2 + 0.025, -b.depth / 2 + 0.025, b.length - 0.05, b.depth - 0.05, 0.015);
        g.fill();
        g.strokeStyle = rgba(colors.paper, 0.9);
        g.lineWidth = 0.014;
        g.beginPath();
        g.arc(0, 0, 0.032, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }
  };

  /** One car, its middle and facing in `place`. */
  const drawCar = (car, place) => {
    const { colors, rgba } = stage;
    const [wait, stop] = [colors.lanes[5], colors.lanes[6]];
    const L = CAR_LENGTH;
    const W = CAR_WIDTH;
    ctx.save();
    ctx.translate(place.x, place.y);
    ctx.rotate(place.angle);
    // A soft shadow lifts it off the road.
    ctx.fillStyle = rgba(colors.ink, 0.14);
    ctx.beginPath();
    ctx.roundRect(-L / 2 + 0.006, -W / 2 + 0.01, L, W, 0.022);
    ctx.fill();
    ctx.fillStyle = rgba(colors.lanes[car.colour]);
    ctx.beginPath();
    ctx.roundRect(-L / 2, -W / 2, L, W, 0.022);
    ctx.fill();
    // Front and back windows.
    ctx.fillStyle = rgba(colors.paper, 0.62);
    ctx.beginPath();
    ctx.roundRect(L * 0.06, -W * 0.34, L * 0.16, W * 0.68, 0.008);
    ctx.fill();
    ctx.fillStyle = rgba(colors.paper, 0.32);
    ctx.beginPath();
    ctx.roundRect(-L * 0.36, -W * 0.3, L * 0.12, W * 0.6, 0.006);
    ctx.fill();
    // The lights at the back: red while braking or standing in traffic, white while backing out.
    const lights = car.mode === 'backing' ? rgba(colors.paper, 0.95) : car.mode === 'driving' && car.braking ? rgba(stop) : null;
    if (lights) {
      ctx.fillStyle = lights;
      for (const y of [-W / 2 + 0.006, W / 2 - 0.018]) ctx.fillRect(-L / 2, y, 0.012, 0.012);
    }
    // Indicators, blinking at the front and back on the side it's turning to.
    if (car.mode === 'driving' && car.signal && Math.floor(world.time * 3) % 2 === 0) {
      ctx.fillStyle = rgba(wait);
      const y = car.signal < 0 ? -W / 2 : W / 2 - 0.012;
      ctx.fillRect(L / 2 - 0.014, y, 0.014, 0.012);
      ctx.fillRect(-L / 2, y, 0.014, 0.012);
    }
    ctx.restore();
  };

  const draw = (k) => {
    const key = `${ctx.canvas.width}x${ctx.canvas.height}:${world.town.cols}x${world.town.rows}`;
    if (key !== stillFor || stage.colors !== stillColors) {
      drawStill();
      stillFor = key;
      stillColors = stage.colors;
    }
    ctx.drawImage(still, 0, 0, stage.width, stage.height);
    const { colors, rgba } = stage;
    const [go, wait, stop] = colors.lanes.slice(4, 7);
    ctx.save();
    ctx.translate(left, top);
    ctx.scale(scale, scale);

    // The lights: a line across each lane at its stop line, in the colour it's showing.
    ctx.lineWidth = 0.02;
    ctx.lineCap = 'round';
    for (const lane of world.town.lanes) {
      const state = lightFor(lane, world.time);
      if (!state) continue;
      const side = { x: lane.dir.y, y: -lane.dir.x };
      const end = { x: lane.end.x - lane.dir.x * 0.012, y: lane.end.y - lane.dir.y * 0.012 };
      ctx.strokeStyle = rgba(state === 'go' ? go : state === 'wait' ? wait : stop);
      ctx.beginPath();
      ctx.moveTo(end.x - side.x * 0.04, end.y - side.y * 0.04);
      ctx.lineTo(end.x + side.x * 0.035, end.y + side.y * 0.035);
      ctx.stroke();
    }

    // The cars in town, partway between their last two steps: parked ones first, so moving ones pass over them.
    const cars = world.cars.filter((c) => c.mode !== 'away').sort((a, b) => Number(a.mode !== 'parked') - Number(b.mode !== 'parked'));
    for (const car of cars) {
      const now = carPlace(car);
      const was = before.get(car) ?? now;
      let turn = now.angle - was.angle;
      if (turn > Math.PI) turn -= Math.PI * 2;
      if (turn < -Math.PI) turn += Math.PI * 2;
      drawCar(car, { x: was.x + (now.x - was.x) * k, y: was.y + (now.y - was.y) * k, angle: was.angle + turn * k });
    }
    ctx.restore();
  };

  return {
    frame(dt) {
      behind += dt;
      while (behind >= STEP) {
        tick();
        behind -= STEP;
      }
      draw(behind / STEP);
    },
    resize: fit,
  };
}
