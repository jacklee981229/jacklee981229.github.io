import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newTown } from '../src/lib/town/map.js';
import { build, change } from '../src/lib/town/growth.js';
import { AXLES, bodyOf, boxesTouch, buildRoads, CAR_L, CAR_W, costsTo, dirAt, follow, LANE, makeLine, pointAt, routeFrom, turnPath } from '../src/lib/town/roads.js';

/** @typedef {import('../src/lib/town/roads.js').Roads} Roads @typedef {import('../src/lib/town/roads.js').Move} Move
 *  @typedef {import('../src/lib/town/roads.js').Pt} Pt */

/** Some days' towns, seeded as the page seeds them, each looked at after it's built and as it changes. */
const DAYS = [20261011, 20261018, 20261225, 20270101, 20270615, 20280229];

/** Every town to look at: each day's, built and then after every few of its changes. */
function towns() {
  /** @type {{ name: string, roads: Roads }[]} */
  const out = [];
  for (const seed of DAYS) {
    const T = newTown(seed);
    build(T);
    for (let k = 0; k <= 30; k++) {
      if (k) change(T, k);
      if (k % 6 === 0) out.push({ name: `${seed}, change ${k}`, roads: buildRoads(T) });
    }
  }
  return out;
}
const TOWNS = towns();
const near = (/** @type {Pt} */ p, /** @type {Pt} */ q, e = 1e-3) => Math.hypot(p[0] - q[0], p[1] - q[1]) < e;
const degrees = (/** @type {Pt} */ u, /** @type {Pt} */ v) => (Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) * 180) / Math.PI;
const isSeg = (/** @type {object} */ x) => 'cars' in x;

test('every way across a box starts where its lane ends and ends where the next begins, heading on', () => {
  for (const { name, roads } of TOWNS) {
    for (const m of roads.moves) {
      const line = m.line, a = line.pts[0], b = line.pts[line.pts.length - 1];
      // How a car heads as it starts: along its front axle's way, or into a drive, along its back axle's.
      const start = m.rear && !m.lead ? m.rear.u0 : line.u0;
      if (isSeg(m.from)) {
        const lane = /** @type {import('../src/lib/town/roads.js').Seg} */ (m.from).line;
        assert.ok(near(a, lane.pts[lane.pts.length - 1]), `${name}: ${m.kind} ${m.id} starts off its lane`);
        assert.ok(degrees(start, lane.u1) < 4, `${name}: ${m.kind} ${m.id} turns as it starts`);
      } else assert.ok(near(a, /** @type {import('../src/lib/town/roads.js').Spot} */ (m.from).R), `${name}: ${m.kind} ${m.id} starts off its spot`);
      if (isSeg(m.to)) {
        const lane = /** @type {import('../src/lib/town/roads.js').Seg} */ (m.to).line;
        assert.ok(near(b, lane.pts[0]), `${name}: ${m.kind} ${m.id} ends off its lane`);
        assert.ok(degrees(line.u1, lane.u0) < 4, `${name}: ${m.kind} ${m.id} turns as it ends`);
      }
    }
  }
});

test('a car parks square: every way into a drive or a bay ends on the spot, heading straight into it', () => {
  for (const { name, roads } of TOWNS) {
    for (const m of roads.moves.filter((x) => x.kind === 'park')) {
      const spot = /** @type {import('../src/lib/town/roads.js').Spot} */ (m.to), rear = /** @type {import('../src/lib/town/roads.js').Line} */ (m.rear);
      assert.ok(near(rear.pts[rear.pts.length - 1], spot.R, 1e-9), `${name}: park ${m.id} ends off its spot`);
      assert.ok(degrees(dirAt(rear, rear.len), spot.u) < 0.1, `${name}: park ${m.id} ends turned ${degrees(dirAt(rear, rear.len), spot.u).toFixed(2)} degrees`);
    }
  }
});

test('every lane leads on, and every drive and bay can be reached from every road into town and left again', () => {
  for (const { name, roads } of TOWNS) {
    for (const seg of roads.segs) {
      if (!seg.gateOut) assert.ok(seg.outs.length, `${name}: lane ${seg.id} leads nowhere`);
      if (!seg.gateIn) assert.ok(seg.ins.length, `${name}: lane ${seg.id} comes from nowhere`);
    }
    const out = costsTo(roads, 'out');
    for (const spot of roads.spots) {
      assert.ok(spot.box, `${name}: a spot of ${spot.b.kind} ${spot.b.id} is on no box`);
      assert.ok(routeFrom(spot, 'out', out), `${name}: no way out from ${spot.b.kind} ${spot.b.id}`);
      if (spot.slot > 0) continue;
      const cost = costsTo(roads, spot);
      for (const gate of roads.gatesIn) assert.ok(routeFrom(gate, spot, cost), `${name}: ${spot.b.kind} ${spot.b.id} can't be reached`);
    }
  }
});

test('ways from the same lane are never foes, foes are each other\'s, and the two lanes of a road never are', () => {
  for (const { name, roads } of TOWNS) {
    for (const m of roads.moves) {
      for (const f of m.foes) {
        assert.notEqual(f.from, m.from, `${name}: ${m.kind} ${m.id} and ${f.kind} ${f.id} come from the same lane`);
        assert.ok(f.foes.includes(m), `${name}: ${m.kind} ${m.id} and ${f.kind} ${f.id}`);
        assert.equal(f.box, m.box, `${name}: foes in different boxes`);
      }
    }
    for (const box of roads.boxes.filter((b) => b.kind === 'stop')) {
      const [a, b] = box.moves.filter((m) => m.kind === 'through');
      assert.ok(!a.foes.includes(b), `${name}: the two lanes are foes at tile ${box.tile}`);
    }
  }
});

test('two cars passing on the tightest bend a road has keep clear of each other', () => {
  // A road east to a corner, rounded to the smallest radius roads bend at, then north; a car each way along it.
  const r = 0.5;
  const mid = /** @type {Pt[]} */ ([[-3, 0], ...turnPath([-r, 0], [1, 0], [0, -r], [0, -1], false), [0, -3]]);
  /** @param {Pt[]} pts @returns {Pt[]} */
  const left = (pts) => pts.map((p, k) => {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [p[0] + ((b[1] - a[1]) / l) * LANE, p[1] - ((b[0] - a[0]) / l) * LANE];
  });
  /** @param {Pt[]} pts */
  const bodies = (pts) => {
    const line = makeLine(pts), out = [];
    /** @type {Pt} */
    let back = [line.pts[0][0] - AXLES * line.u0[0], line.pts[0][1] - AXLES * line.u0[1]];
    for (let s = 0; s <= line.len; s += 0.01) { const f = pointAt(line, s); back = follow(back, f); out.push(bodyOf(f, back)); }
    return out;
  };
  const one = bodies(left(mid)), other = bodies(left([...mid].reverse()));
  const gap = 0.03;
  for (const a of one) for (const b of other) assert.ok(!boxesTouch(a, CAR_L / 2 + gap / 2, CAR_W / 2 + gap / 2, b, CAR_L / 2 + gap / 2, CAR_W / 2 + gap / 2), 'cars on the bend come within 0.03 of each other');
});
