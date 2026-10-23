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
  { id: 'pics', label: 'To pictures' },
];

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
 * @returns {{ zip: string | null, files: { name: string, kind: 'pdf' | 'jpg' | 'png', pages: { file: string, n: number, turn: number }[] }[] }}
 */
export function saveFiles({ task, pages, chosen, base, onlyChosen = false, cuts = [], picture = 'jpg' }) {
  const stem = baseName(base);
  const page = (i) => ({ file: pages[i].file, n: pages[i].n, turn: quarter(pages[i].turn) });
  const all = pages.map((_, i) => i);
  const picked = all.filter((i) => chosen[i]);
  const pdf = (name, places) => ({ zip: null, files: places.length ? [{ name, kind: /** @type {const} */ ('pdf'), pages: places.map(page) }] : [] });
  if (task === 'all') return pdf(`${stem}-edited.pdf`, onlyChosen ? picked : all);
  if (task === 'merge') return pdf(`${stem}-merged.pdf`, all);
  if (task === 'turn') return pdf(`${stem}-turned.pdf`, all);
  if (task === 'out') return pdf(`${stem}-edited.pdf`, all.filter((i) => !chosen[i]));
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
