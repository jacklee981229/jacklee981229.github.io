// The line between the Preview tools' two sides: where it sits, as the left side's share of the room the two sides
// have. The values are the 细节实验页's (designer skill, references/ui-details.md, entry 11).

export const SPLIT_MIN = 0.2;
export const SPLIT_MAX = 0.8;
/** Let go this close to the middle, in pixels, and it settles there. */
export const SNAP_PX = 14;
/** One arrow key press. */
export const SPLIT_STEP = 0.02;

/** @param {number} p */
export const clampSplit = (p) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, p));

/**
 * The share for a pointer at `x`, with the two sides `room` pixels wide in all from `left`, and the line in a gap of
 * `gap` pixels between them.
 * @param {number} x @param {number} left @param {number} room @param {number} gap
 */
export const splitAt = (x, left, room, gap) => clampSplit((x - left - gap / 2) / room);

/** Where the line rests when let go: the middle, if within SNAP_PX of it. @param {number} p @param {number} room */
export const settleSplit = (p, room) => (Math.abs(p - 0.5) * room < SNAP_PX ? 0.5 : p);
