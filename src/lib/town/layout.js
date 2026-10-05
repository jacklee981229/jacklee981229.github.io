// Jack's Town's map (D58 to D63 in docs/plan/todo/little-worlds-town.md): a grid of two-way roads that fits the
// window, with a few stretches left out so it isn't a plain grid, lanes on the left (as in Malaysia), the paths
// cars take across each junction and which of them cross, traffic lights where three or four roads meet, homes and
// places beside the roads with their parking bays and the way in and out of each bay, and the roads out of town,
// where cars come and go. Everything is in blocks: one block is the distance between two junctions. sim.js runs the traffic on it;
// src/worlds/town.js draws it. Tested by tests/town.test.js.

/** Half the width of a junction: lanes end this far from its centre. */
export const JUNCTION = 0.16;
/** How far a lane's middle is from the road's middle. */
export const LANE = 0.055;
/** Half the width of a road: its kerb is this far from its middle. */
export const ROAD = 0.105;
/** A car's length and width. */
export const CAR_LENGTH = 0.12;
export const CAR_WIDTH = 0.06;
/** A parking bay's width along the road, and how deep its paving goes in from the kerb. */
export const BAY_WIDTH = 0.09;
export const BAY_DEPTH = 0.16;
/** A car turns into a bay starting this far before it, and backs out to this far before it. */
export const TURN_IN = 0.12;
export const BACK_OUT = 0.13;
/** Where a parked car's front is: this far from the road's middle (it parks nose in, a little in from the kerb). */
const PARKED_FRONT = ROAD + 0.02 + CAR_LENGTH;
/** Where the bays are along a lane (from its start): one for a home, three side by side for a place. */
const HOME_BAY = 0.44;
const PLACE_BAYS = [0.3, 0.41, 0.52];
/** The homes' and places' colours: how many there are. */
export const COLOURS = 4;
/** Places: two in each colour. */
const PLACES = 2 * COLOURS;
/** How far a road out of town runs from its junction: well past the map's edge, so cars come and go out of sight. */
const OUT = 2;
/** Two turning paths closer than this anywhere can't be used at once. */
const CLEAR = 0.105;
/** Of the roads a grid could have, about this share is left out. */
const LEFT_OUT = 0.18;

/** A small, fast random number source that gives the same numbers for the same seed. @param {number} seed */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ id: number, x: number, y: number, lanesIn: Lane[], light: null | { offset: number, axis?: 'h' | 'v', phase?: 'green' | 'amber' | 'clear', since?: number } }} Junction
 * A junction with a light: `offset` sets which road it starts green for; sim.js keeps what it shows (`axis`, `phase`
 * and `since`).
 * @typedef {{ id: number, kind: 'lane', from: Junction, to: Junction, dir: Point, axis: 'h' | 'v', start: Point, end: Point, len: number, out: Path[], into: Path[], cars: any[] }} Lane
 * @typedef {{ id: number, kind: 'path', at: Junction, from: Lane, to: Lane, turn: boolean, side: number, points: Point[], lengths: number[], len: number, crosses: Path[], cars: any[] }} Path
 * `side` is the way a path turns: -1 left, 1 right, 0 straight on.
 * @typedef {{ kind: 'bay', points: Point[], lengths: number[], len: number }} Track
 * @typedef {{ building: Building, lane: Lane, s: number, x: number, y: number, angle: number, in: Track, out: Track, car: any, coming: any }} Bay
 * A bay sits on the kerb side of `lane`, its middle `s` along it. `x`, `y` and `angle` are a parked car's middle
 * and the way it faces (nose in). `in` is the way a car's front goes from the lane into the bay; `out` the way it
 * goes, backing out, from the bay to the lane. `car` is the car parked there, `coming` the one on its way.
 * @typedef {{ kind: 'home' | 'place', colour: number, lane: Lane, x: number, y: number, angle: number, length: number, depth: number, bays: Bay[], paving: { x: number, y: number, length: number } }} Building
 * A building is a box `length` along its road and `depth` across, facing its road (`angle` is the road's direction).
 * `paving` is the middle of its bays' paving at the kerb, and how long it is along the road.
 * @typedef {{ at: Junction, end: Junction, dir: Point, in: Lane, out: Lane }} Gate
 * A road out of town: from the junction `at`, along `dir`, to `end` past the map's edge. Cars come in on `in` and
 * leave on `out`.
 * @typedef {{ cols: number, rows: number, junctions: Junction[], roads: [Junction, Junction][], gates: Gate[], lanes: Lane[], paths: Path[], buildings: Building[], next: Map<Lane, Map<Lane, Lane>> }} Town
 * `roads` are the town's own; the roads out are in `gates`.
 */

const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Every lane reachable from every other without a U-turn: then any trip can be driven. */
function allReachable(roads) {
  const lanes = roads.flatMap(([a, b]) => [[a, b], [b, a]]);
  if (!lanes.length) return false;
  const leaving = new Map();
  lanes.forEach(([a], i) => leaving.set(a, [...(leaving.get(a) ?? []), i]));
  const onward = lanes.map(([a, b]) => (leaving.get(b) ?? []).filter((j) => lanes[j][1] !== a));
  const back = lanes.map(() => []);
  onward.forEach((list, i) => list.forEach((j) => back[j].push(i)));
  const reach = (links) => {
    const seen = new Set([0]);
    const todo = [0];
    while (todo.length) for (const j of links[todo.pop()]) if (!seen.has(j)) seen.add(j), todo.push(j);
    return seen.size === lanes.length;
  };
  return reach(onward) && reach(back);
}

/** Where two lines meet: through `a` along `da`, and through `b` along `db`. */
function meet(a, da, b, db) {
  const cross = da.x * db.y - da.y * db.x;
  const t = ((b.x - a.x) * db.y - (b.y - a.y) * db.x) / cross;
  return add(a, da, t);
}

/** Points along a smooth curve from `a` to `d`, leaving `a` towards `b` and arriving at `d` from `c`. */
function curve(a, b, c, d, steps = 16) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    points.push({ x: k[0] * a.x + k[1] * b.x + k[2] * c.x + k[3] * d.x, y: k[0] * a.y + k[1] * b.y + k[2] * c.y + k[3] * d.y });
  }
  return points;
}

/** A line of points with the distance to each, for finding a point partway along. @param {Point[]} points */
function measured(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + dist(points[i - 1], points[i]));
  return { points, lengths, len: lengths[lengths.length - 1] };
}

/** The path across a junction from the end of one lane to the start of the next: straight, or a smooth curve. */
function pathPoints(from, to) {
  if (from.dir.x === to.dir.x && from.dir.y === to.dir.y) return Array.from({ length: 9 }, (_, i) => add(from.end, { x: to.start.x - from.end.x, y: to.start.y - from.end.y }, i / 8));
  const c = meet(from.end, from.dir, to.start, to.dir);
  // Close to a quarter of a circle: both handles a little over half way to the corner.
  return curve(from.end, add(from.end, { x: c.x - from.end.x, y: c.y - from.end.y }, 0.55), add(to.start, { x: c.x - to.start.x, y: c.y - to.start.y }, 0.55), to.start);
}

/** The smallest distance between two paths' points. */
function nearest(a, b) {
  let best = Infinity;
  for (const p of a.points) for (const q of b.points) best = Math.min(best, dist(p, q));
  return best;
}

/**
 * A town `cols` blocks wide and `rows` blocks high, the same every time for the same seed.
 * @param {number} cols @param {number} rows @param {number} seed
 * @returns {Town}
 */
export function buildTown(cols, rows, seed) {
  const random = seeded(seed);
  /** @type {Junction[]} */
  const junctions = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) junctions.push({ id: junctions.length, x: x + 0.5, y: y + 0.5, lanesIn: [], light: null });
  const at = (x, y) => junctions[y * cols + x];

  /** @type {[Junction, Junction][]} */
  let roads = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (x < cols - 1) roads.push([at(x, y), at(x + 1, y)]);
    if (y < rows - 1) roads.push([at(x, y), at(x, y + 1)]);
  }

  // Leave some roads out, in a shuffled order, as long as no junction is left a dead end and every trip can still
  // be driven.
  const order = roads.map((r) => [random(), r]).sort((a, b) => a[0] - b[0]).map(([, r]) => r);
  const degree = new Map(junctions.map((j) => [j, 0]));
  for (const [a, b] of roads) degree.set(a, degree.get(a) + 1), degree.set(b, degree.get(b) + 1);
  let leaveOut = Math.round(roads.length * LEFT_OUT);
  for (const road of order) {
    if (!leaveOut) break;
    const [a, b] = road;
    if (degree.get(a) <= 2 || degree.get(b) <= 2) continue;
    const without = roads.filter((r) => r !== road);
    if (!allReachable(without)) continue;
    roads = without;
    degree.set(a, degree.get(a) - 1);
    degree.set(b, degree.get(b) - 1);
    leaveOut--;
  }

  // Roads out of town, one to three, each on its own side: from a junction on the edge (not a corner, where the side
  // is long enough) straight out past the map's edge.
  const sides = [
    { dir: { x: -1, y: 0 }, edge: junctions.filter((j) => j.x === 0.5) },
    { dir: { x: 1, y: 0 }, edge: junctions.filter((j) => j.x === cols - 0.5) },
    { dir: { x: 0, y: -1 }, edge: junctions.filter((j) => j.y === 0.5) },
    { dir: { x: 0, y: 1 }, edge: junctions.filter((j) => j.y === rows - 0.5) },
  ].map((side) => [random(), side]).sort((a, b) => a[0] - b[0]).map(([, side]) => side);
  /** @type {[Junction, Junction, Point][]} */
  const outward = sides.slice(0, Math.max(1, Math.min(3, Math.round((cols + rows) / 5)))).map(({ dir, edge }) => {
    const middle = edge.length > 2 ? edge.slice(1, -1) : edge;
    const j = middle[Math.floor(random() * middle.length)];
    return [j, { id: -1, x: j.x + dir.x * OUT, y: j.y + dir.y * OUT, lanesIn: [], light: null }, dir];
  });

  // Two lanes a road, each on the left of its direction of travel.
  /** @type {Lane[]} */
  const lanes = [];
  for (const [a, b] of [...roads, ...outward]) {
    for (const [from, to] of [[a, b], [b, a]]) {
      const dir = { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
      const left = { x: dir.y, y: -dir.x };
      const start = add(add(from, dir, JUNCTION), left, LANE);
      const end = add(add(to, dir, -JUNCTION), left, LANE);
      const lane = { id: lanes.length, kind: /** @type {const} */ ('lane'), from, to, dir, axis: /** @type {'h' | 'v'} */ (dir.x ? 'h' : 'v'), start, end, len: dist(start, end), out: [], into: [], cars: [] };
      lanes.push(lane);
      to.lanesIn.push(lane);
    }
  }

  // The paths across each junction: from every lane in to every lane out, except straight back.
  /** @type {Path[]} */
  const paths = [];
  for (const from of lanes) {
    for (const to of lanes) {
      if (to.from !== from.to || to.to === from.from) continue;
      const cross = from.dir.x * to.dir.y - from.dir.y * to.dir.x;
      const path = { id: paths.length, kind: /** @type {const} */ ('path'), at: from.to, from, to, turn: cross !== 0, side: Math.sign(cross), ...measured(pathPoints(from, to)), crosses: [], cars: [] };
      paths.push(path);
      from.out.push(path);
      to.into.push(path);
    }
  }
  // Which paths can't be used together: one lane in, one lane out, or too close anywhere.
  for (const a of paths) {
    for (const b of paths) {
      if (a === b || a.at !== b.at) continue;
      if (a.from === b.from || a.to === b.to || nearest(a, b) < CLEAR) a.crosses.push(b);
    }
  }

  /** @type {Gate[]} */
  const gates = outward.map(([at, end, dir]) => ({ at, end, dir, in: lanes.find((l) => l.from === end), out: lanes.find((l) => l.to === end) }));
  const outOfTown = new Set(gates.flatMap((g) => [g.in, g.out]));

  // Traffic lights where three or four roads meet, each starting its turn at its own moment.
  for (const j of junctions) if (j.lanesIn.length >= 3) j.light = { offset: random() * 1000 };

  // Each lane in town has room on its kerb side for one building. Eight are places, two in each of the four
  // colours, with three bays each; as many as half the roads are homes, in any colour, each with one bay for its car.
  const frontages = lanes.filter((l) => !outOfTown.has(l)).map((l) => [random(), l]).sort((a, b) => a[0] - b[0]).map(([, l]) => l);
  const homes = Math.max(6, Math.round(roads.length * 0.5));
  /** @type {Building[]} */
  const buildings = [];
  frontages.slice(0, PLACES + homes).forEach((lane, i) => {
    const place = i < PLACES;
    const left = { x: lane.dir.y, y: -lane.dir.x };
    const angle = Math.atan2(lane.dir.y, lane.dir.x);
    // A point `s` along the lane, `off` from the road's middle towards the kerb.
    const spot = (s, off) => add(add(lane.start, lane.dir, s), left, off - LANE);
    /** @type {Building} */
    const building = place
      ? { kind: 'place', colour: i % COLOURS, lane, angle, ...spot(PLACE_BAYS[1], ROAD + BAY_DEPTH + 0.095), length: 0.34, depth: 0.15, bays: [], paving: { ...spot(PLACE_BAYS[1], ROAD), length: PLACE_BAYS[2] - PLACE_BAYS[0] + BAY_WIDTH + 0.02 } }
      : { kind: 'home', colour: Math.floor(random() * COLOURS), lane, angle, ...spot(HOME_BAY - 0.14, ROAD + 0.1), length: 0.12, depth: 0.12, bays: [], paving: { ...spot(HOME_BAY, ROAD), length: BAY_WIDTH } };
    for (const s of place ? PLACE_BAYS : [HOME_BAY]) {
      const front = spot(s, PARKED_FRONT);
      // Where the car's front is when its whole length has just come off the lane: from here it's straight in.
      const kerb = spot(s, PARKED_FRONT - CAR_LENGTH);
      const turnFrom = spot(s - TURN_IN, LANE);
      const backTo = spot(s - BACK_OUT, LANE);
      building.bays.push({
        building, lane, s, ...spot(s, PARKED_FRONT - CAR_LENGTH / 2), angle: Math.atan2(left.y, left.x),
        in: { kind: 'bay', ...measured([...curve(turnFrom, add(turnFrom, lane.dir, 0.07), add(kerb, left, -0.04), kerb), front]) },
        out: { kind: 'bay', ...measured([front, ...curve(kerb, add(kerb, left, -0.04), add(backTo, lane.dir, 0.075), backTo)]) },
        car: null,
        coming: null,
      });
    }
    buildings.push(building);
  });

  // The way from any lane to any other: for each pair, the lane to take next (fewest junctions; ties go to the
  // first found, so it's the same every time).
  /** @type {Map<Lane, Map<Lane, Lane>>} */
  const next = new Map();
  for (const target of lanes) {
    // Searching backwards from the target: every lane learns which lane after it leads there soonest.
    const via = new Map([[target, target]]);
    const todo = [target];
    for (let i = 0; i < todo.length; i++) {
      const lane = todo[i];
      for (const before of lane.from.lanesIn) {
        if (via.has(before) || before.from === lane.to) continue;
        via.set(before, lane);
        todo.push(before);
      }
    }
    for (const [lane, step] of via) {
      if (!next.has(lane)) next.set(lane, new Map());
      next.get(lane).set(target, step);
    }
  }

  return { cols, rows, junctions, roads, gates, lanes, paths, buildings, next };
}

/** A point `s` along a lane, a path or a bay's track, and the direction there. @param {Lane | Path | Track} part @param {number} s */
export function pointOn(part, s) {
  if (part.kind === 'lane') {
    const k = Math.max(0, Math.min(1, s / part.len));
    return { x: part.start.x + (part.end.x - part.start.x) * k, y: part.start.y + (part.end.y - part.start.y) * k, angle: Math.atan2(part.dir.y, part.dir.x) };
  }
  const { points, lengths } = part;
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < s) i++;
  const a = points[i - 1];
  const b = points[i];
  const k = Math.max(0, Math.min(1, (s - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1)));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}
