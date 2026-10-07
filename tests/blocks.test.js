import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bag, cells, dropMs, drop, fits, ghost, HEIGHT, HIDDEN, hardDrop, hold, inDanger, levelOf, lock, move, newGame, PIECES, rotate, settleSounds, WIDTH } from '../src/games/blocks/rules.js';

const ROWS = HEIGHT + HIDDEN;
// A well from the bottom rows up: '#' is a filled cell, '.' an empty one; the rows above are empty.
const wellOf = (...bottom) => [...Array.from({ length: ROWS - bottom.length }, () => Array(WIDTH).fill('')), ...bottom.map((r) => [...r].map((c) => (c === '#' ? 'X' : '')))];
const game = (well, piece, extra = {}) => ({ well, piece, next: 'T', bag: ['I', 'O'], held: null, canHold: true, score: 0, lines: 0, over: false, ...extra });
const at = (piece) => cells(piece).map(({ x, y }) => `${x},${y}`).sort().join(' ');

test('every seven pieces are the seven different ones', () => {
  let n = 0;
  const random = () => ((n = (n * 7 + 3) % 11) / 11);
  for (let round = 0; round < 3; round++) assert.deepEqual([...bag(random)].sort(), [...PIECES].sort());
});

test('a new game starts with a piece at the top of an empty well', () => {
  const g = newGame(() => 0);
  assert.equal(g.over, false);
  assert.equal(g.score, 0);
  assert.ok(cells(g.piece).every(({ y }) => y === HIDDEN - 1 || y === HIDDEN));
});

test('turning the T piece clockwise and back', () => {
  const t = { type: 'T', turn: 0, x: 3, y: 5 };
  assert.equal(at(t), '3,6 4,5 4,6 5,6');
  assert.equal(at({ ...t, turn: 1 }), '4,5 4,6 4,7 5,6');
  const well = wellOf();
  assert.deepEqual(rotate(game(well, t), 1).piece, { ...t, turn: 1 });
  assert.deepEqual(rotate(game(well, t), -1).piece, { ...t, turn: 3 });
});

test('walls stop a move, and a turn against a wall is nudged in', () => {
  const well = wellOf();
  const g = game(well, { type: 'I', turn: 1, x: -2, y: 5 });
  assert.ok(cells(g.piece).every(({ x }) => x === 0));
  assert.equal(move(g, -1), g);
  const turned = rotate(g, 1);
  assert.notEqual(turned, g);
  assert.ok(fits(well, turned.piece));
  assert.ok(cells(turned.piece).every(({ x }) => x >= 0 && x < WIDTH));
});

test('a piece falls a row at a time until it lands', () => {
  const well = wellOf('##########');
  let g = game(well, { type: 'O', turn: 0, x: 4, y: 17 });
  let r = drop(g);
  assert.equal(r.moved, true);
  g = r.game;
  r = drop(g);
  assert.equal(r.moved, true);
  r = drop(r.game);
  assert.equal(r.moved, false);
  assert.equal(ghost(g).y, 19);
});

test('a soft drop scores a point a row; a hard drop two, and sets the piece', () => {
  const g = game(wellOf(), { type: 'O', turn: 0, x: 4, y: 10 });
  assert.equal(drop(g, true).game.score, 1);
  const r = hardDrop(g, () => 0);
  assert.equal(r.game.score, 2 * (ROWS - 2 - 10));
  assert.equal(r.merged[ROWS - 1][4], 'O');
});

test('clearing 1, 2, 3 or 4 rows at once scores 100, 300, 500 or 800 times the level', () => {
  const nearlyFull = '#########.';
  for (const [rows, points] of [[1, 100], [2, 300], [3, 500], [4, 800]]) {
    const well = wellOf(...Array(rows).fill(nearlyFull));
    const upright = { type: 'I', turn: 1, x: 7, y: ROWS - 4 };
    const r = lock(game(well, upright), () => 0);
    assert.equal(r.cleared.length, rows, `${rows} rows`);
    assert.equal(r.game.lines, rows);
    assert.equal(r.game.score, points);
    const doubled = lock(game(well, upright, { lines: 10 }), () => 0);
    assert.equal(doubled.game.score, points * 2, `level 2 doubles ${rows} rows`);
  }
});

test('cleared rows go, and the rows above come down', () => {
  const well = wellOf('#.........', '#########.');
  const r = lock(game(well, { type: 'I', turn: 1, x: 7, y: ROWS - 4 }), () => 0);
  assert.deepEqual(r.cleared, [ROWS - 1]);
  assert.equal(r.game.well[ROWS - 1][0], 'X');
  assert.equal(r.game.well[ROWS - 1][9], 'I');
});

test('the game is over when a new piece has no room at the top', () => {
  // Blocks already fill the top visible row where the next piece (a T) arrives.
  const well = wellOf();
  for (let x = 3; x <= 6; x++) well[HIDDEN][x] = 'X';
  const r = lock(game(well, { type: 'O', turn: 0, x: 0, y: ROWS - 2 }), () => 0);
  assert.equal(r.game.over, true);
  assert.equal(lock(game(wellOf(), { type: 'O', turn: 0, x: 0, y: ROWS - 2 }), () => 0).game.over, false);
});

test('holding sets the piece aside: the next comes in, and later the held one swaps back in at the top', () => {
  const falling = { type: 'S', turn: 1, x: 5, y: 9 };
  const first = hold(game(wellOf(), falling), () => 0);
  assert.equal(first.held, 'S');
  assert.equal(first.piece.type, 'T');
  assert.equal(first.next, 'I');
  assert.equal(first.canHold, false);
  // Once per piece: a second hold waits until a piece sets.
  assert.equal(hold(first), first);
  const set = hardDrop(first, () => 0).game;
  assert.equal(set.over, false);
  assert.equal(set.canHold, true);
  const swapped = hold(set);
  assert.equal(swapped.piece.type, 'S');
  assert.deepEqual({ turn: swapped.piece.turn, y: swapped.piece.y }, { turn: 0, y: HIDDEN - 1 });
  assert.equal(swapped.held, set.piece.type);
  assert.equal(swapped.canHold, false);
});

test('a piece setting clicks, a hard drop thuds instead, and rows chime', () => {
  assert.deepEqual(settleSounds(0, 0, 0, false, 0), { sounds: [['set', 0, 0, 0]], combo: 0 });
  assert.deepEqual(settleSounds(0, 0, 0, true, 0), { sounds: [['drop', 0, 0, 0]], combo: 0 });
  assert.deepEqual(settleSounds(0, 2, 2, false, 0), { sounds: [['rows', 2, 0, 0]], combo: 1 });
  assert.deepEqual(settleSounds(0, 3, 3, true, 0), { sounds: [['drop', 0, 0, 0], ['rows', 3, 0, 0]], combo: 1 });
  assert.deepEqual(settleSounds(0, 4, 4, true, 0).sounds, [['drop', 0, 0, 0], ['four', 4, 0, 0]]);
});

test('rows cleared with pieces one after another lift the chime a step each, up to eight; a piece clearing nothing ends it', () => {
  let combo = 0;
  const steps = [];
  for (let piece = 0; piece < 11; piece++) {
    const r = settleSounds(piece, piece + 1, 1, false, combo);
    steps.push(r.sounds[0][2]);
    combo = r.combo;
  }
  assert.deepEqual(steps, [0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8]);
  assert.equal(settleSounds(11, 11, 0, false, combo).combo, 0);
});

test('a new level rings a moment after the rows that reach it', () => {
  assert.deepEqual(settleSounds(9, 10, 1, false, 0).sounds, [['rows', 1, 0, 0], ['level', 0, 0, 0.35]]);
  assert.equal(settleSounds(8, 9, 1, false, 0).sounds.length, 1);
});

test('the pile is in danger once a block reaches the top six visible rows', () => {
  const well = Array.from({ length: ROWS }, () => Array(WIDTH).fill(''));
  assert.equal(inDanger(well), false);
  well[HIDDEN + 6][0] = 'X';
  assert.equal(inDanger(well), false);
  well[HIDDEN + 5][5] = 'X';
  assert.equal(inDanger(well), true);
});

test('levels come every 10 rows, and pieces fall quicker each level, to a floor', () => {
  assert.equal(levelOf(0), 1);
  assert.equal(levelOf(9), 1);
  assert.equal(levelOf(10), 2);
  assert.equal(dropMs(1), 800);
  assert.ok(dropMs(2) < dropMs(1));
  assert.equal(dropMs(40), 60);
});
