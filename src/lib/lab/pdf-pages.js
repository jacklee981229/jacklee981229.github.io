// PDF Pages: the parts that don't need a browser, kept apart from the page so the tests can check them: page ranges
// typed as "1-3, 5", where Split cuts, moving and turning pages, and what each task's Save makes (which pages go in
// which file, turned how, under what name). The page reads and writes the PDFs themselves.

/** Past this many pages the board shows a list instead of big previews (once, when files push it over). */
export const LIST_FROM = 10;

/** The tasks above the board. All is the free board; each other one adds its own few controls. */
export const TASKS = [
  { id: 'all', label: 'All' },
  { id: 'merge', label: 'Merge' },
  { id: 'split', label: 'Split' },
  { id: 'turn', label: 'Turn' },
  { id: 'out', label: 'Take pages out' },
  { id: 'numbers', label: 'Page numbers' },
  { id: 'text', label: 'Get text' },
  { id: 'pics', label: 'To pictures' },
];

/** A page's number as printed: "3", or "3 / 9" with the count. @param {number} i 0-based place @param {number} count @param {'n' | 'of'} style */
export const pageNumber = (i, count, style) => (style === 'of' ? `${i + 1} / ${count}` : `${i + 1}`);

/**
 * Where a page number goes so it reads upright at the bottom of the page as it shows, however the page is turned:
 * the start of its baseline in the page's own (unturned, y-up) space, and how far to turn the text.
 * @param {object} o
 * @param {{ x: number, y: number, width: number, height: number }} o.box the page's visible box
 * @param {number} o.turn how far the page shows turned, clockwise
 * @param {'centre' | 'right'} o.where
 * @param {number} o.textWidth @param {number} o.size the text's width and height
 * @returns {{ x: number, y: number, rotate: number, size: number }}
 */
export function numberSpot({ box, turn, where, textWidth, size }) {
  const q = quarter(turn);
  const { x, y, width: w, height: h } = box;
  // Worked out on the page as it shows (vw by vh, y up), then carried back onto the unturned page.
  const [vw] = q % 180 ? [h, w] : [w, h];
  const u = where === 'right' ? vw - size * 3.6 - textWidth : (vw - textWidth) / 2;
  const v = size * 2.4;
  const at = { 0: [x + u, y + v], 90: [x + w - v, y + u], 180: [x + w - u, y + h - v], 270: [x + v, y + h - u] }[q];
  return { x: at[0], y: at[1], rotate: q, size };
}

/** The page numbers' size for a page: 11 points on A4 and bigger, smaller on small pages, never under 6. @param {{ width: number, height: number }} box */
export const numberSize = (box) => Math.max(6, Math.min(11, Math.min(box.width, box.height) / 50));

/**
 * Where the board's preview of a number sits on a page's picture, in percent from its top left, before the picture
 * is turned by `turn`: so after turning it shows at the bottom. @param {number} turn @param {'centre' | 'right'} where
 */
export function previewSpot(turn, where) {
  const far = where === 'right' ? 12 : 50;
  return { 0: { x: 100 - far, y: 93 }, 90: { x: 93, y: far }, 180: { x: far, y: 7 }, 270: { x: 7, y: 100 - far } }[quarter(turn)];
}

/**
 * A page's text from pdf.js's pieces (each with its words and whether a line ends after it), line by line, with
 * spaces tidied and empty lines dropped.
 * @param {{ str?: string, hasEOL?: boolean, type?: string }[]} items (a marked-content piece has only a type)
 */
export function pageText(items) {
  let out = '';
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    out += item.str;
    if (item.hasEOL) out += '\n';
  }
  return out.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

/** Every page's text in one, a line before each page; a page with none says so. @param {string[]} texts in the board's order */
export const joinPages = (texts) =>
  texts.map((text, i) => (text ? `— Page ${i + 1} —\n${text}` : `— Page ${i + 1}: no text, it may be a scan —`)).join('\n\n');

/**
 * The pages a typed range picks, as 0-based places on the board, in order and once each. "1-3, 5" picks the first
 * three and the fifth; "5-3" counts as "3-5"; numbers past the last page and anything that isn't a number are left out.
 * @param {string} text @param {number} count how many pages the board has @returns {number[]}
 */
export function parseRange(text, count) {
  const picked = new Set();
  for (const part of text.split(/[,，;；]/)) {
    const m = part.replace(/\s/g, '').match(/^(\d+)(?:[-–~](\d+))?$/);
    if (!m) continue;
    let [a, b] = [Number(m[1]), m[2] ? Number(m[2]) : Number(m[1])];
    if (a > b) [a, b] = [b, a];
    for (let n = Math.max(1, a); n <= Math.min(count, b); n++) picked.add(n - 1);
  }
  return [...picked].sort((x, y) => x - y);
}

/** The places back as a range to type: [0, 1, 2, 4] is "1-3, 5". @param {Iterable<number>} places 0-based */
export function toRange(places) {
  const n = [...new Set(places)].sort((x, y) => x - y).map((i) => i + 1);
  const parts = [];
  for (let i = 0; i < n.length; ) {
    let j = i;
    while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++;
    parts.push(j > i ? `${n[i]}-${n[j]}` : `${n[i]}`);
    i = j + 1;
  }
  return parts.join(', ');
}

/**
 * After which pages Split cuts: by hand (`cuts`, the places a visitor chose), after every page, or after every
 * `every` pages. Never after the last page.
 * @param {number} count @param {'cuts' | 'each' | 'every'} by @param {{ every?: number, cuts?: Iterable<number> }} [o]
 * @returns {boolean[]}
 */
export function cutsAfter(count, by, { every = 2, cuts = [] } = {}) {
  const chosen = new Set(cuts);
  return Array.from({ length: count }, (_, i) => {
    if (i === count - 1) return false;
    if (by === 'each') return true;
    if (by === 'every') return (i + 1) % every === 0;
    return chosen.has(i);
  });
}

/** The parts the cuts make, each a list of places: cuts after 2 of 5 pages make [[0, 1, 2], [3, 4]]. @param {boolean[]} cuts */
export function parts(cuts) {
  const out = [[]];
  cuts.forEach((cut, i) => {
    out[out.length - 1].push(i);
    if (cut && i < cuts.length - 1) out.push([]);
  });
  return cuts.length ? out : [];
}

/** A copy of the list with the item at `from` moved to `to`. @template T @param {T[]} list @param {number} from @param {number} to */
export function move(list, from, to) {
  const out = [...list];
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, item);
  return out;
}

/** Any number of quarter turns as 0, 90, 180 or 270: -90 is 270, 450 is 90. @param {number} deg */
export const quarter = (deg) => ((Math.round(deg / 90) * 90) % 360 + 360) % 360;

/**
 * Pages sorted by their files' new order, each file's pages keeping their own order among themselves.
 * @template {{ file: string }} P @param {P[]} pages @param {string[]} fileOrder file ids
 */
export function byFileOrder(pages, fileOrder) {
  const at = new Map(fileOrder.map((id, i) => [id, i]));
  return [...pages].sort((a, b) => (at.get(a.file) ?? 0) - (at.get(b.file) ?? 0));
}

/**
 * Whether adding files should turn the board into the list by itself: only the moment the board goes past
 * LIST_FROM pages, so a visitor who switches back to previews keeps them.
 * @param {number} before @param {number} after
 */
export const turnsToList = (before, after) => before <= LIST_FROM && after > LIST_FROM;

/** A file's name without its ending, safe to build new names on: "Report 2026.PDF" is "Report 2026". @param {string} name */
export function baseName(name) {
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[\\/:*?"<>|]+/g, '-').trim();
  return base || 'document';
}

/**
 * What a task's Save makes: a list of files, each with its pages (from which file, which page of it, turned how
 * much more than it already was), or pictures of pages. Nothing to save is an empty list.
 *
 * @param {object} o
 * @param {string} o.task one of TASKS
 * @param {{ file: string, n: number, turn: number }[]} o.pages the board, in order (n counts from 1 in its file)
 * @param {boolean[]} o.chosen which places on the board are chosen
 * @param {string} o.base the first page's file name, for the new names
 * @param {boolean} [o.onlyChosen] All: save the chosen pages only
 * @param {boolean[]} [o.cuts] Split: cutsAfter() for the board
 * @param {'jpg' | 'png'} [o.picture] To pictures: the type
 * @param {{ where: 'centre' | 'right', style: 'n' | 'of' }} [o.numbers] Page numbers: where and how
 * @returns {{ zip: string | null, files: { name: string, kind: 'pdf' | 'jpg' | 'png', pages: { file: string, n: number, turn: number }[], numbers?: { where: 'centre' | 'right', style: 'n' | 'of' } }[] }}
 */
export function saveFiles({ task, pages, chosen, base, onlyChosen = false, cuts = [], picture = 'jpg', numbers = { where: 'centre', style: 'n' } }) {
  const stem = baseName(base);
  const page = (i) => ({ file: pages[i].file, n: pages[i].n, turn: quarter(pages[i].turn) });
  const all = pages.map((_, i) => i);
  const picked = all.filter((i) => chosen[i]);
  const pdf = (name, places) => ({ zip: null, files: places.length ? [{ name, kind: /** @type {const} */ ('pdf'), pages: places.map(page) }] : [] });
  if (task === 'all') return pdf(`${stem}-edited.pdf`, onlyChosen ? picked : all);
  if (task === 'merge') return pdf(`${stem}-merged.pdf`, all);
  if (task === 'turn') return pdf(`${stem}-turned.pdf`, all);
  if (task === 'out') return pdf(`${stem}-edited.pdf`, all.filter((i) => !chosen[i]));
  if (task === 'numbers') {
    const made = pdf(`${stem}-numbered.pdf`, all);
    return { ...made, files: made.files.map((f) => ({ ...f, numbers })) };
  }
  // Get text saves what it has read, on the page itself.
  if (task === 'text') return { zip: null, files: [] };
  if (task === 'split') {
    const made = parts(cuts.length === pages.length ? cuts : cutsAfter(pages.length, 'cuts'));
    if (made.length < 2) return { zip: null, files: [] };
    const width = Math.max(1, String(made.length).length);
    return { zip: `${stem}-split.zip`, files: made.map((places, k) => ({ name: `${stem}-part-${String(k + 1).padStart(width, '0')}.pdf`, kind: 'pdf', pages: places.map(page) })) };
  }
  // To pictures: the chosen pages, or every page when none are chosen; one picture is saved as it is.
  const places = picked.length ? picked : all;
  const width = Math.max(2, String(pages.length).length);
  const files = places.map((i) => ({ name: `${stem}-page-${String(i + 1).padStart(width, '0')}.${picture}`, kind: picture, pages: [page(i)] }));
  return { zip: files.length > 1 ? `${stem}-pictures.zip` : null, files };
}
