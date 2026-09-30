import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, placeFood, SIZE, step, stepMs, turn } from '../src/games/snake/rules.js';

// A game with a given snake (head first) and food, heading `dir`.
const game = (snake, food = null, dir = 'right') => ({ snake: snake.map(([x, y]) => ({ x, y })), dir, queue: [], food: food && { x: food[0], y: food[1] }, score: 0, over: null });
const cells = (g) => g.snake.map((c) => [c.x, c.y]);

test('a new game: three cells heading right, food somewhere free', () => {
  const g = newGame(() => 0);
  assert.deepEqual(cells(g), [[4, 8], [3, 8], [2, 8]]);
  assert.equal(g.dir, 'right');
  assert.ok(!g.snake.some((c) => c.x === g.food.x && c.y === g.food.y));
});

test('each step moves the head forward and the rest follows', () => {
  const { game: g, event } = step(game([[4, 8], [3, 8], [2, 8]], [10, 10]));
  assert.equal(event, 'moved');
  assert.deepEqual(cells(g), [[5, 8], [4, 8], [3, 8]]);
});

test('turns wait in line, two at most, and a turn back into the neck is ignored', () => {
  let g = game([[4, 8], [3, 8], [2, 8]], [10, 10]);
  assert.equal(turn(g, 'left'), g);
  assert.equal(turn(g, 'right'), g);
  g = turn(turn(g, 'up'), 'left');
  assert.deepEqual(g.queue, ['up', 'left']);
  assert.deepEqual(turn(g, 'down').queue, ['up', 'left']);
  g = step(g).game;
  assert.deepEqual(cells(g)[0], [4, 7]);
  g = step(g).game;
  assert.deepEqual(cells(g)[0], [3, 7]);
  assert.equal(g.dir, 'left');
});

test('eating grows the snake by one, scores a point and puts new food on a free cell', () => {
  const { game: g, event } = step(game([[4, 8], [3, 8], [2, 8]], [5, 8]), () => 0);
  assert.equal(event, 'ate');
  assert.deepEqual(cells(g), [[5, 8], [4, 8], [3, 8], [2, 8]]);
  assert.equal(g.score, 1);
  assert.ok(!g.snake.some((c) => c.x === g.food.x && c.y === g.food.y));
});

test('a wall ends the game where it stands', () => {
  const start = game([[SIZE - 1, 3], [SIZE - 2, 3], [SIZE - 3, 3]], [0, 0]);
  const { game: g, event } = step(start);
  assert.equal(event, 'crashed');
  assert.equal(g.over, 'crashed');
  assert.deepEqual(cells(g), cells(start));
});

test('with the walls open, the head goes through a wall and comes back in on the opposite side', () => {
  const open = (snake, dir) => ({ ...game(snake, [8, 8], dir), wrap: true });
  const through = (snake, dir) => {
    const r = step(open(snake, dir));
    assert.equal(r.event, 'moved');
    return cells(r.game);
  };
  assert.deepEqual(through([[SIZE - 1, 3], [SIZE - 2, 3], [SIZE - 3, 3]], 'right'), [[0, 3], [SIZE - 1, 3], [SIZE - 2, 3]]);
  assert.deepEqual(through([[0, 3], [1, 3], [2, 3]], 'left')[0], [SIZE - 1, 3]);
  assert.deepEqual(through([[5, 0], [5, 1], [5, 2]], 'up')[0], [5, SIZE - 1]);
  assert.deepEqual(through([[5, SIZE - 1], [5, SIZE - 2], [5, SIZE - 3]], 'down')[0], [5, 0]);
  // Food just past the wall is eaten there.
  const r = step({ ...game([[SIZE - 1, 3], [SIZE - 2, 3], [SIZE - 3, 3]], [0, 3]), wrap: true }, () => 0);
  assert.equal(r.event, 'ate');
  assert.deepEqual(cells(r.game)[0], [0, 3]);
});

test('with the walls open, running into itself on the other side still ends the game', () => {
  // Heading right at the right wall, curled back through it: its own body waits just across the wall, at (0, 3).
  const start = { ...game([[SIZE - 1, 3], [SIZE - 2, 3], [SIZE - 2, 4], [SIZE - 1, 4], [0, 4], [0, 3], [0, 2]], [8, 8]), wrap: true };
  assert.equal(step(start).event, 'crashed');
});

test('a new game has the walls closed unless asked', () => {
  assert.equal(newGame(() => 0).wrap, false);
  assert.equal(newGame(() => 0, true).wrap, true);
});

test('biting itself ends the game, but the cell the tail is leaving is free', () => {
  // Both snakes are heading up (the neck is below the head). A hook: turning left runs into the body.
  const hook = turn(game([[5, 5], [5, 6], [4, 6], [4, 5], [4, 4], [5, 4]], [0, 0], 'up'), 'left');
  assert.equal(step(hook).event, 'crashed');
  // A square of four: turning left moves into the tail's cell, which is fine, as the tail moves on.
  const square = turn(game([[5, 5], [5, 6], [4, 6], [4, 5]], [0, 0], 'up'), 'left');
  const r = step(square);
  assert.equal(r.event, 'moved');
  assert.deepEqual(cells(r.game)[0], [4, 5]);
});

test('filling the whole board ends the game as a win', () => {
  // A snake winding over every cell but the last, its head next to the food there.
  const path = [];
  for (let y = 0; y < SIZE; y++) for (let i = 0; i < SIZE; i++) path.push([y % 2 ? SIZE - 1 - i : i, y]);
  const food = path.pop();
  const { game: g, event } = step(game(path.reverse(), food, 'left'));
  assert.equal(event, 'filled');
  assert.equal(g.over, 'filled');
  assert.equal(g.snake.length, SIZE * SIZE);
  assert.equal(placeFood(g.snake), null);
});

test('the snake speeds up as it scores, 3 ms a point, to a floor at 27 points', () => {
  assert.equal(stepMs(0), 150);
  assert.equal(stepMs(10), 120);
  assert.equal(stepMs(26), 72);
  assert.equal(stepMs(27), 70);
  assert.equal(stepMs(100), 70);
});
