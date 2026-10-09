// QR Code Generator: a link or message turned into a QR code's squares (by uqr), and the squares drawn as an SVG file and
// as the pixels of a PNG, both inside the white border scanners count on; kept apart from the page so the tests can read
// every drawn code back.
import { encode } from 'uqr';

/** The white border around a code, in squares: the standard's minimum. */
export const BORDER = 4;
/** How much of a code can be smudged or covered and still read: M, about 15%. */
const LEVEL = 'M';

/**
 * @typedef {{ size: number, dark: boolean[][] }} Squares
 * A code's squares, its border included: `dark[y][x]` is true for a dark one.
 * @typedef {{ ink: string, paper: string }} Colours  the dark squares' and the background's, as #RRGGBB
 */

/** Whether a text fits one code. @param {string} text */
const fits = (text) => {
  try {
    encode(text, { ecc: LEVEL, border: 0 });
    return true;
  } catch (e) {
    if (e instanceof RangeError && e.message === 'Data too long') return false;
    throw e;
  }
};

/**
 * A link or message's code: its squares; `{ over }` when it's too long for one code, with how many characters too
 * many; null when there's nothing to encode.
 * @param {string} text @returns {Squares | { over: number } | null}
 */
export function qrSquares(text) {
  if (!text) return null;
  if (!fits(text)) {
    // The longest start of the text that still fits, found by halves. Characters as people count them, so a Chinese
    // character or an emoji is one; a longer start never fits better, as it only ever needs a roomier way to encode.
    const chars = Array.from(text);
    let lo = 0;
    let hi = chars.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fits(chars.slice(0, mid).join(''))) lo = mid;
      else hi = mid - 1;
    }
    return { over: chars.length - lo };
  }
  const { size, data } = encode(text, { ecc: LEVEL, border: BORDER });
  return { size, dark: data };
}

/**
 * A code as an SVG file: the background, then one path of dark squares, with crisp edges at any size. It says it's
 * 1024 pixels square, so apps that place it at its own size don't make it tiny; the page sizes it to fit.
 * @param {Squares} squares @param {Colours} colours @returns {string}
 */
export function qrSvg({ size, dark }, { ink, paper }) {
  let path = '';
  dark.forEach((row, y) => {
    // A run of dark squares in a row is one rectangle: a far shorter file than a square apiece.
    for (let x = 0; x < size; x++) {
      if (!row[x]) continue;
      let end = x;
      while (end + 1 < size && row[end + 1]) end++;
      path += `M${x} ${y}h${end - x + 1}v1h-${end - x + 1}z`;
      x = end;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${paper}"/><path d="${path}" fill="${ink}"/></svg>`;
}

/** @param {string} hex #RRGGBB */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * A code's pixels for a PNG, as ImageData takes them (red, green, blue, alpha): every square the same whole number of
 * pixels, so its edges stay sharp, and the picture at least `least` pixels across.
 * @param {Squares} squares @param {Colours} colours @param {number} [least]
 * @returns {{ width: number, height: number, data: Uint8ClampedArray<ArrayBuffer> }}
 */
export function qrPixels({ size, dark }, { ink, paper }, least = 1024) {
  const scale = Math.ceil(least / size);
  const width = size * scale;
  const data = new Uint8ClampedArray(width * width * 4);
  const on = rgb(ink);
  const off = rgb(paper);
  for (let y = 0; y < width; y++) {
    const row = dark[Math.floor(y / scale)];
    for (let x = 0; x < width; x++) {
      const [r, g, b] = row[Math.floor(x / scale)] ? on : off;
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width, height: width, data };
}

/**
 * A download's file name from the text: its first letters and digits, without a web address's start
 * (`qr-jacklee981229-github-io.png`), or `qr-code` when it has none (Chinese, say).
 * @param {string} text @param {'png' | 'svg'} ext
 */
export function qrFileName(text, ext) {
  const words = text.toLowerCase().replace(/^[a-z]+:\/\/(www\.)?/, '').match(/[a-z0-9]+/g) ?? [];
  let name = '';
  for (const word of words) {
    const longer = name ? `${name}-${word}` : word;
    if (longer.length > 40) {
      // A first word longer than that is cut, so the name still says what the code is.
      if (!name) name = word.slice(0, 40);
      break;
    }
    name = longer;
  }
  return `${name ? `qr-${name}` : 'qr-code'}.${ext}`;
}
