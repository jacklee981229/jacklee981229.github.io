// The Snake bot's brain. Each step it finds the shortest way to the food and, before taking it, plays that way out
// to check the snake could still reach its own tail once it has eaten: a snake that can follow its tail is never
// shut in. When the food isn't safe it follows its tail the long way round, which leaves room for the food to come
// free; failing that, it heads for the most open space. Cells come from the game's own next() (rules.js), so walls
// or none play by the same rules. Tested by tests/snake-bot.test.js; game.js asks it before every step.
import { DIRECTIONS, next, SIZE } from './rules.js';

const DIRS = /** @type {('up' | 'down' | 'left' | 'right')[]} */ (Object.keys(DIRECTIONS));
const CELLS = SIZE * SIZE;
/** Steps without eating after which the bot is taken to be circling for good: twice round the whole board. */
const CIRCLING = 2 * CELLS;

// Cells as numbers, row by row, so the searches can use typed arrays.
const index = (c) => c.y * SIZE + c.x;
const cell = (i) => ({ x: i % SIZE, y: Math.floor(i / SIZE) });

/**
 * How far each cell is from the head of `snake` (head first, as numbers), -1 where it can't be reached, and the cell
 * each was reached from. The body blocks the way, except the tail, which moves on as the head moves. `timed` lets
 * the way into each part of the body once the tail has moved past it (the tail's cell after one step, the one before
 * it after two): it finds the food in more places, but it's less safe, so it's only the bot's way out of circling.
 */
function search(snake, wrap, timed = false) {
  const freeAfter = new Int16Array(CELLS);
  snake.forEach((c, i) => { if (i) freeAfter[c] = timed || i === snake.length - 1 ? snake.length - i : CELLS; });
  const dist = new Int16Array(CELLS).fill(-1);
  const from = new Int16Array(CELLS).fill(-1);
  const queue = [snake[0]];
  dist[snake[0]] = 0;
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    for (const d of DIRS) {
      const n = next(cell(i), d, wrap);
      if (!n) continue;
      const j = index(n);
      if (dist[j] !== -1 || dist[i] + 1 < freeAfter[j]) continue;
      dist[j] = dist[i] + 1;
      from[j] = i;
      queue.push(j);
    }
  }
  return { dist, from };
}

/** The cells from beside the head to `to`, along what search() found. */
function way(from, head, to) {
  const path = [to];
  while (from[path[0]] !== head) path.unshift(from[path[0]]);
  return path;
}

/** The direction from the head to the cell `j` beside it. */
const toward = (head, j, wrap) => DIRS.find((d) => next(head, d, wrap) && index(next(head, d, wrap)) === j);

/**
 * The direction the bot turns to before the next step, or null when the game is over. `hungry` is how many steps
 * the snake has gone since it last ate.
 * @param {import('./rules.js').Game} game
 * @returns {'up' | 'down' | 'left' | 'right' | null}
 */
export function botMove(game, hungry = 0) {
  if (game.over) return null;
  const wrap = Boolean(game.wrap);
  const head = game.snake[0];
  const snake = game.snake.map(index);
  const { dist, from } = search(snake, wrap);
  const food = game.food && index(game.food);

  if (food !== null && dist[food] > 0) {
    const path = way(from, snake[0], food);
    // The snake as it would be on eating the food, one longer. Filling the board ends the game: no tail to reach.
    const fed = [...path].reverse().concat(snake).slice(0, snake.length + 1);
    if (fed.length === CELLS || search(fed, wrap).dist[fed.at(-1)] > 0) return toward(head, path[0], wrap);
  }

  // shortcut: near the end, a snake following its tail can circle its own body for ever without the food coming safe.
  // Once it has circled long enough it takes the food by the looser search, and may then crash; a route through every
  // cell would fill the board every time, if that ever matters.
  if (food !== null && hungry > CIRCLING) {
    const loose = search(snake, wrap, true);
    if (loose.dist[food] > 0) return toward(head, way(loose.from, snake[0], food)[0], wrap);
  }

  // No safe way to the food: of the cells beside the head, the one from which the tail is furthest away, else the one
  // with the most room.
  let choice = null;
  let top = -1;
  for (const d of DIRS) {
    const n = next(head, d, wrap);
    if (!n || dist[index(n)] !== 1) continue;
    const after = [index(n), ...(index(n) === food ? snake : snake.slice(0, -1))];
    const reach = search(after, wrap).dist;
    const tail = reach[after.at(-1)];
    const value = tail > 0 ? CELLS + tail : reach.filter((v) => v >= 0).length;
    if (value > top) [top, choice] = [value, d];
  }
  // Every way is shut: keep going, and the game ends.
  return choice ?? /** @type {'up' | 'down' | 'left' | 'right'} */ (game.dir);
}
