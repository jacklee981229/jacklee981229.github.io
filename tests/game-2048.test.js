import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canMove, emptyCells, move, newGame, spawn, undo } from '../src/games/2048/rules.js';

// A game from rows of numbers (0 is an empty cell).
const game = (rows, extra = {}) => {
  let id = 1;
  const tiles = rows.flatMap((row, y) => row.map((value, x) => ({ id: id++, value, x, y })).filter((t) => t.value));
  return { tiles, score: 0, won: false, over: false, nextId: 100, ...extra };
};
// The board as rows of numbers again.
const rows = (g) => [0, 1, 2, 3].map((y) => [0, 1, 2, 3].map((x) => g.tiles.find((t) => t.x === x && t.y === y)?.value ?? 0));
// Fixed "randoms": the new tile goes in the first empty cell as a 2, or in the last empty cell (bottom right) as a 4.
const first = () => 0;
const last = () => 0.99;

test('equal tiles join as they slide, each only once per move', () => {
  const r = move(game([[2, 2, 2, 2], [2, 2, 4, 0], [4, 0, 4, 8], [0, 0, 0, 0]]), 'left', last);
  assert.deepEqual(rows(r.game).slice(0, 3), [[4, 4, 0, 0], [4, 4, 0, 0], [8, 8, 0, 0]]);
  assert.equal(r.gained, 4 + 4 + 4 + 8);
  assert.equal(r.game.score, 20);
  assert.equal(r.merged.length, 4);
});

test('every direction slides towards its own edge', () => {
  const start = [[2, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 0, 0]];
  assert.deepEqual(rows(move(game(start), 'right', last).game)[0], [0, 0, 0, 4]);
  assert.deepEqual(rows(move(game(start), 'down', last).game).map((r) => r[0]), [0, 0, 0, 4]);
  assert.deepEqual(rows(move(game(start), 'up', last).game).map((r) => r[0]), [4, 0, 0, 0]);
});

test('three equal tiles: the two nearest the edge join', () => {
  assert.deepEqual(rows(move(game([[2, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'right', last).game)[0], [0, 0, 2, 4]);
});

test('a move that changes nothing does nothing: no new tile, same game', () => {
  const g = game([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const r = move(g, 'left', first);
  assert.equal(r.moved, false);
  assert.equal(r.game, g);
  assert.equal(r.spawned, null);
});

test('after a move, one new tile lands in an empty cell: a 2, or a 4 one time in ten', () => {
  const g = game([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const two = move(g, 'right', () => 0.5);
  assert.equal(two.game.tiles.length, 2);
  assert.equal(two.spawned.value, 2);
  assert.ok(!(two.spawned.x === 3 && two.spawned.y === 0), 'not on the moved tile');
  const four = spawn(g, () => 0.95).tile;
  assert.equal(four.value, 4);
  assert.equal(emptyCells(g.tiles).length, 15);
});

test('ids let the screen follow tiles: joined pairs slide to one cell and a new tile replaces them', () => {
  const r = move(game([[4, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left', last);
  const [pair] = r.merged;
  assert.deepEqual(pair.from, [1, 2]);
  assert.equal(pair.id, 100);
  assert.deepEqual(r.slid.filter((s) => pair.from.includes(s.id)).map((s) => [s.x, s.y]), [[0, 0], [0, 0]]);
  assert.equal(r.game.nextId, 102);
});

test('making 2048 wins, and the game can go on', () => {
  const r = move(game([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left', first);
  assert.equal(r.game.won, true);
  assert.equal(r.game.over, false);
});

test('the game is over when the board is full and no neighbours match', () => {
  assert.equal(canMove(game([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]).tiles), false);
  assert.equal(canMove(game([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 4]]).tiles), true);
  assert.equal(canMove(game([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]]).tiles), true);
  // The last row slides to 4 2 4, and the new 2 fills the final cell with no neighbour to match.
  const end = move(game([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [0, 4, 2, 4]]), 'left', () => 0.5);
  assert.deepEqual(rows(end.game)[3], [4, 2, 4, 2]);
  assert.equal(end.game.over, true);
});

test('a new game starts with two tiles', () => {
  assert.equal(newGame().tiles.length, 2);
});

test('undo takes back the last move, once: move, undo, move, undo works; two undos in a row do not', () => {
  const start = game([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.equal(undo(start), start, 'nothing to take back before the first move');
  assert.equal(undo(newGame()).tiles.length, 2);

  const one = move(start, 'left', last).game;
  assert.equal(one.score, 4);
  const back = undo(one);
  // The same tiles with the same ids, so the screen can slide them back; the score and the next id too.
  assert.deepEqual(back.tiles, start.tiles);
  assert.deepEqual([back.score, back.nextId, back.won, back.over], [0, 100, false, false]);
  assert.equal(undo(back), back, 'not twice in a row');

  const two = move(back, 'right', last).game;
  assert.deepEqual(rows(two)[0], [0, 0, 0, 4]);
  assert.deepEqual(rows(undo(two)), rows(start), 'move, undo, move, undo');
});

test('undo goes back one move only, however many were made', () => {
  const start = game([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const afterOne = move(start, 'left', last).game;
  const afterTwo = move(afterOne, 'down', last).game;
  const once = undo(afterTwo);
  assert.deepEqual(rows(once), rows(afterOne));
  assert.equal(once.score, afterOne.score);
  assert.equal(undo(once), once);
  // What's kept (and saved with the game) is one game back, never a chain of them.
  assert.equal(afterTwo.back.back, null);
  // A key that moves nothing leaves the move before it there to take back.
  const stuck = move(afterTwo, 'down', last);
  assert.equal(stuck.moved, false);
  assert.deepEqual(rows(undo(stuck.game)), rows(afterOne));
});

test('undo also takes back a win or an end that the move brought', () => {
  const won = move(game([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left', first).game;
  assert.equal(won.won, true);
  assert.equal(undo(won).won, false);
  const end = move(game([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [0, 4, 2, 4]]), 'left', () => 0.5).game;
  assert.equal(end.over, true);
  const again = undo(end);
  assert.equal(again.over, false);
  assert.equal(move(again, 'left', () => 0.5).moved, true);
  // A game already won stays won when a later move is taken back.
  const later = move(move(game([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left', first).game, 'right', first).game;
  assert.equal(undo(later).won, true);
});
