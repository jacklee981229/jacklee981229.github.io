// A post without a picture gets a cover drawn from its topic: the topic's icon, placed, turned and lit a little
// differently for each post (from its address), so a run of posts on one topic doesn't repeat one picture.

/** A number from 0 to 1 for each call, the same series for the same text. @param {string} text */
function series(text) {
  let h = [...text].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 2654435761) >>> 0, 2166136261);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Where the icon sits (its centre, % of the cover), its size (% of the cover's width), its turn and the gradient's
 * angle (degrees), and where the light falls along the top (%).
 * @param {string} id
 */
export function drawnCover(id) {
  const next = series(id);
  const between = (/** @type {number} */ lo, /** @type {number} */ hi) => Math.round(lo + next() * (hi - lo));
  return { angle: between(120, 220), x: between(52, 78), y: between(34, 62), size: between(46, 72), turn: between(-24, 24), light: between(10, 90) };
}

/** The same, as custom properties for the cover's style. @param {string} id */
export function drawnStyle(id) {
  const c = drawnCover(id);
  return `--angle: ${c.angle}deg; --x: ${c.x}%; --y: ${c.y}%; --size: ${c.size}%; --turn: ${c.turn}deg; --light: ${c.light}%`;
}
