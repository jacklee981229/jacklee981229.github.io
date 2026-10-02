import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyAt, KEYS, PARTS, ROWS, SHOWS } from '../src/effects/key-jam.js';
import { KINDS, SETS } from '../src/effects/synth.js';

test('every letter key has a part: a sound that exists, a note the scale has, and a show that exists', () => {
  assert.equal(KEYS.length, 26);
  assert.equal(new Set(KEYS).size, 26);
  assert.equal([...KEYS].sort().join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  assert.equal(PARTS.length, KEYS.length);
  for (const [sound, n, show] of PARTS) {
    assert.ok(KINDS.includes(sound), `no sound "${sound}"`);
    assert.ok(show in SHOWS, `no show "${show}"`);
    // A chord reaches four notes further up the scale than the one it starts on.
    assert.ok(Number.isInteger(n) && n >= 0 && n + (sound === 'chord' ? 4 : 0) <= 9, `${sound} ${n} is off the scale`);
  }
});

test('every set has a ten-note scale going up, and a voice', () => {
  for (const set of SETS) {
    assert.equal(set.steps.length, 10);
    assert.deepEqual([...set.steps].sort((a, b) => a - b), set.steps);
    assert.ok(['wood', 'bell', 'chip'].includes(set.voice));
  }
});

test('every show lasts a moment and can be drawn', () => {
  for (const [name, [seconds, draw]] of Object.entries(SHOWS)) {
    assert.ok(seconds > 0.3 && seconds < 1.5, name);
    assert.equal(typeof draw, 'function', name);
  }
});

test('a tap lands on the key whose patch of the stage it is in: three rows, each shared among its keys', () => {
  const [w, h] = [900, 300];
  ROWS.forEach((row, r) => {
    [...row].forEach((letter, i) => {
      assert.equal(keyAt(((i + 0.5) / row.length) * w, ((r + 0.5) / ROWS.length) * h, w, h), letter);
    });
  });
  // The corners, and a little outside them, still land on the nearest key.
  assert.equal(keyAt(0, 0, w, h), 'Q');
  assert.equal(keyAt(w, 0, w, h), 'P');
  assert.equal(keyAt(-5, h + 5, w, h), 'Z');
  assert.equal(keyAt(w, h, w, h), 'M');
  // Just either side of the line between two keys.
  assert.equal(keyAt(w / 10 - 0.01, 10, w, h), 'Q');
  assert.equal(keyAt(w / 10 + 0.01, 10, w, h), 'W');
  assert.equal(keyAt(10, h / 3 + 0.01, w, h), 'A');
});
