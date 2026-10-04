import { test } from 'node:test';
import assert from 'node:assert/strict';
import { move, newGame } from '../src/games/2048/rules.js';
import { botMove, DIRECTIONS } from '../src/games/2048/bot.js';

// A game from rows of numbers (0 is an empty cell), as in game-2048.test.js.
const game = (rows) => {
  let id = 1;
  const tiles = rows.flatMap((row, y) => row.map((value, x) => ({ id: id++, value, x, y })).filter((t) => t.value));
  return { tiles, score: 0, won: false, over: false, nextId: 100 };
};
// A repeatable "random", so a game plays out the same every run.
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

test('the bot always picks a direction that moves something', () => {
  const random = seeded(7);
  let g = newGame(random);
  for (let i = 0; i < 150 && !g.over; i++) {
    const d = botMove(g);
    assert.ok(DIRECTIONS.includes(d), `move ${i}: ${d}`);
    const r = move(g, d, random);
    assert.ok(r.moved, `move ${i}: ${d} moved nothing`);
    g = r.game;
  }
});

test('on a full board with one join left, the bot makes it', () => {
  // Only left and right do anything: they join the two 2s.
  const g = game([[2, 2, 8, 16], [8, 16, 32, 64], [16, 32, 64, 128], [32, 64, 128, 256]]);
  assert.ok(['left', 'right'].includes(botMove(g)));
});

test('a finished board gets no move', () => {
  const g = game([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]);
  assert.equal(botMove({ ...g, over: true }), null);
  assert.equal(botMove(g), null);
});

test('the bot takes an obvious join of the two biggest tiles', () => {
  const g = game([[1024, 1024, 0, 0], [4, 2, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0]]);
  const d = botMove(g);
  assert.ok(['left', 'right'].includes(d), d);
  assert.ok(move(g, d, () => 0).game.tiles.some((t) => t.value === 2048));
});

test('the bot keeps the biggest tile in its corner when it can', () => {
  // 512 in the top left with its row falling away from it. Up and left move nothing; down would pull the 512 out of
  // its corner, right keeps it there.
  const g = game([[512, 256, 128, 64], [2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.equal(botMove(g), 'right');
});
