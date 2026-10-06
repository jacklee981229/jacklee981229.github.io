// Jack's Train World's network: a double-track main line round
// the window, one way on each track, trains keeping left; branches to the stations and to the depot. A station is an
// outpost whose branch ends in a loop, so trains never reverse, in one of three shapes: a plain loop, a round head, or
// a loop with two platforms; all three stand straight up from the main line. The depot is a stack of parallel sidings
// that curve off one track and back onto another. A line out leaves the main line and runs out of the picture: trains
// come onto the railway along it and leave by it. Every piece is a straight or an arc that meets the next one on the same heading, as in
// a toy train set, so every join is smooth. Where a branch leaves the main line, a look-ahead signal stands at each
// way in and a plain signal at each way out; a train books its whole way through a junction before it goes in, so no
// train ever stops inside one. Long stretches are cut into blocks by plain signals. Made to fit the window, a new one
// for each seed; a phone-sized window gets fewer stations. The network is laid out lying down (wider than tall) and
// turned to stand up in a tall window. sim.js runs the trains on it; src/worlds/trains.js draws it. Tested by
// tests/trains.test.js.
import { seeded } from '../town/layout.js';

/** Sizes at scale 1, in pixels; a network scales them all by its `k` to fit its window. */
const SIZE = {
  /** From the window's edge to the outer track's middle. */
  margin: 16,
  /** Between the middles of a double line's two tracks. */
  spacing: 18,
  /** The outer track's corner radius. */
  corner: 70,
  /** The radius of a junction's turns. */
  junction: 46,
  /** A plain loop: half the distance between its two straights. */
  loop: 30,
  /** A round head's radius. */
  bulb: 38,
  /** A two-platform loop: half the distance between its two sides. */
  wide: 40,
  /** The radius of the S-bends where tracks move apart. */
  bend: 60,
  /** The radius of the depot's curves. */
  yard: 34,
  /** The shortest straight between a junction and the first bend. */
  stem: 10,
  /** Between two tracks side by side in the depot or at a two-platform station. */
  siding: 15,
  /** Clearance between branches. */
  gap: 20,
  /** Track either side of a standing train, so it's clear of the bends. */
  pad: 8,
  /** The width of a station's yard, beside a round head's platform. */
  yardWidth: 26,
  /** Half the width of a track's sleepers: how much room a track takes either side of its middle. */
  tie: 5.5,
  /** Half the distance between a track's two rails. */
  gauge: 3,
};
/** The points that trace a track are this far apart, in pixels, whatever the scale. */
const STEP = 2;
/** A window narrower than this either way is phone-sized. */
const PHONE = 500;
/** A train at scale 1: an engine and its wagons, coupled, each as wide as `width`. */
export const TRAIN = { engine: 24, wagon: 20, coupling: 3, wagons: 3, width: 9 };
/** The cargo colours: a pickup and a drop-off of each. */
export const COLOURS = 3;
/** A train's length at scale `k`. */
export const trainLength = (k) => k * (TRAIN.engine + TRAIN.wagons * (TRAIN.coupling + TRAIN.wagon));

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ id: number, kind: 'main' | 'fan', paths: Path[] }} Junction
 * @typedef {{ id: number, kind: 'track', name: string, points: Point[], lengths: number[], len: number, from: Junction | null, to: Junction | null, signals: Signal[] }} Track
 * A one-way track between junctions. `signals` stand along it, in order: a plain one where each block starts and a
 * look-ahead one at its end, before the junction that follows.
 * @typedef {{ id: number, kind: 'path', junction: Junction, from: Track, to: Track, points: Point[], lengths: number[], len: number, crosses: Path[] }} Path
 * A way across a junction, from the end of one track to the start of another; `crosses` are the ways that can't be
 * used at the same time (the same way in, the same way out, or too close anywhere).
 * @typedef {{ s: number, kind: 'block' | 'chain', x: number, y: number }} Signal
 * @typedef {{ track: Track, s0: number, s1: number }} Stretch
 * @typedef {'loop' | 'round' | 'double'} Shape
 * @typedef {{ kind: 'pickup' | 'drop', colour: number, shape: Shape, platforms: Stretch[], wait: Stretch, x: number, y: number, angle: number, length: number, width: number, edge: number }} Station
 * Trains wait on `wait` and load or unload on one of `platforms`. `x`, `y`, `angle`, `length` and `width` are the
 * station's yard, where its building stands; `angle` points along the platforms the way trains come in, and `edge`
 * is the side of the yard the platform's edge is on (1 to the right of that way, -1 to the left).
 * @typedef {{ in: Track, sidings: Track[], out: Track, x: number, y: number, angle: number }} Depot
 * Trains park in the `sidings`, one each. `x`, `y` is a spot beside them for the shed.
 * @typedef {{ in: Track, out: Track }} Line
 * The line out of the picture: trains come in along `in` and leave along `out`, both running past the window's edge.
 * @typedef {{ width: number, height: number, k: number, colours: number, trains: number, trainLength: number, tracks: Track[], paths: Path[], junctions: Junction[], stations: Station[], depot: Depot, line: Line | null }} Network
 * `trains` is how many trains a network starts with; the depot has room for more.
 */

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Draws a track like a turtle: from a point and a heading, straights and arcs, each joining on the same heading. */
function turtle(x, y, heading) {
  const points = [{ x, y }];
  /** Where marked places fall: the index of the point there. */
  const marks = {};
  let h = heading;
  const go = {
    points,
    marks,
    straight(len) {
      if (len < 1e-6) return go;
      const from = points[points.length - 1];
      const n = Math.max(1, Math.ceil(len / STEP));
      for (let i = 1; i <= n; i++) points.push({ x: from.x + Math.cos(h) * len * i / n, y: from.y + Math.sin(h) * len * i / n });
      return go;
    },
    /** Turns by `angle` on a circle of radius `r`: a positive angle turns right (clockwise on screen). */
    arc(r, angle) {
      const from = points[points.length - 1];
      const side = Math.sign(angle);
      // The circle's middle is to the side the track turns to.
      const cx = from.x - Math.sin(h) * side * r;
      const cy = from.y + Math.cos(h) * side * r;
      const n = Math.max(2, Math.ceil(Math.abs(angle) * r / STEP));
      for (let i = 1; i <= n; i++) {
        const a = h + angle * i / n;
        points.push({ x: cx + Math.sin(a) * side * r, y: cy - Math.cos(a) * side * r });
      }
      h += angle;
      return go;
    },
    /** Moves `by` sideways (positive to the right) on two arcs of radius `r`, ending on the same heading. */
    shift(by, r) {
      if (!by) return go;
      const angle = Math.acos(1 - Math.abs(by) / (2 * r));
      return go.arc(r, Math.sign(by) * angle).arc(r, -Math.sign(by) * angle);
    },
    mark(name) {
      marks[name] = points.length - 1;
      return go;
    },
  };
  return go;
}

/** How far along its heading a sideways move of `by` on arcs of radius `r` takes. */
const shiftLength = (by, r) => 2 * r * Math.sin(Math.acos(1 - Math.abs(by) / (2 * r)));

/** The distance to each point along a line of points. */
function measure(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + dist(points[i - 1], points[i]));
  return { lengths, len: lengths[lengths.length - 1] };
}

/** A point `s` along a track or a path, and the heading there. @param {{ points: Point[], lengths: number[] }} part @param {number} s */
export function pointAt(part, s) {
  const { points, lengths } = part;
  let lo = 1;
  let hi = lengths.length - 1;
  // The first point at or past `s`.
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (lengths[m] < s) lo = m + 1;
    else hi = m;
  }
  const a = points[lo - 1];
  const b = points[lo];
  const t = Math.max(0, Math.min(1, (s - lengths[lo - 1]) / (lengths[lo] - lengths[lo - 1] || 1)));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

/** The sizes at scale `k`. */
const sized = (k) => /** @type {typeof SIZE} */ (Object.fromEntries(Object.entries(SIZE).map(([key, v]) => [key, v * k])));

/**
 * How far each kind of branch reaches in from the main line's middle, and how wide it is either side of its axis,
 * at scale `k`. The depot's sidings stand to the right of its axis (looking in from the main line).
 */
function footprints(k, storage) {
  const S = sized(k);
  const reach = S.spacing / 2 + S.junction;
  const train = trainLength(k);
  const P = train + 2 * S.pad;
  const out = (half) => half - S.spacing / 2;
  const station = {
    loop: reach + S.stem + shiftLength(out(S.loop), S.bend) + P + S.loop,
    round: reach + S.stem + P + shiftLength(out(S.bulb), S.bend) + S.bulb,
    double: reach + S.stem + shiftLength(out(S.wide), S.bend) + P + 2 * shiftLength(S.siding, S.bend) + S.wide,
  };
  const half = Math.max(S.loop, S.bulb, S.wide, S.spacing / 2 + S.yardWidth + S.pad) + S.tie;
  const first = S.spacing / 2 + 2 * S.yard + 0.4 * S.siding;
  return {
    S, reach, train, P, station, half,
    // The two-platform station reaches deepest: it only goes where nothing faces it, so the others set the size.
    stationReach: Math.max(station.loop, station.round),
    depot: { reach: reach + S.stem + 3 * S.yard + P + S.tie, left: S.spacing / 2 + S.tie, right: first + (storage - 1) * S.siding + S.tie, first },
  };
}

/**
 * How big everything can be in a window `W` wide and `H` high (lying down), and how many cargo colours fit. As many
 * colours as fit without shrinking things below 60% of the size the height allows (a phone-sized window gets two at
 * most, rather than tiny stations); the biggest size that fits them: two stations facing each other fit across the
 * window, and the depot and the stations take no more than four fifths of the places along the main line.
 */
function fitTo(W, H) {
  const biggest = Math.min(1.3, Math.max(0.3, H / 650));
  for (let colours = H < PHONE ? Math.min(2, COLOURS) : COLOURS; colours >= 1; colours--) {
    const smallest = colours > 1 ? Math.max(0.3, 0.6 * biggest) : 0.2;
    for (let k = biggest; k >= smallest; k *= 0.96) {
      const fit = tryFit(W, H, k, colours);
      if (fit) return fit;
    }
  }
  throw new Error(`No train network fits a ${W} by ${H} window.`);
}

/** The places along the main line and the room the branches take, at scale `k` with `colours` colours; null if it doesn't fit. */
function tryFit(W, H, k, colours) {
  // Four trains for each colour, a siding more than that, and one spare for each colour for the trains Add train brings.
  const storage = 5 * colours + 1;
  const f = footprints(k, storage);
  const { S } = f;
  const mid = S.margin + S.spacing / 2;
  const span = H - 2 * mid;
  if (2 * f.stationReach + S.gap > span) return null;
  if (f.depot.reach + S.gap > span - S.spacing / 2) return null;
  if (f.station.double + S.gap > span - S.spacing / 2) return null;
  const first = S.margin + S.corner + f.reach + S.gap / 2;
  const usable = W - 2 * first;
  if (usable < 0) return null;
  const slots = Math.floor(usable / (2 * f.reach + S.gap)) + 1;
  const spacing = slots > 1 ? usable / (slots - 1) : Infinity;
  // Places the depot takes from stations: beside it on its own side, and across from it if they'd meet in the middle;
  // and the line out takes one.
  const clear = f.half + S.gap;
  const beside = Math.floor((f.depot.left + clear) / spacing) + Math.floor((f.depot.right + clear) / spacing);
  const across = f.depot.reach + (span - S.gap) / 2 + S.gap > span ? 1 + beside : 0;
  // The places across from the two-platform station.
  const facing = f.station.double + f.stationReach + S.gap > span ? 1 + 2 * Math.floor((f.half + clear) / spacing) : 0;
  if (2 * colours + 2 + beside + across + facing > Math.floor(0.8 * 2 * slots)) return null;
  return { ...f, k, colours, storage, slots, spacing, first, usable, mid, span, clear };
}

/**
 * A network for a window `width` by `height` pixels, the same every time for the same seed.
 * @param {number} width @param {number} height @param {number} seed
 * @returns {Network}
 */
export function buildNetwork(width, height, seed) {
  const random = seeded(seed);
  const standing = height > width;
  const W = standing ? height : width;
  const H = standing ? width : height;
  const fit = fitTo(W, H);
  const { k, S, colours, storage, reach, train, P } = fit;

  /** @type {Track[]} */
  const tracks = [];
  /** @type {Path[]} */
  const paths = [];
  /** @type {Junction[]} */
  const junctions = [];
  const track = (name, points, from = null, to = null) => {
    const t = { id: tracks.length, kind: /** @type {const} */ ('track'), name, points, ...measure(points), from, to, signals: [] };
    tracks.push(t);
    return t;
  };
  const junction = (kind) => {
    const j = { id: junctions.length, kind, paths: [] };
    junctions.push(j);
    return j;
  };
  const path = (j, points, from = null, to = null) => {
    const p = { id: paths.length, kind: /** @type {const} */ ('path'), junction: j, from, to, points, ...measure(points), crosses: [] };
    paths.push(p);
    j.paths.push(p);
    return p;
  };

  // Places along the top and bottom of the main line where a branch can leave it, the same number on each side.
  const xs = fit.slots > 1 ? Array.from({ length: fit.slots }, (_, i) => fit.first + i * fit.spacing) : [W / 2];
  const places = [0, 1].flatMap((side) => xs.map((x, i) => ({ side, i, x })));
  /** Which way a branch's own right is along the main line, as seen on screen: the top side's frame is turned round. */
  const turnOf = (place) => (place.side === 0 ? 1 : -1);
  // The depot's sidings, from the main line, on screen: they stand to one side of its branch, so it only goes where
  // they stay clear of the main line's sides.
  const spanOf = (place) => {
    const turn = turnOf(place);
    return [place.x + Math.min(-fit.depot.left * turn, fit.depot.right * turn), place.x + Math.max(-fit.depot.left * turn, fit.depot.right * turn)];
  };
  const inside = S.margin + S.spacing + S.tie + S.gap / 2;
  const depotPlaces = places.filter((p) => spanOf(p)[0] >= inside && spanOf(p)[1] <= W - inside);
  const depotAt = depotPlaces.length ? depotPlaces[Math.floor(random() * depotPlaces.length)] : places[Math.floor(places.length / 2)];
  const depotSpan = spanOf(depotAt);
  const clearOfDepot = (p) => p.x + fit.clear <= depotSpan[0] || p.x - fit.clear >= depotSpan[1];
  const meetsDepot = fit.depot.reach + (fit.span - S.gap) / 2 + S.gap > fit.span;
  const open = places.filter((p) => p !== depotAt && (clearOfDepot(p) || (p.side !== depotAt.side && !meetsDepot)));
  // Stations spread out: each next one goes where it's farthest from those placed so far (a little chance decides
  // between places nearly as far), so no stretch is left empty while another is crowded.
  const chosen = [];
  const taken = [depotAt];
  while (chosen.length < 2 * colours && open.length) {
    const room = (p) => Math.min(...taken.map((t) => Math.abs(t.x - p.x) + (t.side === p.side ? 0 : fit.spacing / 2)));
    const pick = open.map((p) => [room(p) * (0.8 + 0.4 * random()), p]).sort((a, b) => b[0] - a[0])[0][1];
    chosen.push(pick);
    taken.push(pick);
    open.splice(open.indexOf(pick), 1);
  }
  const roles = Array.from({ length: colours }, (_, c) => [{ kind: /** @type {const} */ ('pickup'), colour: c }, { kind: /** @type {const} */ ('drop'), colour: c }]).flat()
    .map((r) => [random(), r]).sort((a, b) => a[0] - b[0]).map(([, r]) => r);

  // Each branch is laid out in its own frame: its main line along x, the near track (the one on the branch's side)
  // running towards +x, and the branch going off towards -y. The bottom side's frame is the window's; the top side's
  // is turned half a circle.
  // The line out goes the other way, out of the picture: its frame is turned round, so there the near track is the
  // outer one.
  const frameOf = (place) => {
    const y = place.side === 0 ? H - fit.mid : fit.mid;
    const turn = turnOf(place) * (place.out ? -1 : 1);
    return (/** @type {Point[]} */ pts) => pts.map((p) => ({ x: place.x + p.x * turn, y: y + p.y * turn }));
  };

  // A junction where a branch leaves the main line: the near track straight on or into the branch, the far track
  // straight on or across the near one into the branch, and the branch out onto either.
  const mainJunction = (place) => {
    const at = frameOf(place);
    const s = S.spacing;
    const r = S.junction;
    const j = junction('main');
    const ways = {
      nearOn: path(j, at(turtle(-reach, -s / 2, 0).straight(2 * reach).points)),
      nearIn: path(j, at(turtle(-reach, -s / 2, 0).arc(r, -Math.PI / 2).points)),
      farOn: path(j, at(turtle(r - s / 2, s / 2, Math.PI).straight(2 * (r - s / 2)).points)),
      farIn: path(j, at(turtle(r - s / 2, s / 2, Math.PI).arc(r, Math.PI / 2).straight(s).points)),
      outNear: path(j, at(turtle(s / 2, -reach, Math.PI / 2).arc(r, -Math.PI / 2).points)),
      outFar: path(j, at(turtle(s / 2, -reach, Math.PI / 2).straight(s).arc(r, Math.PI / 2).points)),
    };
    return { j, ways, at };
  };

  /** @type {Station[]} */
  const stations = [];
  /** Each branch's ways at its junction, and its first and last tracks. */
  const branches = [];

  // Which shape each station takes: a pickup is the busy end, so one of them gets two platforms; the rest are plain
  // loops or round heads, by chance.
  // One pickup gets two platforms: one with nothing across from it that it would run into (by chance among those).
  const faces = (a, b, deep) => a.side !== b.side && Math.abs(a.x - b.x) < 2 * fit.half + S.gap && deep + fit.stationReach + S.gap > fit.span;
  const roomy = roles.map((r, i) => i).filter((i) => roles[i].kind === 'pickup'
    && !chosen.some((q) => q !== chosen[i] && faces(chosen[i], q, fit.station.double))
    && !(chosen[i].side !== depotAt.side && !clearOfDepot(chosen[i]) && fit.station.double + fit.depot.reach + S.gap > fit.span));
  const doubleAt = roomy.length ? roomy[Math.floor(random() * roomy.length)] : -1;
  /** @type {Shape[]} */
  const shapes = roles.map((role, i) => (i === doubleAt ? 'double' : random() < 0.5 ? 'round' : 'loop'));

  roles.forEach((role, i) => {
    const place = chosen[i];
    const shape = shapes[i];
    const { j, ways, at } = mainJunction(place);
    const sAt = (t, go, name) => t.lengths[go.marks[name]];
    const stretch = (t, s0, s1) => ({ track: t, s0, s1 });
    const name = `${role.kind} ${role.colour}`;
    if (shape === 'double') {
      // Up, round, then two platforms side by side, and back down.
      const out = S.wide - S.spacing / 2;
      const fan = shiftLength(S.siding, S.bend);
      const up = turtle(-S.spacing / 2, -reach, -Math.PI / 2).straight(S.stem).shift(-out, S.bend).mark('wait').straight(P + 2 * fan).mark('round').arc(S.wide, Math.PI);
      const inTrack = track(name, at(up.points), j);
      const fanOut = junction('fan');
      const fanIn = junction('fan');
      inTrack.to = fanOut;
      const top = -(reach + S.stem + shiftLength(out, S.bend) + P + 2 * fan);
      const platforms = [0, 1].map((n) => {
        const x = S.wide - n * S.siding;
        const t = track(`${name} platform ${n + 1}`, at(turtle(x, top + fan, Math.PI / 2).straight(P).points), fanOut, fanIn);
        const way = turtle(S.wide, top, Math.PI / 2);
        path(fanOut, at((n ? way.shift(S.siding, S.bend) : way.straight(fan)).points), inTrack, t);
        return t;
      });
      const outTrack = track(`${name} out`, at(turtle(S.wide, top + fan + P + fan, Math.PI / 2).shift(out, S.bend).straight(S.stem).points), fanIn, j);
      platforms.forEach((t, n) => {
        const way = turtle(S.wide - n * S.siding, top + fan + P, Math.PI / 2);
        path(fanIn, at((n ? way.shift(-S.siding, S.bend) : way.straight(fan)).points), t, outTrack);
      });
      const yard = at([{ x: -S.siding / 2, y: top + fan + P / 2 }])[0];
      stations.push({ ...role, shape: 'double', platforms: platforms.map((t) => stretch(t, 0, t.len)), wait: stretch(inTrack, sAt(inTrack, up, 'wait'), sAt(inTrack, up, 'round')), ...yard, angle: turnAngle(place, Math.PI / 2), length: P, width: 2 * S.wide - S.siding - 2 * S.tie - 2 * S.pad, edge: 0 });
      branches.push({ ways, first: inTrack, last: outTrack });
      return;
    }
    let go;
    let yardAt;
    let width = 2 * (S.loop - S.tie) - 2 * S.pad;
    if (shape === 'round') {
      // Up the stem (trains wait on it), round the head, and down the stem to the platform, with the yard beside it.
      const out = S.bulb - S.spacing / 2;
      go = turtle(-S.spacing / 2, -reach, -Math.PI / 2).straight(S.stem).mark('wait').straight(P).mark('round')
        .shift(-out, S.bend).arc(S.bulb, Math.PI).shift(out, S.bend).mark('platform').straight(P).mark('leave').straight(S.stem);
      yardAt = { x: S.spacing / 2 + S.tie + S.pad / 2 + S.yardWidth / 2, y: -(reach + S.stem + P / 2) };
      width = S.yardWidth;
    } else {
      // A plain loop: out to the loop's width, a straight to wait on, round, the straight with the platform, back;
      // the yard between the two straights.
      const out = S.loop - S.spacing / 2;
      go = turtle(-S.spacing / 2, -reach, -Math.PI / 2).straight(S.stem)
        .shift(-out, S.bend).mark('wait').straight(P).mark('round').arc(S.loop, Math.PI).mark('platform').straight(P).mark('leave').shift(out, S.bend).straight(S.stem);
      yardAt = { x: 0, y: -(reach + S.stem + shiftLength(out, S.bend) + P / 2) };
    }
    const t = track(name, at(go.points), j, j);
    const wait = stretch(t, sAt(t, go, 'wait'), sAt(t, go, 'round'));
    const platform = stretch(t, sAt(t, go, 'platform'), sAt(t, go, 'leave'));
    stations.push({ ...role, shape, platforms: [platform], wait, ...at([yardAt])[0], angle: turnAngle(place, Math.PI / 2), length: P, width, edge: 0 });
    branches.push({ ways, first: t, last: t });
  });

  // The depot: up the branch and right along the top, where a ladder of switches curves each siding off down the
  // same way; at the bottom the sidings curve back onto one track, which turns down to the main line.
  /** @type {Depot} */
  let depot;
  {
    const { j, ways, at } = mainJunction(depotAt);
    const r = S.yard;
    const x0 = fit.depot.first;
    const yBottom = -(reach + S.stem + r);
    const yTop = yBottom - 2 * r - P;
    const inTrack = track('depot in', at(turtle(-S.spacing / 2, -reach, -Math.PI / 2).straight(S.stem + 2 * r + P).arc(r, Math.PI / 2).straight(S.spacing + 0.4 * S.siding).points), j);
    const fanOut = junction('fan');
    const fanIn = junction('fan');
    inTrack.to = fanOut;
    const outTrack = track('depot out', at(turtle(x0 - r, yBottom, Math.PI).straight(0.4 * S.siding).arc(r, -Math.PI / 2).straight(S.stem).points), fanIn, j);
    const sidings = Array.from({ length: storage }, (_, n) => {
      const x = x0 + n * S.siding;
      const t = track(`siding ${n + 1}`, at(turtle(x, yTop + r, Math.PI / 2).straight(P).points), fanOut, fanIn);
      path(fanOut, at(turtle(x0 - r, yTop, 0).straight(n * S.siding).arc(r, Math.PI / 2).points), inTrack, t);
      path(fanIn, at(turtle(x, yBottom - r, Math.PI / 2).arc(r, Math.PI / 2).straight(n * S.siding).points), t, outTrack);
      return t;
    });
    depot = { in: inTrack, sidings, out: outTrack, ...at([{ x: (S.spacing / 2 + x0) / 2, y: yTop + r + P / 2 }])[0], angle: turnAngle(depotAt, Math.PI / 2) };
    branches.push({ ways, first: inTrack, last: outTrack });
  }

  // The line out: from a place no station or depot uses, as far from the depot as can be, a branch that runs straight
  // out of the picture, one track out and one back in, each long enough to hold a whole train out of sight.
  /** @type {Line | null} */
  let line = null;
  {
    const free = places.filter((p) => !taken.includes(p)).sort((a, b) => Math.abs(b.x - depotAt.x) + (b.side !== depotAt.side ? fit.spacing / 2 : 0) - Math.abs(a.x - depotAt.x) - (a.side !== depotAt.side ? fit.spacing / 2 : 0));
    if (free.length) {
      const { j, ways, at } = mainJunction({ ...free[0], out: true });
      const away = train + 4 * S.pad;
      const outTrack = track('line out', at(turtle(-S.spacing / 2, -reach, -Math.PI / 2).straight(away).points), j, null);
      const inTrack = track('line in', at(turtle(S.spacing / 2, -reach - away, Math.PI / 2).straight(away).points), null, j);
      line = { in: inTrack, out: outTrack };
      branches.push({ ways, first: outTrack, last: inTrack, out: true });
    }
  }

  // The main line: the outer track runs clockwise and the inner one anticlockwise, so trains keep left. Each is cut
  // where it meets a junction: from a junction's way out to the next junction's way in is one track.
  const m = S.margin;
  const R = S.corner;
  const loopOf = (inner) => {
    const inset = inner ? m + S.spacing : m;
    const r = inner ? R - S.spacing : R;
    const w = W - 2 * (m + R);
    const h = H - 2 * (m + R);
    const turn = inner ? -Math.PI / 2 : Math.PI / 2;
    const go = inner ? turtle(W - m - R, inset, Math.PI) : turtle(m + R, inset, 0);
    for (let side = 0; side < 4; side++) go.straight(side % 2 ? h : w).arc(r, turn);
    return { points: go.points, ...measure(go.points) };
  };
  /** How far round a loop a point on it is. */
  const around = (loop, p) => {
    let best = Infinity;
    let at = 0;
    for (let i = 1; i < loop.points.length; i++) {
      const a = loop.points[i - 1];
      const b = loop.points[i];
      const len = dist(a, b) || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (len * len)));
      const d = Math.hypot(p.x - a.x - (b.x - a.x) * t, p.y - a.y - (b.y - a.y) * t);
      if (d < best) [best, at] = [d, loop.lengths[i - 1] + t * len];
    }
    return at;
  };
  /** The stretch of a loop from one point on it to another, going forward (round past the start if need be). */
  const between = (loop, from, to) => {
    const a = around(loop, from);
    let b = around(loop, to);
    if (b <= a) b += loop.len;
    const pts = [from];
    for (let i = 0; i < loop.points.length * 2; i++) {
      const s = loop.lengths[i % loop.points.length] + (i >= loop.points.length ? loop.len : 0);
      if (s > a + 0.01 && s < b - 0.01) pts.push(loop.points[i % loop.points.length]);
    }
    pts.push(to);
    // The loop's last point is its first: drop the double.
    return pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 1e-6);
  };
  for (const inner of [true, false]) {
    const loop = loopOf(inner);
    // Each junction's way in and way out on this loop, in the order a train meets them.
    // A branch's near track is the inner one, but for the line out, which leaves on the outer side.
    const stops = branches.map(({ ways, out }) => {
      const near = inner !== Boolean(out);
      const on = near ? ways.nearOn : ways.farOn;
      return { ways, near, way: on, in: on.points[0], out: on.points[on.points.length - 1] };
    }).sort((a, b) => around(loop, a.in) - around(loop, b.in));
    stops.forEach((stop, i) => {
      const next = stops[(i + 1) % stops.length];
      const t = track(inner ? 'inner' : 'outer', between(loop, stop.out, next.in), stop.way.junction, next.way.junction);
      stop.after = t;
      next.before = t;
    });
    for (const { ways, near, before, after } of stops) {
      const [on, into, onto] = near ? [ways.nearOn, ways.nearIn, ways.outNear] : [ways.farOn, ways.farIn, ways.outFar];
      Object.assign(on, { from: before, to: after });
      into.from = before;
      onto.to = after;
    }
  }
  for (const { ways, first, last } of branches) {
    ways.nearIn.to = first;
    ways.farIn.to = first;
    ways.outNear.from = last;
    ways.outFar.from = last;
  }

  // Which side of its yard each station's platform edge is on: the side its nearest platform runs along.
  for (const st of stations) {
    const d = { x: Math.cos(st.angle), y: Math.sin(st.angle) };
    const mids = st.platforms.map((p) => pointAt(p.track, (p.s0 + p.s1) / 2));
    const near = mids.sort((a, b) => dist(a, st) - dist(b, st))[0];
    st.edge = Math.sign(d.x * (near.y - st.y) - d.y * (near.x - st.x));
  }

  // Which ways across a junction can't be used together: the same way in, the same way out, or too close anywhere.
  const clearance = S.spacing * 0.75;
  for (const j of junctions) {
    for (const a of j.paths) {
      for (const b of j.paths) {
        if (a === b) continue;
        if (a.from === b.from || a.to === b.to || a.points.some((p) => b.points.some((q) => dist(p, q) < clearance))) a.crosses.push(b);
      }
    }
  }

  // Signals. A plain one where a track leaves a junction and wherever a block starts; a look-ahead one at the end of
  // a track that runs into a junction. Main line tracks are cut into blocks about two trains long; a station's track
  // where trains wait and where they stop.
  const starts = new Map();
  for (const st of stations) {
    starts.set(st.wait.track, [...(starts.get(st.wait.track) ?? []), st.wait.s0, st.wait.s1]);
    for (const p of st.platforms) if (p.s0 > 0) starts.set(p.track, [...(starts.get(p.track) ?? []), p.s0, p.s1]);
  }
  for (const t of tracks) {
    const at = new Set(starts.get(t) ?? []);
    if (t.name === 'inner' || t.name === 'outer') {
      const n = Math.max(1, Math.floor(t.len / (2 * train)));
      for (let i = 1; i < n; i++) at.add(t.len * i / n);
    }
    at.add(0);
    at.delete(t.len);
    for (const s of [...at].sort((a, b) => a - b)) t.signals.push({ s, kind: 'block', x: 0, y: 0 });
    if (t.to) t.signals.push({ s: t.len, kind: 'chain', x: 0, y: 0 });
  }

  // Turned to stand up in a tall window: a quarter turn clockwise, so trains still keep left.
  if (standing) {
    const turn = (p) => ({ x: H - p.y, y: p.x });
    for (const part of [...tracks, ...paths]) part.points = part.points.map(turn);
    for (const st of stations) Object.assign(st, turn(st), { angle: st.angle + Math.PI / 2 });
    Object.assign(depot, turn(depot), { angle: depot.angle + Math.PI / 2 });
  }

  // Each lamp beside its track, on the left, where a driver keeping left sees it; a look-ahead one just before the
  // junction it guards, a plain one just past where its block starts.
  const aside = S.gauge + 4.5 * k;
  for (const t of tracks) {
    for (const sig of t.signals) {
      const at = pointAt(t, Math.min(t.len - 3 * k, Math.max(3 * k, sig.s)));
      Object.assign(sig, { x: at.x + Math.sin(at.angle) * aside, y: at.y - Math.cos(at.angle) * aside });
    }
  }

  return { width, height, k, colours, trains: 4 * colours, trainLength: train, tracks, paths, junctions, stations, depot, line };
}

/** The screen angle of a heading given in a branch's own frame, where the top side's frame is turned round. */
function turnAngle(place, angle) {
  return place.side === 0 ? angle : angle + Math.PI;
}

/** Sizes the drawing needs, at the network's scale. @param {number} k */
export const sizesAt = (k) => ({ tie: SIZE.tie * k, gauge: SIZE.gauge * k, spacing: SIZE.spacing * k, loop: SIZE.loop * k, margin: SIZE.margin * k, pad: SIZE.pad * k });
