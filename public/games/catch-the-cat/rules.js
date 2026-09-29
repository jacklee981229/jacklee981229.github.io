// Catch the Cat's rules, kept apart from the board on screen so tests can check them (tests/catch-the-cat.test.js).
// The board is SIZE rows of SIZE dots; odd rows sit half a dot to the right, so each dot touches up to six others.
// A dot's number is row * SIZE + column. You block one dot a turn; then the cat steps towards the nearest edge.
// You win when the cat can't move, and lose when it reaches the edge.

export const SIZE = 11;
export const START_BLOCKS = 8;
export const START = Math.floor(SIZE / 2) * SIZE + Math.floor(SIZE / 2);

/** @typedef {{ blocked: number[], cat: number, moves: number, over: null | 'won' | 'lost' }} Game */

/** @param {number} i */
export const rowOf = (i) => Math.floor(i / SIZE);
/** @param {number} i */
export const colOf = (i) => i % SIZE;
/** @param {number} i */
export const isEdge = (i) => rowOf(i) === 0 || colOf(i) === 0 || rowOf(i) === SIZE - 1 || colOf(i) === SIZE - 1;

/** The dots touching dot `i`: left, right, then the two above and the two below. @param {number} i */
export function neighbours(i) {
  const r = rowOf(i);
  const c = colOf(i);
  const lean = r % 2; // odd rows sit half a dot to the right
  return [[r, c - 1], [r, c + 1], [r - 1, c - 1 + lean], [r - 1, c + lean], [r + 1, c - 1 + lean], [r + 1, c + lean]]
    .filter(([y, x]) => y >= 0 && y < SIZE && x >= 0 && x < SIZE)
    .map(([y, x]) => y * SIZE + x);
}

/**
 * The cat in the middle, and START_BLOCKS random dots already blocked (never all around the cat).
 * @param {() => number} [random]
 * @returns {Game}
 */
export function newGame(random = Math.random) {
  for (;;) {
    const free = [...Array(SIZE * SIZE).keys()].filter((i) => i !== START);
    const blocked = [];
    for (let n = 0; n < START_BLOCKS; n++) blocked.push(...free.splice(Math.floor(random() * free.length), 1));
    const game = { blocked: blocked.sort((a, b) => a - b), cat: START, moves: 0, over: null };
    if (catMove(game) !== null) return game;
  }
}

/**
 * Where the cat goes next: along free dots towards the nearest edge, preferring the dot with the most free
 * neighbours (the hardest to wall off). Walled in with no way out, it moves to its roomiest free neighbour.
 * null when every neighbour is blocked.
 * @param {Game} game
 */
export function catMove(game) {
  const blocked = new Set(game.blocked);
  const free = (i) => !blocked.has(i);
  const options = neighbours(game.cat).filter(free);
  if (!options.length) return null;
  // Steps from each free dot to the edge, found by walking inwards from every free edge dot at once.
  const steps = new Map();
  const queue = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (isEdge(i) && free(i)) {
      steps.set(i, 0);
      queue.push(i);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    for (const n of neighbours(queue[q])) {
      if (free(n) && !steps.has(n)) {
        steps.set(n, steps.get(queue[q]) + 1);
        queue.push(n);
      }
    }
  }
  const room = (i) => neighbours(i).filter(free).length;
  const worse = (a, b) => (steps.get(a) ?? Infinity) - (steps.get(b) ?? Infinity) || room(b) - room(a);
  return options.reduce((best, i) => (worse(i, best) < 0 ? i : best));
}

/**
 * You block dot `i`, then the cat moves. Nothing happens for the cat's dot, a blocked dot, or a finished game.
 * @param {Game} game
 * @param {number} i
 */
export function block(game, i) {
  if (game.over || i === game.cat || game.blocked.includes(i) || !(i >= 0 && i < SIZE * SIZE)) return { game, played: false, catTo: null };
  const after = { ...game, blocked: [...game.blocked, i].sort((a, b) => a - b), moves: game.moves + 1 };
  const next = catMove(after);
  if (next === null) return { game: { ...after, over: 'won' }, played: true, catTo: null };
  return { game: { ...after, cat: next, over: isEdge(next) ? 'lost' : null }, played: true, catTo: next };
}
