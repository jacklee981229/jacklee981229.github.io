// The site's logo: Jack's pixel face, after his avatar, peeking up into an orange-to-pink circle, in mirror glasses
// with a glint in each lens. One drawing for the tab icon (/favicon.svg), the menu bar and the welcome and loading
// screen. Its colours are the drawing's own, not the site's tokens: the logo looks the same in every theme.

/** The face, a letter a pixel: H hair, S skin, G glasses, L lens, Z a glint on a lens, E ear, R cheek, P mouth,
    N neck, J collar; '.' is the circle behind. */
const FACE = [
  '.....HHHHHHH....',
  '...HHHHHHHHHHH..',
  '..HHHHHHHHHHHHH.',
  '..HHHSSHHHHHHHH.',
  '..HHSSSSSSSSHHH.',
  '..HSSSSSSSSSSSH.',
  '.GGGGGGGSGGGGGGG',
  '.EGZLLLGGGZLLLGE',
  '.EGLLLLGSGLLLLGE',
  '.EGGGGGGSGGGGGGE',
  '..SSSSSSSSSSSSS.',
  '..SRSSSSSSSSSRS.',
  '..SSSSSPPPPSSSS.',
  '...SSSSSSSSSSS..',
  '.....NNNNNNN....',
  '...JJJJJJJJJJJ..',
];
const COLOURS = { H: '#141414', S: '#FCE0AE', G: '#141414', L: '#BDE4FF', E: '#B5643A', R: '#E8202A', P: '#FF2D95', N: '#F6A15E', J: '#141414' };
const GLINT = '#FFFFFF';
/** Where the face sits in the 100 by 100 drawing, and how big a pixel is: low, so it peeks up from the circle's foot. */
const LEFT = 18;
const TOP = 30;
const PIXEL = 4;

/** The face as rectangles, each run of one colour along a row as one, so the file stays small. A glint is a lens
    pixel with a white one over it (class "glint"), which a page can make blink. */
function face() {
  const out = [];
  FACE.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      const colour = ch === 'Z' ? COLOURS.L : COLOURS[ch];
      let end = x + 1;
      while (end < row.length && (row[end] === 'Z' ? COLOURS.L : COLOURS[row[end]]) === colour) end++;
      out.push(`<rect x="${LEFT + x * PIXEL}" y="${TOP + y * PIXEL}" width="${(end - x) * PIXEL}" height="${PIXEL}" fill="${colour}"/>`);
      x = end;
    }
    [...row].forEach((ch, gx) => {
      if (ch === 'Z') out.push(`<rect class="glint" x="${LEFT + gx * PIXEL}" y="${TOP + y * PIXEL}" width="${PIXEL}" height="${PIXEL}" fill="${GLINT}"/>`);
    });
  });
  return out.join('');
}

/**
 * The logo as SVG markup.
 * @param {string} id makes the drawing's gradient and clip names unique, for a page that shows the logo twice
 * @param {string} [attrs] attributes for the <svg> (class, size, aria)
 */
export function logoSvg(id, attrs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${attrs && ` ${attrs}`}>`
    + `<defs><linearGradient id="logo-sky-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFA41B"/><stop offset="1" stop-color="#FF375F"/></linearGradient>`
    + `<clipPath id="logo-round-${id}"><circle cx="50" cy="50" r="48"/></clipPath></defs>`
    + `<circle cx="50" cy="50" r="48" fill="url(#logo-sky-${id})"/>`
    + `<g clip-path="url(#logo-round-${id})" shape-rendering="crispEdges">${face()}</g>`
    + '</svg>';
}
