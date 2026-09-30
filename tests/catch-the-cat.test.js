import { test } from 'node:test';
import assert from 'node:assert/strict';
import { block, catMove, colOf, isEdge, neighbours, newGame, rowOf, SIZE, START, START_BLOCKS } from '../src/games/catch-the-cat/rules.js';

const at = (row, col) => row * SIZE + col;
const game = (cat, blocked = []) => ({ blocked: [...blocked].sort((a, b) => a - b), cat, moves: 0, over: null });

test('each dot touches its six neighbours, fewer at the edges; odd rows lean right', () => {
  assert.deepEqual(neighbours(at(4, 4)), [at(4, 3), at(4, 5), at(3, 3), at(3, 4), at(5, 3), at(5, 4)]);
  assert.deepEqual(neighbours(at(5, 5)), [at(5, 4), at(5, 6), at(4, 5), at(4, 6), at(6, 5), at(6, 6)]);
  assert.deepEqual(neighbours(at(0, 0)), [at(0, 1), at(1, 0)]);
  assert.deepEqual(neighbours(at(1, 10)), [at(1, 9), at(0, 10), at(2, 10)]);
});

test('the edge is the outer ring of dots', () => {
  assert.ok(isEdge(at(0, 5)) && isEdge(at(5, 0)) && isEdge(at(10, 5)) && isEdge(at(5, 10)));
  assert.ok(!isEdge(at(1, 1)) && !isEdge(START));
  assert.equal(rowOf(START), 5);
  assert.equal(colOf(START), 5);
});

test('a new game: the cat in the middle, a few dots blocked, never under the cat and never all round it', () => {
  let n = 0;
  const seeded = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  for (let round = 0; round < 50; round++) {
    const g = newGame(seeded);
    assert.equal(g.cat, START);
    assert.equal(new Set(g.blocked).size, START_BLOCKS);
    assert.ok(!g.blocked.includes(START));
    assert.notEqual(catMove(g), null);
  }
});

test('the cat heads for the nearest edge', () => {
  assert.equal(catMove(game(at(5, 2))), at(5, 1));
  assert.equal(rowOf(catMove(game(at(2, 5)))), 1, 'from row 2 it steps up to row 1');
});

test('the cat goes around blocked dots', () => {
  const next = catMove(game(at(5, 2), [at(5, 1)]));
  assert.notEqual(next, at(5, 1));
  assert.ok([at(4, 1), at(6, 1), at(4, 2), at(6, 2)].includes(next), `went to row ${rowOf(next)}, column ${colOf(next)}`);
});

test('the cat reaching the edge loses the game', () => {
  const r = block(game(at(1, 1)), at(8, 8));
  assert.equal(r.played, true);
  assert.ok(isEdge(r.game.cat));
  assert.equal(r.game.over, 'lost');
});

test('blocking the last way out traps the cat and wins', () => {
  const around = neighbours(START);
  const r = block(game(START, around.slice(1)), around[0]);
  assert.equal(r.game.over, 'won');
  assert.equal(r.catTo, null);
  assert.equal(r.game.moves, 1);
});

test('a walled-in cat keeps wandering until it is trapped', () => {
  // A ring of blocks around the middle: no way out, but room to move.
  const ring = [...new Set(neighbours(START).flatMap((n) => neighbours(n)))].filter((i) => i !== START && !neighbours(START).includes(i));
  const r = block(game(START, ring), at(0, 0));
  assert.equal(r.game.over, null);
  assert.ok(neighbours(START).includes(r.game.cat), 'it stepped inside its pen');
});

test('the cat, a blocked dot or a finished game ignore clicks', () => {
  const g = game(START, [at(2, 2)]);
  assert.equal(block(g, START).played, false);
  assert.equal(block(g, at(2, 2)).played, false);
  assert.equal(block({ ...g, over: 'won' }, at(3, 3)).played, false);
  assert.equal(block(g, -1).played, false);
});
