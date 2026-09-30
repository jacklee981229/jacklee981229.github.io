// Snake's rules (贪吃蛇), kept apart from the board on screen so tests can check them (tests/snake.test.js).
// The board is SIZE by SIZE cells; a cell is { x, y }, x the column (0 is left) and y the row (0 is top). The snake
// is a list of cells from head to tail, and moves one cell a step in its direction.

export const SIZE = 16;
const START_LENGTH = 3;
const DIRECTIONS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** @typedef {{ x: number, y: number }} Cell */
/**
 * @typedef {{ snake: Cell[], dir: string, queue: string[], food: Cell | null, score: number, over: null | 'crashed' | 'filled', wrap?: boolean }} Game
 * `queue` holds turns asked for but not yet taken; `over` says how the game ended; `wrap` opens the walls, so the
 * snake goes through one and comes back in on the opposite side.
 */

/** A random empty cell, or null when the snake fills the board. @param {Cell[]} snake */
export function placeFood(snake, random = Math.random) {
  const taken = new Set(snake.map((c) => c.y * SIZE + c.x));
  const free = [];
  for (let i = 0; i < SIZE * SIZE; i++) if (!taken.has(i)) free.push(i);
  if (!free.length) return null;
  const i = free[Math.floor(random() * free.length)];
  return { x: i % SIZE, y: Math.floor(i / SIZE) };
}

/** A new game: a short snake on the left, heading right, and food somewhere free; `wrap` opens the walls. */
export function newGame(random = Math.random, wrap = false) {
  const y = SIZE / 2;
  const snake = Array.from({ length: START_LENGTH }, (_, i) => ({ x: START_LENGTH + 1 - i, y }));
  return { snake, dir: 'right', queue: [], food: placeFood(snake, random), score: 0, over: null, wrap };
}

/**
 * Asks the snake to turn at its next step. Up to two turns wait in line, so a quick "up, then left" between two
 * steps isn't lost. A turn straight back into its own neck, or the way it's already going, is ignored.
 * @param {Game} game @param {string} dir
 */
export function turn(game, dir) {
  const last = game.queue.at(-1) ?? game.dir;
  if (game.over || !DIRECTIONS[dir] || dir === last || dir === OPPOSITE[last] || game.queue.length >= 2) return game;
  return { ...game, queue: [...game.queue, dir] };
}

/**
 * One step: the snake takes its next waiting turn, then moves a cell. Eating the food grows it by one and scores a
 * point; running into itself ends the game, and so does a wall unless the walls are open (`wrap`). The tail's cell
 * is free to move into, since the tail leaves it in the same step, unless the snake is growing. Returns the game and
 * what happened: 'moved', 'ate', 'crashed' or 'filled' (the snake fills the board, so there's nowhere left for food).
 * @param {Game} game
 */
export function step(game, random = Math.random) {
  if (game.over) return { game, event: null };
  const [dir, ...queue] = game.queue.length ? game.queue : [game.dir];
  const d = DIRECTIONS[dir];
  const ahead = { x: game.snake[0].x + d.x, y: game.snake[0].y + d.y };
  const head = game.wrap ? { x: (ahead.x + SIZE) % SIZE, y: (ahead.y + SIZE) % SIZE } : ahead;
  const eats = game.food !== null && head.x === game.food.x && head.y === game.food.y;
  const body = eats ? game.snake : game.snake.slice(0, -1);
  const outside = head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE;
  if (outside || body.some((c) => c.x === head.x && c.y === head.y)) return { game: { ...game, dir, queue, over: 'crashed' }, event: 'crashed' };
  const snake = [head, ...body];
  if (!eats) return { game: { ...game, snake, dir, queue }, event: 'moved' };
  const food = placeFood(snake, random);
  return { game: { ...game, snake, dir, queue, food, score: game.score + 1, over: food ? null : 'filled' }, event: food ? 'ate' : 'filled' };
}

/** Milliseconds a step takes: quicker with every point, down to a floor. @param {number} score */
export const stepMs = (score) => Math.max(70, 150 - score * 3);
