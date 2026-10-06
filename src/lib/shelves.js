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


/** WCAG's relative luminance of an [r, g, b] colour (0 to 255 each). */
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** How well white text reads on a colour: its contrast ratio with white. @param {number[]} rgb */
export const whiteContrast = (rgb) => 1.05 / (luminance(rgb) + 0.05);

/** @param {number[]} rgb @returns {[number, number, number]} hue, saturation and lightness, each 0 to 1 */
function toHsl([r, g, b]) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h / 6, s, l];
}

/** @param {number} h @param {number} s @param {number} l @returns {number[]} */
function toRgb(h, s, l) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    const x = (t + 1) % 1;
    return x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)].map((v) => Math.round(v * 255));
}

const hex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/**
 * The colours of an item's card on the Collections page, from its cover: the cover's own colour, deepened until white
 * text keeps 5:1 on it, fading to a darker shade at the card's foot. Colourful pixels count more than grey ones, so a
 * mostly dark poster still gives its colour; a grey cover stays grey.
 * @param {ArrayLike<number>} pixels a small copy of the cover, three numbers (red, green, blue) a pixel
 * @returns {{ top: string, bottom: string }}
 */
export function cardColours(pixels) {
  let r = 0, g = 0, b = 0, weight = 0;
  for (let i = 0; i + 2 < pixels.length; i += 3) {
    const [R, G, B] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const w = 1 + (6 * (Math.max(R, G, B) - Math.min(R, G, B))) / 255;
    r += R * w;
    g += G * w;
    b += B * w;
    weight += w;
  }
  const [h, s] = toHsl([r / weight, g / weight, b / weight]);
  // Livelier than the average, which mixing makes dull; a nearly grey cover isn't given a colour it doesn't have.
  const saturation = s < 0.1 ? s : Math.min(0.85, s * 1.25 + 0.08);
  let l = 0.36;
  while (whiteContrast(toRgb(h, saturation, l)) < 5 && l > 0.02) l -= 0.02;
  return { top: hex(toRgb(h, saturation, l)), bottom: hex(toRgb(h, saturation, l * 0.62)) };
}
