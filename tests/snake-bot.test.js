import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, step, turn } from '../src/games/snake/rules.js';
import { botMove } from '../src/games/snake/bot.js';

// A game with a given snake (head first) and food, heading `dir`, as in snake.test.js.
const game = (snake, food, dir = 'right', wrap = false) => ({ snake: snake.map(([x, y]) => ({ x, y })), dir, queue: [], food: food && { x: food[0], y: food[1] }, score: 0, over: null, wrap });
// A repeatable "random", so a game plays out the same every run.
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

test('in a corner with one way out, the bot takes it', () => {
  // Top right corner heading right: right and up are walls, left is its own neck.
  assert.equal(botMove(game([[15, 0], [14, 0], [13, 0]], [0, 15])), 'down');
  // Coiled in the middle, walls or none: the body on three sides, and the only way out is the cell its tail is
  // leaving.
  const coiled = [[5, 5], [4, 5], [4, 4], [5, 4], [6, 4], [6, 5], [6, 6], [5, 6]];
  assert.equal(botMove(game(coiled, [12, 12])), 'down');
  assert.equal(botMove(game(coiled, [12, 12], 'right', true)), 'down');
});

test('on an open board the bot heads straight for the food', () => {
  assert.equal(botMove(game([[4, 8], [3, 8], [2, 8]], [10, 8])), 'right');
  assert.equal(botMove(game([[4, 8], [3, 8], [2, 8]], [4, 3])), 'up');
});

test('with no walls the bot takes the short way through one', () => {
  // The food is two cells away through the right wall, fourteen the other way.
  assert.equal(botMove(game([[15, 0], [14, 0], [13, 0]], [1, 0], 'right', true)), 'right');
});

test("the bot doesn't eat food that would shut it in", () => {
  // The food is in the top left corner, beside the head. Eating it leaves the head with its own body on both sides,
  // which the simple "closest to the food" snake would walk into.
  const g = game([[1, 0], [1, 1], [0, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2]], [0, 0], 'up');
  assert.equal(botMove(g), 'right');
});

test('a finished game gets no move', () => {
  assert.equal(botMove({ ...game([[4, 8], [3, 8], [2, 8]], [10, 8]), over: 'crashed' }), null);
});

for (const wrap of [false, true]) {
  test(`whole games ${wrap ? 'with no walls' : 'with walls'}: each ends, nearly filling the board`, () => {
    const scores = [];
    for (let seed = 1; seed <= 20; seed++) {
      const random = seeded(seed);
      let g = newGame(random, wrap);
      let hungry = 0;
      // Far more steps than any game takes, so a bot circling for ever fails here rather than hanging the tests.
      for (let i = 0; i < 100000 && !g.over; i++) {
        const r = step(turn(g, botMove(g, hungry)), random);
        g = r.game;
        hungry = r.event === 'ate' ? 0 : hungry + 1;
      }
      assert.ok(g.over, `seed ${seed} never ended`);
      scores.push(g.score);
    }
    // The board holds 253 points; measured on 2 Nov 2026, these games average about 250.
    const average = scores.reduce((a, b) => a + b) / scores.length;
    assert.ok(average >= 240, `average ${average}: ${scores.join(' ')}`);
  });
}
