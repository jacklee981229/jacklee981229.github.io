// Where the guestbook's lanterns hang in Jack's Firefly River (src/worlds/fireflies.js): one for each note on the
// wall (arrange in src/lib/guestbook.js), on bamboo poles along the near bank, in two rows, the front one lower and
// larger. Each note's place along the bank comes from its id, so it hangs in the same place every visit; the pinned
// ones hang in front, in the middle, a third larger; a longer message makes a slightly larger lantern. Every lantern
// is also a button (at least 44 pixels square), and no two buttons overlap, even nine on a phone.

import { lookOf } from '../guestbook.js';
import { seeded } from './mangroves.js';

/** A lantern's height in CSS pixels, in the front row and the back, on a laptop and on a phone. */
export const SIZES = { wide: [34, 27], phone: [25, 20] };
/** The smallest a lantern's button can be, as a finger needs. */
export const BUTTON = 44;
/** Pinned notes' lanterns are this much larger. */
export const PINNED = 1.3;

/**
 * @typedef {{ note: import('../guestbook.js').Note, colour: number, x: number, y: number, height: number, row: number, tip: number[], foot: number[], button: number }} Lantern
 * `colour` is its note's paper (1 to 6, the --note-N tokens, as for its card on the wall); `x`, `y` are the middle of
 * the lantern's paper, `height` its height, `row` 0 for the front row and 1 for the back, `tip` and `foot` the ends of
 * the bamboo pole it hangs from, `button` its button's side; all in CSS pixels of the stage.
 */

/**
 * The lanterns for the wall's notes on a stage this size, its water at `waterline`.
 * @param {import('../guestbook.js').Note[]} wall the wall's notes, pinned first
 * @param {{ width: number, height: number, waterline: number }} stage
 * @returns {Lantern[]}
 */
export function hang(wall, { width, height, waterline }) {
  const phone = width < 600;
  const [front, back] = phone ? SIZES.phone : SIZES.wide;
  // The rows' heights over the water: the back row a button's height and a little above the front, so their buttons
  // never meet whatever lies above or below.
  const rowY = [waterline - Math.max(front * 1.15, height * 0.075), 0];
  rowY[1] = rowY[0] - BUTTON - 10;
  /** @type {Lantern[][]} */
  const rows = [[], []];
  let pinnedSeen = 0;
  wall.forEach((note, i) => {
    const rand = seeded(note.id * 7919 + 17);
    const pinned = Boolean(note.pinned);
    // The pinned in front; the rest take turns, front first, so a lone note hangs in front.
    const row = pinned ? 0 : (i - pinnedSeen) % 2;
    if (pinned) pinnedSeen++;
    const length = Math.min(300, [...(note.message ?? '')].length);
    const h = (row ? back : front) * (pinned ? PINNED : 1) * (0.85 + 0.3 * (length / 300));
    const x = pinned ? width * (0.5 + (rand() - 0.5) * 0.16) : width * (0.08 + 0.84 * rand());
    rows[row].push({ note, colour: lookOf(note.id).colour, x, y: rowY[row], height: h, row, tip: [0, 0], foot: [0, 0], button: Math.max(BUTTON, Math.round(h * 1.25)) });
  });
  const gap = (/** @type {Lantern} */ a, /** @type {Lantern} */ b) => (a.button + b.button) / 2 + 8;
  const need = (/** @type {Lantern[]} */ row) => row.reduce((s, l) => s + l.button + 8, -8);
  // A row with more buttons than fit across hands its last lanterns to the other row (it holds nine on a phone).
  for (const [from, to] of [[0, 1], [1, 0]]) {
    while (rows[from].length > 1 && need(rows[from]) > width - 8 && need([...rows[to], rows[from][rows[from].length - 1]]) <= width - 8) {
      const moved = /** @type {Lantern} */ (rows[from].pop());
      const h = (moved.height / (from ? back : front)) * (to ? back : front);
      rows[to].push({ ...moved, row: to, y: rowY[to], height: h, button: Math.max(BUTTON, Math.round(h * 1.25)) });
    }
  }
  for (const row of rows) {
    if (!row.length) continue;
    // Spread along the bank, keeping each button clear of the next.
    row.sort((a, b) => a.x - b.x);
    const margin = Math.max(0, Math.min(width * 0.04, (width - need(row)) / 2));
    for (let i = 0; i < row.length; i++) {
      const least = i ? row[i - 1].x + gap(row[i - 1], row[i]) : margin + row[0].button / 2;
      row[i].x = Math.max(row[i].x, least);
    }
    // If that pushed the last off the right, slide the row back left as a whole, then keep the gaps from the right.
    const over = row[row.length - 1].x + row[row.length - 1].button / 2 - (width - margin);
    if (over > 0) {
      row[row.length - 1].x -= over;
      for (let i = row.length - 2; i >= 0; i--) row[i].x = Math.min(row[i].x, row[i + 1].x - gap(row[i], row[i + 1]));
    }
  }
  for (const l of [...rows[0], ...rows[1]]) {
    // Its pole stands in the mud beside it and arches over, the lantern hanging from its tip on a short string; on the
    // side the note's id picks, unless that's off the stage.
    const rand = seeded(l.note.id * 31 + 5);
    let side = rand() < 0.5 ? -1 : 1;
    const reach = l.height * (0.7 + 0.25 * rand());
    if (l.x + side * reach < 4 || l.x + side * reach > width - 4) side = -side;
    l.tip = [l.x, l.y - l.height * 1.05];
    l.foot = [l.x + side * reach, waterline + 2];
  }
  return [...rows[0], ...rows[1]];
}
