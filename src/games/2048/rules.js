// 2048's rules, kept apart from the board on screen so tests can check them (tests/game-2048.test.js).
// A game is its tiles, score, and whether it has been won or is over. A tile is { id, value, x, y }:
// x is the column (0 is left), y the row (0 is top). Ids let the screen animate each tile from move to move.
// A game also carries `back`: the game as it was before its last move, for Undo. Only one move back is kept.

export const SIZE = 4;
export const GOAL = 2048;

/** @typedef {{ id: number, value: number, x: number, y: number }} Tile */
/** @typedef {{ tiles: Tile[], score: number, won: boolean, over: boolean, nextId: number, back?: Game | null }} Game */

/** @param {() => number} [random] */
export function newGame(random = Math.random) {
  /** @type {Game} */
  let game = { tiles: [], score: 0, won: false, over: false, nextId: 1 };
  game = spawn(game, random).game;
  return spawn(game, random).game;
}

/** @param {Tile[]} tiles */
export function emptyCells(tiles) {
  const taken = new Set(tiles.map((t) => t.y * SIZE + t.x));
  const cells = [];
  for (let i = 0; i < SIZE * SIZE; i++) if (!taken.has(i)) cells.push({ x: i % SIZE, y: Math.floor(i / SIZE) });
  return cells;
}

/**
 * A new tile in a random empty cell: a 2, or a 4 one time in ten.
 * @param {Game} game
 * @param {() => number} [random]
 */
export function spawn(game, random = Math.random) {
  const cells = emptyCells(game.tiles);
  if (!cells.length) return { game, tile: null };
  const cell = cells[Math.floor(random() * cells.length)];
  const tile = { id: game.nextId, value: random() < 0.9 ? 2 : 4, ...cell };
  return { game: { ...game, tiles: [...game.tiles, tile], nextId: game.nextId + 1 }, tile };
}

/** True while some move is still possible: an empty cell, or two equal tiles side by side. @param {Tile[]} tiles */
export function canMove(tiles) {
  if (emptyCells(tiles).length) return true;
  const value = new Map(tiles.map((t) => [t.y * SIZE + t.x, t.value]));
  for (const t of tiles) {
    if (t.x < SIZE - 1 && value.get(t.y * SIZE + t.x + 1) === t.value) return true;
    if (t.y < SIZE - 1 && value.get((t.y + 1) * SIZE + t.x) === t.value) return true;
  }
  return false;
}

/**
 * Slides every tile as far as it goes towards `direction`; two equal tiles that meet join once per move.
 * Returns the new game plus what happened, for the screen: where each old tile slid to (a joined pair both
 * slide to the same cell), the tiles that joins made, and the new tile. Nothing happens if nothing can move.
 * @param {Game} game
 * @param {'left' | 'right' | 'up' | 'down'} direction
 * @param {() => number} [random]
 */
export function move(game, direction, random = Math.random) {
  const still = { game, moved: false, gained: 0, slid: [], merged: [], spawned: null };
  if (game.over) return still;
  const towardsStart = direction === 'left' || direction === 'up';
  const across = direction === 'left' || direction === 'right';
  // Cell `i` of `line`, counting from the edge the tiles move towards.
  const cell = (line, i) => {
    const pos = towardsStart ? i : SIZE - 1 - i;
    return across ? { x: pos, y: line } : { x: line, y: pos };
  };
  const at = new Map(game.tiles.map((t) => [t.y * SIZE + t.x, t]));
  /** @type {Tile[]} */ const tiles = [];
  /** @type {{ id: number, x: number, y: number }[]} */ const slid = [];
  /** @type {(Tile & { from: number[] })[]} */ const merged = [];
  let nextId = game.nextId;
  let gained = 0;
  let moved = false;

  for (let line = 0; line < SIZE; line++) {
    /** @type {{ tile: Tile, partner?: Tile }[]} */ const placed = [];
    for (let i = 0; i < SIZE; i++) {
      const { x, y } = cell(line, i);
      const tile = at.get(y * SIZE + x);
      if (!tile) continue;
      const last = placed[placed.length - 1];
      if (last && !last.partner && last.tile.value === tile.value) last.partner = tile;
      else placed.push({ tile });
    }
    placed.forEach(({ tile, partner }, slot) => {
      const { x, y } = cell(line, slot);
      if (partner || tile.x !== x || tile.y !== y) moved = true;
      slid.push({ id: tile.id, x, y });
      if (!partner) return void tiles.push({ ...tile, x, y });
      slid.push({ id: partner.id, x, y });
      const joined = { id: nextId++, value: tile.value * 2, x, y };
      tiles.push(joined);
      merged.push({ ...joined, from: [tile.id, partner.id] });
      gained += joined.value;
    });
  }
  if (!moved) return still;

  const after = { ...game, tiles, score: game.score + gained, nextId, won: game.won || merged.some((t) => t.value >= GOAL) };
  const { game: next, tile } = spawn(after, random);
  return { game: { ...next, over: !canMove(next.tiles), back: { ...game, back: null } }, moved: true, gained, slid, merged, spawned: tile };
}

/**
 * Takes back the last move: the board, the score, and a win or an end that the move brought. Once only: the game
 * it returns has nothing to take back until the next move. With nothing to take back, it's the same game.
 * @param {Game} game @returns {Game}
 */
export function undo(game) {
  return game.back ? { ...game.back, back: null } : game;
}
