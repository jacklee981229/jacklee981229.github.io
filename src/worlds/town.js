// Jack's Town on the Effects' stage (src/effects/stage.js): draws the map from src/lib/town/layout.js and the
// traffic from src/lib/town/sim.js, flat and top-down in the site's colours. What never moves (the ground, the
// roads, the buildings) is drawn once into a picture of its own and laid down each frame; the lights and
// the cars are drawn over it. The traffic moves in fixed steps and the picture is drawn between two steps, so cars
// glide at any frame rate. Over the cars, now and then a thought bubble (src/lib/town/thoughts.js) pops up and
// fades; a click on a car pops up what it's thinking of. The page's Add car and Remove car buttons bring a car in from
// outside town and send one away. At night (the dark theme, and the night sky) every stop line glows in its colour,
// as the Train World's lamps do, and the homes and places have lit windows (the cars have no headlights, at Jack's word).
// The stage brings Pause, the still picture under reduced motion, and rest while off screen. The stage's --c1 to --c4
// are the homes' colours, --c5 to --c7 the lights' go, wait and stop, and --c8 the ground.
import { BAY_DEPTH, buildTown, CAR_LENGTH, CAR_WIDTH, JUNCTION, ROAD } from '../lib/town/layout.js';
import { carPlace, lightFor, startTraffic, STEP } from '../lib/town/sim.js';
import { boxOf, CLOUD, FADE, goingSomewhere, startThoughts } from '../lib/town/thoughts.js';

/** About this many pixels from one junction to the next. */
const BLOCK_PX = 165;
/** Seconds of traffic worked out before the first picture, so the town is already busy. */
const WARM_UP = 90;
/** The thin line of page colour between a road and the ground beside it. */
const KERB = 0.014;
/** A thought cloud's puffs round its middle (x, y and radius, in blocks): a ring of them and one in the middle. */
const PUFFS = [...Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + 0.2;
  return [Math.cos(a) * 0.085, Math.sin(a) * 0.045, 0.04];
}), [0, 0, 0.055]];
/** How a cloud puffs out: past its size a little, then back. @param {number} t from 0 to 1 */
const puffOut = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
/** How near a click has to be to a car to pick it, in pixels on the screen. */
const SLACK = 10;
/** At night, in blocks: how far a stop line's glow spreads round it (about as big on the screen as a Train World lamp's,
 *  src/worlds/trains.js), and a lit window's width and its glow. */
const GLOW = 0.07;
const WINDOW = 0.028;
const WINDOW_GLOW = 0.06;

/** How bright a colour is, from 0 (black) to 1 (white). @param {number[]} rgb */
const brightness = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
/** Night: the page's colour is dark. */
const isNight = (colors) => brightness(colors.paper) < 0.3;
/** The windows' light, the Train World's at night: between the page's ink and the lights' amber. */
const warmOf = (colors) => colors.ink.map((v, i) => (v + colors.lanes[5][i]) / 2);

/** A building's windows, seen from above, in its own frame (its road along x, on the +y side): two on a home's slope
 *  towards the road, and on a place's flat roof two either side of its ring along each long edge. */
const windowsOf = (b) => (b.kind === 'home'
  ? [[-b.length / 4, b.depth / 4], [b.length / 4, b.depth / 4]]
  : [-0.35, -0.18, 0.18, 0.35].flatMap((f) => [[f * b.length, -0.3 * b.depth], [f * b.length, 0.3 * b.depth]]));

/** @param {import('../effects/stage.js').Stage} stage */
export default function town(stage) {
  const { ctx } = stage;
  const seed = Math.floor(Math.random() * 1e9);
  /** @type {ReturnType<typeof startTraffic>} */
  let world;
  /** @type {ReturnType<typeof startThoughts>} */
  let thoughts;
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
  /** A fading bubble is drawn whole onto this first and laid down see-through from it, so it fades as one picture
   *  (faded circle by circle, the outlines where they overlap would show through). */
  const layer = document.createElement('canvas');

  const fit = () => {
    const cols = Math.min(14, Math.max(3, Math.round(stage.width / BLOCK_PX)));
    const rows = Math.min(9, Math.max(2, Math.round(stage.height / BLOCK_PX)));
    if (!world || world.town.cols !== cols || world.town.rows !== rows) {
      world = startTraffic(buildTown(cols, rows, seed), seed);
      thoughts = startThoughts(world, seed);
      for (let i = 0; i < WARM_UP / STEP; i++) {
        world.step();
        thoughts.step();
      }
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
    thoughts.step();
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

  /** A building in its colour, its middle at (0, 0) and its road along x: a home with a pitched roof, or a place
   *  with a flat roof and a ring on it, where cars of its colour go. */
  const drawBuilding = (g, kind, colour, length, depth) => {
    const { colors, rgba } = stage;
    g.fillStyle = rgba(colour);
    box(g, 0, 0, 0, length, depth, kind === 'home' ? 0.018 : 0.03);
    if (kind === 'home') {
      // The roof's far slope a shade darker, and the ridge between the two slopes.
      g.fillStyle = rgba(colors.ink, 0.16);
      g.beginPath();
      g.roundRect(-length / 2, -depth / 2, length, depth / 2, [0.018, 0.018, 0, 0]);
      g.fill();
      g.fillStyle = rgba(colors.paper, 0.45);
      g.fillRect(-length / 2 + 0.012, -0.004, length - 0.024, 0.008);
    } else {
      g.fillStyle = rgba(colors.paper, 0.2);
      g.beginPath();
      g.roundRect(-length / 2 + 0.025, -depth / 2 + 0.025, length - 0.05, depth - 0.05, 0.015);
      g.fill();
      g.strokeStyle = rgba(colors.paper, 0.9);
      g.lineWidth = 0.014;
      g.beginPath();
      g.arc(0, 0, 0.032, 0, Math.PI * 2);
      g.stroke();
    }
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

    // The homes and places, their ridges and rings along their roads.
    for (const b of t.buildings) {
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.angle);
      drawBuilding(g, b.kind, homeColours[b.colour], b.length, b.depth);
      g.restore();
    }

    // At night, their windows lit: a soft glow round each, added to the light already there, then the window in a
    // dark frame, so it stands out on the pale roofs.
    if (isNight(colors)) {
      const light = warmOf(colors);
      const frame = WINDOW * 0.22;
      for (const b of t.buildings) {
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.angle);
        g.globalCompositeOperation = 'lighter';
        for (const [x, y] of windowsOf(b)) {
          const glow = g.createRadialGradient(x, y, 0, x, y, WINDOW_GLOW);
          glow.addColorStop(0, rgba(light, 0.3));
          glow.addColorStop(1, rgba(light, 0));
          g.fillStyle = glow;
          g.fillRect(x - WINDOW_GLOW, y - WINDOW_GLOW, 2 * WINDOW_GLOW, 2 * WINDOW_GLOW);
        }
        g.globalCompositeOperation = 'source-over';
        for (const [x, y] of windowsOf(b)) {
          g.fillStyle = rgba(colors.paper, 0.6);
          g.fillRect(x - WINDOW / 2 - frame, y - WINDOW * 0.36 - frame, WINDOW + 2 * frame, WINDOW * 0.72 + 2 * frame);
          g.fillStyle = rgba(light);
          g.fillRect(x - WINDOW / 2, y - WINDOW * 0.36, WINDOW, WINDOW * 0.72);
        }
        g.restore();
      }
    }
  };

  /** Where a lane's stop line runs: across the lane, just short of the junction. */
  const stopLine = (lane) => {
    const side = { x: lane.dir.y, y: -lane.dir.x };
    const end = { x: lane.end.x - lane.dir.x * 0.012, y: lane.end.y - lane.dir.y * 0.012 };
    return { from: { x: end.x - side.x * 0.04, y: end.y - side.y * 0.04 }, to: { x: end.x + side.x * 0.035, y: end.y + side.y * 0.035 } };
  };

  /** At night, each light colour's glow, drawn once onto a little picture of its own (a soft round light, brightest in
   *  the middle) and laid over every stop line showing that colour; made again when the colours change. */
  let glows = null;
  let glowsFor = null;
  const glowsOf = (lamps) => {
    if (glowsFor !== stage.colors) {
      glows = Object.fromEntries(Object.entries(lamps).map(([state, rgb]) => {
        const picture = document.createElement('canvas');
        picture.width = picture.height = 64;
        const g = /** @type {CanvasRenderingContext2D} */ (picture.getContext('2d'));
        const light = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        light.addColorStop(0, stage.rgba(rgb, 0.55));
        light.addColorStop(1, stage.rgba(rgb, 0));
        g.fillStyle = light;
        g.fillRect(0, 0, 64, 64);
        return [state, picture];
      }));
      glowsFor = stage.colors;
    }
    return glows;
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

  /** What a car is thinking of, inside its cloud, around (0, 0): a tiny copy of the place or home it's heading to,
   *  a suitcase when it's leaving town, or the comic anger mark in the stop lights' red. */
  const drawThought = (g, bubble) => {
    const { colors, rgba } = stage;
    if (bubble.kind === 'place' || bubble.kind === 'home') {
      const b = bubble.car.to.building;
      const fit = Math.min(0.19 / b.length, 0.1 / b.depth, 0.8);
      g.scale(fit, fit);
      drawBuilding(g, b.kind, colors.lanes[bubble.colour], b.length, b.depth);
    } else if (bubble.kind === 'away') {
      // Bye-bye: a hand in the lights' amber, waving from the wrist, with two lines for the wave.
      g.strokeStyle = rgba(colors.ink, 0.45);
      g.lineWidth = 0.008;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(0.012, 0.02, 0.06, -1.25, -0.75);
      g.moveTo(0.012 + Math.cos(-1.3) * 0.075, 0.02 + Math.sin(-1.3) * 0.075);
      g.arc(0.012, 0.02, 0.075, -1.3, -0.7);
      g.stroke();
      g.translate(-0.012, 0.042);
      g.rotate(0.35 * Math.sin(world.time * 9));
      g.fillStyle = rgba(colors.lanes[5]);
      g.beginPath();
      g.roundRect(-0.024, -0.04, 0.048, 0.042, 0.014);
      for (const [x, tip] of [[-0.024, -0.072], [-0.011, -0.08], [0.002, -0.078], [0.015, -0.068]]) g.roundRect(x, tip, 0.011, -0.03 - tip, 0.0055);
      g.fill();
      g.save();
      g.translate(-0.022, -0.022);
      g.rotate(-0.8);
      g.beginPath();
      g.roundRect(-0.006, -0.03, 0.012, 0.03, 0.006);
      g.fill();
      g.restore();
    } else {
      g.strokeStyle = rgba(colors.lanes[6]);
      g.lineWidth = 0.017;
      g.lineCap = 'round';
      for (const [x, y] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        g.beginPath();
        g.moveTo(x * 0.014, y * 0.05);
        g.quadraticCurveTo(x * 0.01, y * 0.01, x * 0.05, y * 0.014);
        g.stroke();
      }
    }
  };

  /** A thought bubble into `g`, by its car (at `place`) at town time `now`: the small circle, then the middle one,
   *  then the cloud puffs out. Page-coloured, with a thin outline and a soft shadow. */
  const drawBubble = (g, bubble, place, now) => {
    const { colors, rgba } = stage;
    const age = now - bubble.from;
    const grown = (from, over) => Math.max(0, Math.min(1, (age - from) / over));
    const cloud = puffOut(grown(0.3, 0.25));
    const x = place.x + CLOUD.dx * bubble.flip.x;
    const y = place.y + CLOUD.dy * bubble.flip.y;
    const toward = (t) => ({ x: place.x + (x - place.x) * t, y: place.y + (y - place.y) * t });
    const circles = [[toward(0.32), 0.013 * grown(0, 0.12)], [toward(0.55), 0.021 * grown(0.15, 0.12)], ...PUFFS.map(([px, py, r]) => [{ x: x + px * cloud, y: y + py * cloud }, r * cloud])].filter(([, r]) => r > 0);
    const shape = (dx, dy) => {
      g.beginPath();
      for (const [c, r] of circles) {
        g.moveTo(c.x + dx + r, c.y + dy);
        g.arc(c.x + dx, c.y + dy, r, 0, Math.PI * 2);
      }
    };
    g.save();
    g.fillStyle = rgba(colors.ink, 0.14);
    shape(0.006, 0.01);
    g.fill();
    // The outline drawn round every circle, then the circles filled over it, leaves only the cloud's own edge.
    g.strokeStyle = rgba(colors.ink, 0.4);
    g.lineWidth = 0.012;
    shape(0, 0);
    g.stroke();
    g.fillStyle = rgba(colors.paper);
    g.fill();
    if (cloud > 0) {
      g.translate(x, y);
      g.scale(cloud, cloud);
      drawThought(g, bubble);
    }
    g.restore();
  };

  /** A bubble on its way out: drawn whole onto the layer, around its box, then laid down `alpha` see-through. */
  const drawFading = (bubble, place, now, alpha) => {
    if (layer.width !== ctx.canvas.width || layer.height !== ctx.canvas.height) {
      layer.width = ctx.canvas.width;
      layer.height = ctx.canvas.height;
    }
    const m = ctx.getTransform();
    const b = boxOf(bubble, place);
    const x0 = Math.max(0, Math.floor(m.a * (b.left - 0.03) + m.e));
    const y0 = Math.max(0, Math.floor(m.d * (b.top - 0.03) + m.f));
    const x1 = Math.min(layer.width, Math.ceil(m.a * (b.right + 0.03) + m.e));
    const y1 = Math.min(layer.height, Math.ceil(m.d * (b.bottom + 0.03) + m.f));
    if (x1 <= x0 || y1 <= y0) return;
    const g = /** @type {CanvasRenderingContext2D} */ (layer.getContext('2d'));
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(x0, y0, x1 - x0, y1 - y0);
    g.setTransform(m);
    drawBubble(g, bubble, place, now);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(layer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  };

  /** Where each car in town was drawn last, for clicks and the pointer. */
  let drawn = new Map();

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
    const lamps = { go, wait, stop };
    ctx.save();
    ctx.translate(left, top);
    ctx.scale(scale, scale);

    // At night, the stop lines' glow, added to the light already there, under the lights and the cars.
    if (isNight(colors)) {
      const glow = glowsOf(lamps);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const lane of world.town.lanes) {
        const state = lightFor(lane);
        if (!state) continue;
        const { from, to } = stopLine(lane);
        ctx.drawImage(glow[state], (from.x + to.x) / 2 - GLOW, (from.y + to.y) / 2 - GLOW, 2 * GLOW, 2 * GLOW);
      }
      ctx.restore();
    }

    // The lights: a line across each lane at its stop line, in the colour it's showing.
    ctx.lineWidth = 0.02;
    ctx.lineCap = 'round';
    for (const lane of world.town.lanes) {
      const state = lightFor(lane);
      if (!state) continue;
      const { from, to } = stopLine(lane);
      ctx.strokeStyle = rgba(lamps[state]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    // The cars in town, partway between their last two steps: parked ones first, so moving ones pass over them.
    const cars = world.cars.filter((c) => c.mode !== 'away').sort((a, b) => Number(a.mode !== 'parked') - Number(b.mode !== 'parked'));
    const places = new Map();
    for (const car of cars) {
      const now = carPlace(car);
      const was = before.get(car) ?? now;
      let turn = now.angle - was.angle;
      if (turn > Math.PI) turn -= Math.PI * 2;
      if (turn < -Math.PI) turn += Math.PI * 2;
      const place = { x: was.x + (now.x - was.x) * k, y: was.y + (now.y - was.y) * k, angle: was.angle + turn * k };
      places.set(car, place);
      drawCar(car, place);
    }
    drawn = places;
    // The thought bubbles over them all, at the time between the two steps; at the end each fades.
    const now = world.time - STEP * (1 - k);
    for (const bubble of thoughts.bubbles) {
      const place = places.get(bubble.car);
      if (!place) continue;
      const alpha = Math.min(1, (bubble.until - now) / FADE);
      if (alpha >= 1) drawBubble(ctx, bubble, place, now);
      else if (alpha > 0) drawFading(bubble, place, now, alpha);
    }
    ctx.restore();
  };

  // A click on a car that's going somewhere pops up what it's thinking of; under the mouse such a car shows the
  // pointing hand.
  const canvas = ctx.canvas;
  /** The car going somewhere nearest a point on the stage, if it's within reach of the point. @param {number[]} at */
  const carAt = ([x, y]) => {
    const p = { x: (x - left) / scale, y: (y - top) / scale };
    let best = null;
    let nearest = SLACK / scale;
    for (const [car, place] of drawn) {
      if (!goingSomewhere(car)) continue;
      const dx = p.x - place.x;
      const dy = p.y - place.y;
      const along = Math.abs(dx * Math.cos(place.angle) + dy * Math.sin(place.angle)) - CAR_LENGTH / 2;
      const across = Math.abs(-dx * Math.sin(place.angle) + dy * Math.cos(place.angle)) - CAR_WIDTH / 2;
      const off = Math.hypot(Math.max(0, along), Math.max(0, across));
      if (off <= nearest) {
        nearest = off;
        best = car;
      }
    }
    return best;
  };
  /** @param {MouseEvent} e */
  const pointOf = (e) => {
    const b = canvas.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };
  canvas.addEventListener('click', (e) => {
    const car = carAt(pointOf(e));
    if (car) thoughts.think(car);
  });
  let mouse = null;
  let cursor = '';
  canvas.addEventListener('pointermove', (e) => { mouse = e.pointerType === 'mouse' ? pointOf(e) : null; });
  canvas.addEventListener('pointerleave', () => { mouse = null; });

  // The page's buttons: Add car brings one in from outside town; Remove car sends a parked car away for good, and it
  // says bye-bye. Each is greyed out while it can't.
  const stageRoot = canvas.closest('[data-stage]');
  const addButton = /** @type {HTMLButtonElement | null} */ (stageRoot?.querySelector('[data-control="add-car"]') ?? null);
  const removeButton = /** @type {HTMLButtonElement | null} */ (stageRoot?.querySelector('[data-control="remove-car"]') ?? null);
  addButton?.addEventListener('click', () => world.addCar());
  removeButton?.addEventListener('click', () => {
    const car = world.removeCar();
    if (car) thoughts.think(car);
  });

  return {
    frame(dt) {
      behind += dt;
      while (behind >= STEP) {
        tick();
        behind -= STEP;
      }
      draw(behind / STEP);
      const want = mouse && carAt(mouse) ? 'pointer' : '';
      if (want !== cursor) canvas.style.cursor = cursor = want;
      if (addButton && addButton.disabled === world.canAdd()) addButton.disabled = !world.canAdd();
      if (removeButton && removeButton.disabled === world.canRemove()) removeButton.disabled = !world.canRemove();
    },
    resize: fit,
  };
}
