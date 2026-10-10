import { test } from 'node:test';
import assert from 'node:assert/strict';
import { growBank, plant, scatter, seeded, SEED } from '../src/lib/fireflies/mangroves.js';
import { BUTTON, hang, PINNED } from '../src/lib/fireflies/lanterns.js';
import * as S from '../src/lib/fireflies/sync.js';
import { lookOf } from '../src/lib/guestbook.js';

/**
 * A bank on the real trees of a laptop's card (or a phone's), as the river lays it out: the fireflies on the leaves,
 * half far, a third in the middle, the rest near, each with its own pace, starting at random.
 */
function riverBank(count, width = 1136, height = 620, cells = S.CELLS.wide) {
  const bank = growBank(width, height);
  const rand = seeded(7);
  const x = [];
  const y = [];
  for (const row of bank.rows) {
    const n = Math.round(count * row.fireflies);
    const spots = scatter(row.trees, n, width, rand);
    for (let i = 0; i < n; i++) {
      x.push(spots[i * 2] / width);
      y.push(spots[i * 2 + 1] / height);
    }
  }
  const fireflies = S.createBank({ x, y, natural: S.paces(x.length, rand), grid: S.gridFor(width, height, cells) }, rand);
  // One lantern on the near bank, flashing on true time, as today's one note makes.
  const lantern = [0.45, (bank.waterline - 0.07 * height) / height];
  return { fireflies, lantern };
}

/** Runs a bank as the river does: true time from `offset` ms, its pull growing in over the opening, the lantern
 *  flashing on the beat, and whatever the taps make. Returns a runner that goes on for more seconds. */
function runner({ fireflies, lantern }, offset = 123) {
  const keeper = S.keeper();
  let t = 0;
  return {
    keeper,
    fireflies,
    get t() { return t; },
    phase: () => S.truePhase(t * 1000 + offset),
    run(seconds, onStep = () => {}) {
      for (let i = Math.round(seconds / S.STEP); i > 0; i--) {
        onStep(t);
        const ms = t * 1000 + offset;
        const lights = [[...lantern, S.MODEL.lantern * S.flash(S.truePhase(ms), S.BEAT), S.MODEL.lanternReach], ...keeper.lights(t)];
        S.stepBank(fireflies, { phase: S.truePhase(ms), pull: S.pullAt(t), lights, beat: keeper.at(t) });
        t += S.STEP;
      }
    },
  };
}

test('a flash swells and fades, and true time puts one on every half second', () => {
  assert.equal(S.flash(0, S.BEAT), 1);
  assert.equal(S.flash(0.5, S.BEAT), 0);
  // The swell takes RISE seconds and the fade FALL, whatever the pace.
  assert.ok(S.flash(1 - S.RISE * S.BEAT * 0.5, S.BEAT) > 0.4 && S.flash(1 - S.RISE * S.BEAT * 1.01, S.BEAT) === 0);
  assert.ok(S.flash(S.FALL * S.BEAT * 0.5, S.BEAT) > 0.4 && S.flash(S.FALL * S.BEAT * 1.01, S.BEAT) === 0);
  // On each half second of true time the beat is at the top of a flash; a quarter second off, it's dark.
  for (const ms of [1791633975000, 1791633975500, 1791633976000]) {
    assert.equal(S.truePhase(ms), 0);
    assert.equal(S.flash(S.truePhase(ms), S.BEAT), 1);
    assert.equal(S.flash(S.truePhase(ms + 250), S.BEAT), 0);
  }
  assert.ok(Math.abs(S.truePhase(1791633975125) - 0.25) < 1e-9);
});

test('taps closer together than 0.375 s are ignored, and three steady ones make a beat', () => {
  const keeper = S.keeper();
  const kept = [0, 0.2, 0.374, 0.375, 0.6, 0.8, 1.2].map((at) => keeper.tap(at, 0.5, 0.5));
  assert.deepEqual(kept, [true, false, false, true, false, true, true]);
  // 140 a minute, steady: a beat, at the taps' pace, peaking on each tap.
  const beat = S.keeper();
  for (const at of [10, 10 + 60 / 140, 10 + 120 / 140]) beat.tap(at, 0.3, 0.4);
  const now = beat.at(10 + 120 / 140);
  assert.ok(now && now.weight === 1 && Math.abs(now.phase) < 1e-9);
  assert.ok(Math.abs((beat.at(10 + 180 / 140)?.phase ?? 1) % 1) < 1e-9);
  // Uneven taps make no beat; a beat is let go of a few seconds after the last tap.
  const uneven = S.keeper();
  for (const at of [0, 0.4, 1.1]) uneven.tap(at, 0.5, 0.5);
  assert.equal(uneven.at(1.1), null);
  assert.equal(beat.at(10 + 120 / 140 + S.HOLD + S.LET_GO + 0.1), null);
});

test('512 fireflies on the bank fall into step: nine in ten within ±60 ms of each other by a minute', () => {
  const river = runner(riverBank(512));
  river.run(60);
  const share = S.inStep(river.fireflies, 60);
  assert.ok(share >= 0.9, `only ${(share * 100).toFixed(1)}% in step`);
});

for (const count of [6144, 16384]) {
  test(`${count} fireflies settle with their mean flash within ±20 ms of true time's half seconds`, () => {
    const made = count === 6144 ? riverBank(count, 343, 436, S.CELLS.phone) : riverBank(count);
    const river = runner(made);
    river.run(count === 6144 ? 45 : 55);
    const lag = S.lagOf(made.fireflies, river.phase());
    assert.ok(Math.abs(lag) <= 20, `the bank's mean flash is ${lag.toFixed(1)} ms off the beat`);
    assert.ok(S.inStep(made.fireflies) >= 0.95);
  });
}

test('a beat tapped at 140 a minute is learned within 10 s, and forgotten within 30 s of the last tap', () => {
  const made = riverBank(2048);
  const river = runner(made);
  river.run(45);
  const fireflies = made.fireflies;
  // The fireflies near the taps, and how many turns they've made.
  const at = [0.3, 0.32];
  const near = [];
  for (let i = 0; i < fireflies.n; i++) if (Math.hypot((fireflies.x[i] - at[0]) * 1136, (fireflies.y[i] - at[1]) * 620) < 90) near.push(i);
  assert.ok(near.length > 20);
  const turns = () => near.reduce((s, i) => s + fireflies.turns[i] + fireflies.theta[i], 0) / near.length;
  const period = (seconds, onStep) => {
    const before = turns();
    river.run(seconds, onStep);
    return seconds / (turns() - before);
  };
  const start = river.t;
  let next = start;
  const tapping = (t) => {
    if (t - start < 12 && t >= next) {
      river.keeper.tap(t, at[0], at[1]);
      next += 60 / 140;
    }
  };
  river.run(8, tapping);
  const learned = period(2, tapping);
  assert.ok(Math.abs(learned - 60 / 140) <= 0.05 * (60 / 140), `the period near the taps is ${learned.toFixed(3)} s after 10 s`);
  river.run(2, tapping);
  // Stopped: they keep the beat for a few seconds, then drift back to true time's half second.
  river.run(28);
  const back = period(2);
  assert.ok(Math.abs(back - 0.5) <= 0.025, `the period is ${back.toFixed(3)} s 30 s after the last tap`);
});

test('no firefly ever paces faster than 2.67 a second, nor flashes twice within 0.375 s, even tapped at 160', () => {
  const made = riverBank(1024);
  const river = runner(made);
  const fireflies = made.fireflies;
  river.run(30);
  const last = new Float64Array(fireflies.n).fill(-1);
  const turns = Float64Array.from(fireflies.turns);
  let fastest = 0;
  let shortest = Infinity;
  let next = river.t;
  river.run(20, (t) => {
    if (t >= next) {
      river.keeper.tap(t, 0.5, 0.6);
      next += 60 / 160;
    }
    for (let i = 0; i < fireflies.n; i++) {
      fastest = Math.max(fastest, fireflies.pace[i]);
      if (fireflies.turns[i] !== turns[i]) {
        if (last[i] >= 0) shortest = Math.min(shortest, t - last[i]);
        last[i] = t;
        turns[i] = fireflies.turns[i];
      }
    }
  });
  assert.ok(fastest <= S.FASTEST + 1e-9 && S.FASTEST <= 2.67, `a pace of ${fastest}`);
  assert.ok(shortest >= 1 / S.FASTEST - S.STEP, `two flashes ${shortest.toFixed(3)} s apart`);
});

test('one seed always grows the same mangroves, and another grows different ones', () => {
  const a = growBank(1136, 620);
  const b = growBank(1136, 620, SEED);
  assert.deepEqual(a, b);
  assert.notDeepEqual(growBank(1136, 620, SEED + 1).rows[2].trees[0].segments, a.rows[2].trees[0].segments);
  // Three rows, far to near, each across the whole width; a phone's card gets two or three near trees.
  assert.equal(a.rows.length, 3);
  for (const row of a.rows) {
    // No row ends in the picture: its leaves reach past both edges.
    const clumps = row.trees.flatMap((t) => t.clumps);
    assert.ok(Math.min(...clumps.map(([x, , r]) => x - r)) < 0 && Math.max(...clumps.map(([x, , r]) => x + r)) > 1136);
    for (const tree of row.trees) assert.ok(tree.segments.length > 20 && tree.clumps.length > 20 && tree.roots.length > 3);
  }
  const phone = plant(343, 291).rows[2].plants.filter((p) => p.x > -40 && p.x < 343 + 40);
  assert.ok(phone.length >= 2 && phone.length <= 4, `${phone.length} near trees on a phone`);
  // The fireflies sit on the leaves, on the stage.
  const spots = scatter(a.rows[1].trees, 500, 1136, seeded(1));
  for (let i = 0; i < 500; i++) assert.ok(spots[i * 2] >= 0 && spots[i * 2] <= 1136 && spots[i * 2 + 1] < a.waterline);
});

test("the lanterns: one for each of the wall's notes, in its paper, pinned in front and larger, buttons clear of each other", () => {
  const note = (id, extra = {}) => ({ id, name: `N${id}`, website: null, message: 'Hello', created_at: '2026-10-09T12:25:05Z', pinned: 0, reply: null, reply_at: null, ...extra });
  const wall = [note(13, { pinned: 1 }), note(2, { message: 'x'.repeat(300) }), note(5), note(7), note(11), note(16), note(20), note(23), note(31)];
  for (const [width, height] of [[1136, 620], [343, 291], [343, 436]]) {
    const lanterns = hang(wall, { width, height, waterline: Math.round(height * 0.6) });
    assert.equal(lanterns.length, wall.length);
    assert.deepEqual(lanterns.map((l) => l.note.id).sort((a, b) => a - b), wall.map((n) => n.id).sort((a, b) => a - b));
    for (const l of lanterns) {
      assert.equal(l.colour, lookOf(l.note.id).colour);
      assert.ok(l.button >= BUTTON, `${l.button} px button`);
      assert.ok(l.x - l.button / 2 >= 0 && l.x + l.button / 2 <= width, `lantern ${l.note.id} off the stage at ${width}`);
    }
    for (let i = 0; i < lanterns.length; i++) {
      for (let j = i + 1; j < lanterns.length; j++) {
        const a = lanterns[i];
        const b = lanterns[j];
        const apart = Math.abs(a.x - b.x) >= (a.button + b.button) / 2 || Math.abs(a.y - b.y) >= (a.button + b.button) / 2;
        assert.ok(apart, `the buttons of ${a.note.id} and ${b.note.id} overlap at ${width}`);
      }
    }
    const pinned = lanterns.find((l) => l.note.id === 13);
    const plain = lanterns.find((l) => l.note.id === 5);
    assert.equal(pinned.row, 0);
    assert.ok(Math.abs(pinned.x - width / 2) < width * 0.2);
    assert.ok(pinned.height > plain.height * (PINNED - 0.2));
    // A longer message makes a larger lantern, in the same row.
    const long = lanterns.find((l) => l.note.id === 2);
    const short = lanterns.find((l) => l.row === long.row && l.note.id !== 2 && !l.note.pinned);
    assert.ok(long.height > short.height);
  }
  // A note hangs in the same place every visit; a lone note hangs in front.
  assert.deepEqual(hang([note(2)], { width: 1136, height: 620, waterline: 372 }), hang([note(2)], { width: 1136, height: 620, waterline: 372 }));
  assert.equal(hang([note(2)], { width: 1136, height: 620, waterline: 372 })[0].row, 0);
  assert.deepEqual(hang([], { width: 1136, height: 620, waterline: 372 }), []);
});
