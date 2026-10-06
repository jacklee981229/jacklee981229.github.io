// Collections' rules: the stars, finding an item's pictures, how the turntable turns and how its gallery steps round.
// In the code a collection is a "shelf", to keep it apart from Astro's own word for a folder of content.
// Tested by tests/shelves.test.js.

export const MOST_STARS = 5;
/**
 * The picture files a collection takes. Other kinds (AVIF, HEIC, GIF...) are left out on purpose: the picture
 * library behind this version of Astro has known holes in some of them.
 */
export const PICTURE_TYPES = ['jpg', 'jpeg', 'png', 'webp'];

/** True for 1, 1.5, 2 and so on up to 5. @param {unknown} stars */
export const validStars = (stars) => typeof stars === 'number' && stars >= 1 && stars <= MOST_STARS && Number.isInteger(stars * 2);

/** How full each of the five stars is, from 0 to 1: 3.5 gives 1, 1, 1, 0.5, 0. @param {number} stars */
export const starFills = (stars) => Array.from({ length: MOST_STARS }, (_, i) => Math.min(1, Math.max(0, stars - i)));

/** "4.5 out of 5 stars", for someone who can't see them. @param {number} stars */
export const starsLabel = (stars) => `${stars} out of ${MOST_STARS} stars`;

/**
 * The picture called `file` in a collection's folder, out of the pictures found in the collections' folders
 * (`pictures`: each one under its path from the project's top, such as /src/content/collections/movies/poster.jpg);
 * a plain message naming the item when it isn't there.
 * @template T
 * @param {Record<string, T>} pictures @param {string} shelf the collection's folder
 * @param {{ name: string }} item @param {string} file
 * @returns {T}
 */
function pictureNamed(pictures, shelf, item, file) {
  const found = pictures[`/src/content/collections/${shelf}/${file}`];
  if (found) return found;
  const type = file.split('.').pop()?.toLowerCase() ?? '';
  const why = PICTURE_TYPES.includes(type)
    ? `there is no file of that name in src/content/collections/${shelf}/ (check the spelling, capital letters included)`
    : `only ${PICTURE_TYPES.map((t) => `.${t}`).join(', ')} pictures are taken`;
  throw new Error(`Collections: "${item.name}" in ${shelf} asks for the picture "${file}", but ${why}.`);
}

/**
 * The picture an item names as its cover (`image`); nothing when it names none.
 * @template T
 * @param {Record<string, T>} pictures @param {string} shelf @param {{ name: string, image?: string }} item
 * @returns {T | undefined}
 */
export const pictureOf = (pictures, shelf, item) => (item.image ? pictureNamed(pictures, shelf, item, item.image) : undefined);

/**
 * Every picture an item's gallery shows: its cover first, then the ones its `gallery` lists, in that order.
 * @template T
 * @param {Record<string, T>} pictures @param {string} shelf
 * @param {{ name: string, image?: string, gallery?: string[] }} item
 * @returns {T[]}
 */
export const galleryOf = (pictures, shelf, item) => [item.image, ...(item.gallery ?? [])].filter((file) => file !== undefined).map((file) => pictureNamed(pictures, shelf, item, file));

/**
 * How many steps picture `i` is from the one in the gallery's middle, going round the shorter way: 0 is the middle
 * one, -1 the one on its left, 1 the one on its right. Halfway round counts as the right.
 * @param {number} i @param {number} current the middle one @param {number} n how many there are
 */
export function stepsFrom(i, current, n) {
  const ahead = (((i - current) % n) + n) % n;
  return ahead > n / 2 ? ahead - n : ahead;
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

