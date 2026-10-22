// Canvas text has no tabular figures (font-variant-numeric doesn't reach it), so a number that changes in place on a
// canvas (the Build Log's counters, Site Check's) shifts as its digits change width. This lays a string out with every
// digit in the widest digit's width, centred in it; anything else keeps its own width.

const DIGITS = '0123456789';

/**
 * Where each character of `words` is centred, from the string's start, and the whole width.
 * @param {string} words
 * @param {(s: string) => number} measure a string's width in the current font
 * @returns {{ parts: { ch: string, x: number }[], width: number }}
 */
export function tabularLayout(words, measure) {
  let digit = 0;
  for (const d of DIGITS) digit = Math.max(digit, measure(d));
  const parts = [];
  let x = 0;
  for (const ch of words) {
    const w = DIGITS.includes(ch) ? digit : measure(ch);
    parts.push({ ch, x: x + w / 2 });
    x += w;
  }
  return { parts, width: x };
}

/**
 * Draws `words` on `g` in its current font and colour with even digits, aligned at `x` as `align` says.
 * @param {CanvasRenderingContext2D} g
 * @param {string} words
 * @param {number} x
 * @param {number} y
 * @param {CanvasTextAlign} [align]
 * @returns {number} the width drawn
 */
export function fillTabular(g, words, x, y, align = 'left') {
  const { parts, width } = tabularLayout(words, (s) => g.measureText(s).width);
  const start = align === 'right' || align === 'end' ? x - width : align === 'center' ? x - width / 2 : x;
  const was = g.textAlign;
  g.textAlign = 'center';
  for (const p of parts) g.fillText(p.ch, start + p.x, y);
  g.textAlign = was;
  return width;
}
