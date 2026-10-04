// The 2048 bot's brain (D64 in docs/plan/done/2048-bot.md): an expectimax search. For each direction it plays the
// move with the game's own `move()`, so the rules live in rules.js only; then it averages over every cell where the
// next tile could appear (a 2 nine times in ten, else a 4), looks one more move ahead (two when the board is nearly
// full), and scores the boards it reaches. It plays the direction with the best average. Tested by
// tests/game-2048-bot.test.js; game.js asks it for one move at a time.
import { SIZE, canMove, emptyCells, move } from './rules.js';

export const DIRECTIONS = /** @type {const} */ (['up', 'left', 'right', 'down']);

/** At or under this many empty cells, the bot looks one move further: that's when a wrong move ends the game. */
const NEARLY_FULL = 3;

// What a board is worth. Empty cells keep a game alive; the biggest tile in a corner with the rows and columns
// rising towards it keeps big tiles together where they can join; equal neighbours are joins waiting to happen.
const EMPTY = 270;
const JOINS = 70;
const ORDER = 47;
const CORNER = 200;
const LOST = -1e6;

/** Each cell's tile as a power of two (0 for empty), row by row. @param {import('./rules.js').Tile[]} tiles */
function grid(tiles) {
  const cells = new Array(SIZE * SIZE).fill(0);
  for (const t of tiles) cells[t.y * SIZE + t.x] = Math.log2(t.value);
  return cells;
}

/** How out of order a line of powers is, the smaller of its two directions: 0 when it only rises or only falls. */
function disorder(line) {
  let up = 0;
  let down = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const step = line[i + 1] - line[i];
    if (step > 0) up += step;
    else down -= step;
  }
  return Math.min(up, down);
}

/** How good a board is for the player, before the next tile appears. @param {import('./rules.js').Tile[]} tiles */
export function worth(tiles) {
  const g = grid(tiles);
  const at = (x, y) => g[y * SIZE + x];
  let empty = 0;
  let joins = 0;
  let order = 0;
  for (let i = 0; i < SIZE; i++) {
    const row = [];
    const column = [];
    for (let j = 0; j < SIZE; j++) {
      row.push(at(j, i));
      column.push(at(i, j));
      if (!at(j, i)) empty++;
      if (j < SIZE - 1) {
        if (at(j, i) && at(j, i) === at(j + 1, i)) joins += at(j, i);
        if (at(i, j) && at(i, j) === at(i, j + 1)) joins += at(i, j);
      }
    }
    order += disorder(row) + disorder(column);
  }
  const biggest = Math.max(...g);
  const corners = [at(0, 0), at(SIZE - 1, 0), at(0, SIZE - 1), at(SIZE - 1, SIZE - 1)];
  return EMPTY * empty + JOINS * joins - ORDER * order + (corners.includes(biggest) ? CORNER * biggest : 0);
}

/** The board after a move, without the random tile `move()` adds: the search places that tile itself. */
function slide(game, direction) {
  const r = move(game, direction, () => 0);
  if (!r.moved) return null;
  return { ...r.game, tiles: r.game.tiles.filter((t) => t.id !== r.spawned?.id), over: false, back: null };
}

/** The player's turn: the best direction's value, `moves` moves deep. */
function best(game, moves) {
  let top = -Infinity;
  for (const direction of DIRECTIONS) {
    const after = slide(game, direction);
    if (after) top = Math.max(top, moves > 1 ? chance(after, moves - 1) : worth(after.tiles));
  }
  return top === -Infinity ? LOST : top;
}

/** The game's turn: the average over every cell and value the next tile could take. */
function chance(game, moves) {
  const cells = emptyCells(game.tiles);
  if (!cells.length) return canMove(game.tiles) ? best(game, moves) : LOST;
  let total = 0;
  for (const cell of cells) {
    for (const [value, odds] of [[2, 0.9], [4, 0.1]]) {
      const tiles = [...game.tiles, { id: -1, value, ...cell }];
      total += odds * best({ ...game, tiles }, moves);
    }
  }
  return total / cells.length;
}

/**
 * The direction the bot plays, or null when no direction moves anything (the game is over).
 * @param {import('./rules.js').Game} game
 * @returns {'up' | 'left' | 'right' | 'down' | null}
 */
export function botMove(game) {
  const deep = emptyCells(game.tiles).length <= NEARLY_FULL ? 3 : 2;
  let choice = null;
  let top = -Infinity;
  for (const direction of DIRECTIONS) {
    const after = slide({ ...game, over: false }, direction);
    if (!after) continue;
    const value = chance(after, deep - 1);
    if (value > top) [top, choice] = [value, direction];
  }
  return choice;
}
