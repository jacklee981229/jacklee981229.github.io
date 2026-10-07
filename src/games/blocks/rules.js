// Blocks' rules (a falling-blocks game), kept apart from the board on screen so tests can
// check them (tests/blocks.test.js). The well is WIDTH columns by HEIGHT rows, with HIDDEN rows above the top where
// pieces appear. A cell is '' (empty) or the letter of the piece that filled it.

export const WIDTH = 10;
export const HEIGHT = 20;
export const HIDDEN = 2;
const ROWS = HEIGHT + HIDDEN;

// Each piece in its starting turn, as the cells it covers in its square box (x, y), with the box's size.
const SHAPES = {
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};
export const PIECES = Object.keys(SHAPES);
// Where a turn that doesn't fit is tried next: a step left or right, a step up (off the floor), then two sideways.
const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]];
// Points for clearing 1, 2, 3 or 4 rows at once, times the level.
export const LINE_POINTS = [0, 100, 300, 500, 800];

/**
 * @typedef {{ type: string, turn: number, x: number, y: number }} Piece
 * @typedef {{ well: string[][], piece: Piece, next: string, bag: string[], held: string | null, canHold: boolean, score: number, lines: number, over: boolean }} Game
 * `held` is the piece set aside for later; `canHold` is false once a piece was set aside, until the next one sets.
 */

/** The level: one more every 10 rows cleared. @param {number} lines */
export const levelOf = (lines) => Math.floor(lines / 10) + 1;
/** Milliseconds a piece takes to fall one row at a level: quicker each level, down to a floor. @param {number} level */
export const dropMs = (level) => Math.max(60, Math.round(800 * 0.85 ** (level - 1)));

/** The cells a piece covers on the well, turned `piece.turn` quarter turns clockwise. @param {Piece} piece */
export function cells(piece) {
  const { size, cells: start } = SHAPES[piece.type];
  return start.map(([x, y]) => {
    for (let t = 0; t < piece.turn % 4; t++) [x, y] = [size - 1 - y, x];
    return { x: piece.x + x, y: piece.y + y };
  });
}

/** True if the piece is inside the well and on empty cells. @param {string[][]} well @param {Piece} piece */
export function fits(well, piece) {
  return cells(piece).every(({ x, y }) => x >= 0 && x < WIDTH && y >= 0 && y < ROWS && !well[y][x]);
}

/** The seven pieces in a random order: each comes once in every seven, so none is ever missing for long. */
export function bag(random = Math.random) {
  const pieces = [...PIECES];
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  return pieces;
}

// A piece arriving at the top, its lowest row on the well's first visible row.
const arriving = (type) => ({ type, turn: 0, x: type === 'O' ? 4 : 3, y: HIDDEN - 1 });

/** The next piece drops in and the one after is drawn from the bag; if it doesn't fit, the game is over. @param {Game} game */
function spawn(game, random = Math.random) {
  const bagLeft = game.bag.length ? game.bag : bag(random);
  const [next, ...rest] = bagLeft;
  const piece = arriving(game.next);
  return { ...game, piece, next, bag: rest, over: !fits(game.well, piece) };
}

/** A new game: an empty well and the first piece at the top. */
export function newGame(random = Math.random) {
  const [first, next, ...rest] = bag(random);
  const game = { well: Array.from({ length: ROWS }, () => Array(WIDTH).fill('')), piece: arriving(first), next, bag: rest, held: null, canHold: true, score: 0, lines: 0, over: false };
  return { ...game, over: !fits(game.well, game.piece) };
}

/**
 * Sets the falling piece aside for later. With nothing set aside yet, the next piece comes in; after that, the
 * piece swaps with the one set aside, which comes in at the top. Once per piece: holding again waits until a
 * piece sets, so a piece can't be swapped back and forth forever.
 * @param {Game} game
 */
export function hold(game, random = Math.random) {
  if (game.over || !game.canHold) return game;
  const type = game.piece.type;
  if (!game.held) return { ...spawn({ ...game, held: type }, random), canHold: false };
  const piece = arriving(game.held);
  return { ...game, piece, held: type, canHold: false, over: !fits(game.well, piece) };
}

/** Moves the piece a column left (-1) or right (1), if it fits. @param {Game} game @param {number} dx */
export function move(game, dx) {
  const piece = { ...game.piece, x: game.piece.x + dx };
  return game.over || !fits(game.well, piece) ? game : { ...game, piece };
}

/** Turns the piece clockwise (1) or back (-1), nudging it sideways or up when it wouldn't fit. @param {Game} game */
export function rotate(game, dir = 1) {
  if (game.over || game.piece.type === 'O') return game;
  for (const [dx, dy] of KICKS) {
    const piece = { ...game.piece, turn: (game.piece.turn + dir + 4) % 4, x: game.piece.x + dx, y: game.piece.y + dy };
    if (fits(game.well, piece)) return { ...game, piece };
  }
  return game;
}

/** Moves the piece a row down, if it fits; a soft drop (pressed by the player) scores a point a row. @param {Game} game */
export function drop(game, soft = false) {
  const piece = { ...game.piece, y: game.piece.y + 1 };
  if (game.over || !fits(game.well, piece)) return { game, moved: false };
  return { game: { ...game, piece, score: game.score + (soft ? 1 : 0) }, moved: true };
}

/** Where the piece would land if dropped straight down. @param {Game} game */
export function ghost(game) {
  let piece = game.piece;
  while (fits(game.well, { ...piece, y: piece.y + 1 })) piece = { ...piece, y: piece.y + 1 };
  return piece;
}

/**
 * Sets the piece into the well, clears full rows (more points for more at once, times the level), and brings the
 * next piece, which may be held again. Returns the game, the rows that were full (numbered in the well before
 * clearing) and that well.
 * @param {Game} game
 */
export function lock(game, random = Math.random) {
  const merged = game.well.map((row) => [...row]);
  for (const { x, y } of cells(game.piece)) merged[y][x] = game.piece.type;
  const full = merged.flatMap((row, y) => (row.every(Boolean) ? [y] : []));
  const kept = merged.filter((_, y) => !full.includes(y));
  const well = [...Array.from({ length: full.length }, () => Array(WIDTH).fill('')), ...kept];
  const level = levelOf(game.lines);
  const next = { ...game, well, canHold: true, score: game.score + LINE_POINTS[full.length] * level, lines: game.lines + full.length };
  return { game: spawn(next, random), cleared: full, merged };
}

// The top visible rows where a set block puts the game in danger, and its heartbeat starts: six, so it warns a few
// pieces before the end, not only on the last one.
const DANGER_ROWS = 6;
/** True once a set block reaches the top six visible rows (or the hidden ones above). @param {string[][]} well */
export const inDanger = (well) => well.slice(0, HIDDEN + DANGER_ROWS).some((row) => row.some(Boolean));

/**
 * The sounds a piece setting makes (sound.js plays them), and the combo it leaves. Pieces that clear rows one after
 * another build a combo, which lifts each row chime a step, up to eight; a piece that clears nothing ends it. A hard
 * drop thuds instead of the setting click, and a new level rings a moment after the rows.
 * @param {number} linesBefore @param {number} linesAfter @param {number} cleared rows cleared by this piece
 * @param {boolean} dropped @param {number} combo pieces in a row that cleared rows before this one
 * @returns {{ sounds: [string, number, number, number][], combo: number }} each sound as [name, rows, step, delay in seconds]
 */
export function settleSounds(linesBefore, linesAfter, cleared, dropped, combo) {
  /** @type {[string, number, number, number][]} */
  const sounds = dropped ? [['drop', 0, 0, 0]] : [];
  if (cleared) sounds.push([cleared === 4 ? 'four' : 'rows', cleared, Math.min(8, combo), 0]);
  else if (!dropped) sounds.push(['set', 0, 0, 0]);
  if (levelOf(linesAfter) > levelOf(linesBefore)) sounds.push(['level', 0, 0, 0.35]);
  return { sounds, combo: cleared ? combo + 1 : 0 };
}

/** Drops the piece straight to where it lands and sets it there, 2 points a row. @param {Game} game */
export function hardDrop(game, random = Math.random) {
  if (game.over) return { game, cleared: [], merged: game.well };
  const landed = ghost(game);
  return lock({ ...game, piece: landed, score: game.score + 2 * (landed.y - game.piece.y) }, random);
}
