// Country flags for the trips in the Changelog (ChangelogAway.astro), drawn because Windows has no flag emoji and
// shows the letters ("CN") instead. A flag's colours are its own, the same in every theme, so they live here and not
// in tokens.css.
// shortcut: only the flags of places with a trip so far; draw the next one when a trip there needs it.

/**
 * A five-pointed star's points, one point aimed at `toward` (radians).
 * @param {number} cx @param {number} cy @param {number} r @param {number} toward
 */
export function starPoints(cx, cy, r, toward) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = toward + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.382 : r;
    return `${(cx + d * Math.cos(a)).toFixed(3)},${(cy + d * Math.sin(a)).toFixed(3)}`;
  }).join(' ');
}

/** @typedef {{ name: string, width: number, height: number, ground: string, stars: { points: string, fill: string }[] }} Flag */

/** @type {Record<string, Flag>} */
export const FLAGS = {
  // On a 30 × 20 grid: the big star at (5, 5), the four small ones each with a point aimed at its centre.
  china: {
    name: 'China',
    width: 30,
    height: 20,
    ground: '#EE1C25',
    stars: [
      starPoints(5, 5, 3, -Math.PI / 2),
      ...[[10, 2], [12, 4], [12, 7], [10, 9]].map(([x, y]) => starPoints(x, y, 1, Math.atan2(5 - y, 5 - x))),
    ].map((points) => ({ points, fill: '#FFFF00' })),
  },
};

/** @type {[string, ...string[]]} */
export const FLAG_IDS = /** @type {[string, ...string[]]} */ (Object.keys(FLAGS));
