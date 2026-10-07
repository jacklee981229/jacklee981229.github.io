// The guestbook's notes, for its page (src/pages/guestbook.astro) and the home page's Guestbook card: how they're laid
// out and how each looks. The notes themselves come from the guestbook's Worker (workers/guestbook), newest first.

/** How many notes the wall holds; the rest go in the list under it. */
export const WALL = 9;
/** How many notes the home page's card shows: the newest. */
export const ON_HOME = 3;
/** How much each note leans on the wall, by its id: a few degrees, never the same twice in a row. */
const TILTS = [-1.2, 0.8, -0.5, 1.1, -0.9, 0.6];

/**
 * @typedef {{ id: number, name: string, website: string | null, message: string, created_at: string, pinned: number,
 *   reply: string | null, reply_at: string | null }} Note
 */

/**
 * The wall and the list: the wall holds up to WALL notes, the pinned ones first (newest first among them), then the
 * newest; the list holds all the rest, newest first.
 * @param {Note[]} notes newest first
 */
export function arrange(notes) {
  const wall = [...notes.filter((n) => n.pinned), ...notes.filter((n) => !n.pinned)].slice(0, WALL);
  const onWall = new Set(wall.map((n) => n.id));
  return { wall, list: notes.filter((n) => !onWall.has(n.id)) };
}

/** A note's paper colour (1 to 6, the --note-N tokens) and lean, the same for it every time. @param {number} id */
export const lookOf = (id) => ({ colour: (Math.abs(id) % 6) + 1, tilt: TILTS[Math.abs(id) % TILTS.length] });

/** "1 note so far", "12 notes so far". @param {number} count */
export const countLine = (count) => `${count} ${count === 1 ? 'note' : 'notes'} so far`;

/** A name's first character, for its circle in the list: a whole one, so 小明 gives 小 and an emoji stays whole. @param {string} name */
export const initialOf = (name) => ([...name.trim()][0] ?? '?').toUpperCase();
