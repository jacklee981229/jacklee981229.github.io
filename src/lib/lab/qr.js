// QR Code Generator: a link or message turned into a QR code's squares (by uqr), and the squares drawn as an SVG file and
// as the pixels of a PNG: an orange card, a white panel inside it with the border scanners count on, and the site's logo
// in the middle; kept apart from the page so the tests can read every drawn code back.
import { encode } from 'uqr';
import { logoSvg } from '../logo.js';

/** The white border around a code, in squares: the standard's minimum. */
export const BORDER = 4;
/** The card's orange frame around the white border, in squares. */
export const FRAME = 3;
/** How much of a code can be smudged or covered and still read: H, about 30%, so the logo in the middle can cover
    some squares. */
const LEVEL = 'H';
/** How far across the code (its border aside) the logo's tile reaches: the share of squares it covers stays far under
    what H can lose, at every size. */
const LOGO = 0.26;
/** The card's corners and the white panel's, in squares. */
const CARD_ROUND = 4;
const PANEL_ROUND = 2.5;

/**
 * @typedef {{ size: number, dark: boolean[][], logo: { at: number, tile: number } }} Squares
 * A code's squares, its border included: `dark[y][x]` is true for a dark one. `logo` is the square tile in the middle
 * kept clear for the logo: its first row and column, and how many squares across.
 * @typedef {{ ink: string, paper: string, frame: string }} Colours  the dark squares', the panel's and the card's, as
 * #RRGGBB
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
  // Whole squares, centred: every code is an odd number of squares across, so the tile is the odd number nearest its
  // share, sitting on the middle square with none half covered.
  const inner = size - 2 * BORDER;
  const tile = 2 * Math.round((inner * LOGO - 1) / 2) + 1;
  const at = (size - tile) / 2;
  const dark = data.map((row, y) => row.map((on, x) => on && !(x >= at && x < at + tile && y >= at && y < at + tile)));
  return { size, dark, logo: { at, tile } };
}

/**
 * The logo's place inside its tile, in squares from the code's corner: a margin of white all round.
 * @param {Squares} squares @returns {{ x: number, y: number, width: number }}
 */
export function qrLogoBox({ logo: { at, tile } }) {
  const pad = tile * 0.12;
  return { x: at + pad, y: at + pad, width: tile - 2 * pad };
}

/**
 * A code as an SVG file: the card, the panel, one path of dark squares with crisp edges at any size, and the logo. It
 * says it's 1024 pixels square, so apps that place it at its own size don't make it tiny; the page sizes it to fit.
 * The code's own corner is at 0 0, the card reaching FRAME squares past it.
 * @param {Squares} squares @param {Colours} colours @returns {string}
 */
export function qrSvg(squares, { ink, paper, frame }) {
  const { size, dark } = squares;
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
  const card = size + 2 * FRAME;
  const box = qrLogoBox(squares);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${-FRAME} ${-FRAME} ${card} ${card}">`
    + `<rect x="${-FRAME}" y="${-FRAME}" width="${card}" height="${card}" rx="${CARD_ROUND}" fill="${frame}"/>`
    + `<rect width="${size}" height="${size}" rx="${PANEL_ROUND}" fill="${paper}"/>`
    + `<path d="${path}" fill="${ink}" shape-rendering="crispEdges"/>`
    + logoSvg('qr-logo', `x="${box.x}" y="${box.y}" width="${box.width}" height="${box.width}"`)
    + '</svg>';
}

/** @param {string} hex #RRGGBB */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Whether a point lies inside a square of side `side` with round corners of `round`. */
const inRounded = (x, y, side, round) => {
  const cx = Math.min(Math.max(x, round), side - round);
  const cy = Math.min(Math.max(y, round), side - round);
  return (x - cx) ** 2 + (y - cy) ** 2 <= round ** 2;
};

/**
 * A code's pixels for a PNG, as ImageData takes them (red, green, blue, alpha): the card and panel as qrSvg draws them,
 * clear outside the card's corners, every square the same whole number of pixels so its edges stay sharp, and the
 * picture at least `least` pixels across. The logo isn't drawn here: the page lays it over the clear tile, at
 * `scale`, the pixels per square.
 * @param {Squares} squares @param {Colours} colours @param {number} [least]
 * @returns {{ width: number, height: number, scale: number, data: Uint8ClampedArray<ArrayBuffer> }}
 */
export function qrPixels({ size, dark }, { ink, paper, frame }, least = 1024) {
  const card = size + 2 * FRAME;
  const scale = Math.ceil(least / card);
  const width = card * scale;
  const data = new Uint8ClampedArray(width * width * 4);
  const on = rgb(ink);
  const off = rgb(paper);
  const edge = rgb(frame);
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      // The pixel's middle, in squares from the card's corner.
      const sx = (x + 0.5) / scale;
      const sy = (y + 0.5) / scale;
      if (!inRounded(sx, sy, card, CARD_ROUND)) continue;
      const cx = Math.floor(sx) - FRAME;
      const cy = Math.floor(sy) - FRAME;
      const panel = inRounded(sx - FRAME, sy - FRAME, size, PANEL_ROUND);
      const [r, g, b] = !panel ? edge : dark[cy][cx] ? on : off;
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width, height: width, scale, data };
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
