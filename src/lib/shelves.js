// Collections' rules: the stars, finding an item's picture, how the turntable turns and where an item's note goes.
// In the code a collection is a "shelf", to keep it apart from Astro's own word for a folder of content.
// Tested by tests/shelves.test.js.

export const MOST_STARS = 5;
/**
 * The picture files a collection takes. Other kinds (AVIF, HEIC, GIF...) are left out on purpose: the picture
 * library behind this version of Astro has known holes in some of them (D24 in docs/plan/done/collections-travel-map.md).
 */
export const PICTURE_TYPES = ['jpg', 'jpeg', 'png', 'webp'];

/** True for 1, 1.5, 2 and so on up to 5. @param {unknown} stars */
export const validStars = (stars) => typeof stars === 'number' && stars >= 1 && stars <= MOST_STARS && Number.isInteger(stars * 2);

/** How full each of the five stars is, from 0 to 1: 3.5 gives 1, 1, 1, 0.5, 0. @param {number} stars */
export const starFills = (stars) => Array.from({ length: MOST_STARS }, (_, i) => Math.min(1, Math.max(0, stars - i)));

/** "4.5 out of 5 stars", for someone who can't see them. @param {number} stars */
export const starsLabel = (stars) => `${stars} out of ${MOST_STARS} stars`;

/**
 * What an item's note says when Jack hasn't written a comment on it, from its collection's name: "Great movie!" in
 * Movies, "Great game!" in Games (D107 in docs/plan/done/home-fixes-town-night-words.md).
 * @param {string} name the collection's name
 */
export const defaultComment = (name) => `Great ${name.toLowerCase().replace(/s$/, '')}!`;

/**
 * The picture an item names, out of the pictures found in the collections' folders (`pictures`: each one under
 * its path from the project's top, such as /src/content/collections/movies/poster.jpg). Nothing when the item
 * names no picture; a plain message when it names one that isn't there.
 * @template T
 * @param {Record<string, T>} pictures @param {string} shelf the collection's folder
 * @param {{ name: string, image?: string }} item
 * @returns {T | undefined}
 */
export function pictureOf(pictures, shelf, item) {
  if (!item.image) return undefined;
  const found = pictures[`/src/content/collections/${shelf}/${item.image}`];
  if (found) return found;
  const type = item.image.split('.').pop()?.toLowerCase() ?? '';
  const why = PICTURE_TYPES.includes(type)
    ? `there is no file of that name in src/content/collections/${shelf}/ (check the spelling, capital letters included)`
    : `only ${PICTURE_TYPES.map((t) => `.${t}`).join(', ')} pictures are taken`;
  throw new Error(`Collections: "${item.name}" in ${shelf} asks for the picture "${item.image}", but ${why}.`);
}

/** How much further back the turntable stands half-way through a turn, as a share of its radius: room for the two
    cards to swing past the sides without coming at the visitor. */
const DRAW_BACK = 0.55;

/**
 * Half a turn of the turntable, as steps for the browser to play. Two cards stand on it back to back, each `radius`
 * from its middle: the one in front faces the visitor, the other faces away behind it. Each step says how far the
 * table has turned and how far back it stands. It starts and ends gently, and stands furthest back half-way.
 * @param {1 | -1} way 1 turns it clockwise seen from above, -1 the other way
 * @param {number} radius in pixels
 * @returns {{ transform: string }[]}
 */
export function turnFrames(way, radius, steps = 36) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const eased = t < 0.5 ? 4 * t ** 3 : 1 - (2 - 2 * t) ** 3 / 2;
    const back = radius * (1 + DRAW_BACK * Math.sin(Math.PI * eased));
    // CSS turns things about an axis that points down the page, so clockwise seen from above is a negative turn.
    const turned = -way * 180 * eased;
    return { transform: `translateZ(${(-back).toFixed(1)}px) rotateY(${turned.toFixed(2)}deg)` };
  });
}

/** Pixels between a cover and its note, and between the note and the window's edge. */
const NOTE_GAP = 14;
const NOTE_EDGE = 12;
/** How far down the cover the note's pointer aims, and how close to the note's own corners it may sit. */
const POINT_AT = 36;
const POINTER_MARGIN = 18;

/**
 * Where an item's note goes, in the window's own pixels: beside the cover, on the right when there's room, else on
 * the left. Where neither side has room (a phone) it goes under the item, or over the cover when the window ends
 * too soon below. It's kept inside the window, and `pointer` is how far along its edge the little pointer sits to
 * aim at the cover.
 * @param {{ left: number, top: number, right: number, bottom: number }} cover
 * @param {number} under the bottom of the whole item, its name and stars included
 * @param {{ width: number, height: number }} note @param {{ width: number, height: number }} view the window
 * @returns {{ side: 'right' | 'left' | 'below' | 'above', left: number, top: number, pointer: number }}
 */
export function placeNote(cover, under, note, view) {
  const within = (/** @type {number} */ n, /** @type {number} */ low, /** @type {number} */ high) => Math.max(low, Math.min(Math.max(low, high), n));
  const fitsRight = cover.right + NOTE_GAP + note.width <= view.width - NOTE_EDGE;
  const fitsLeft = cover.left - NOTE_GAP - note.width >= NOTE_EDGE;
  if (fitsRight || fitsLeft) {
    const top = within(cover.top, NOTE_EDGE, view.height - note.height - NOTE_EDGE);
    return {
      side: fitsRight ? 'right' : 'left',
      left: fitsRight ? cover.right + NOTE_GAP : cover.left - NOTE_GAP - note.width,
      top,
      pointer: within(cover.top + POINT_AT - top, POINTER_MARGIN, note.height - POINTER_MARGIN),
    };
  }
  const left = within((cover.left + cover.right - note.width) / 2, NOTE_EDGE, view.width - note.width - NOTE_EDGE);
  const below = under + NOTE_GAP + note.height <= view.height - NOTE_EDGE || cover.top - NOTE_GAP - note.height < NOTE_EDGE;
  return {
    side: below ? 'below' : 'above',
    left,
    top: below ? under + NOTE_GAP : cover.top - NOTE_GAP - note.height,
    pointer: within((cover.left + cover.right) / 2 - left, POINTER_MARGIN, note.width - POINTER_MARGIN),
  };
}
