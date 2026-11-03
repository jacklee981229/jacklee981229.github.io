// CSV Preview's rules: reading CSV into rows of cells (commas, semicolons or tabs; quoted cells with the separator,
// quotes or line breaks inside), and sorting and searching the rows. A stray quote in the middle of a cell is kept as
// written, as spreadsheets do; only a quoted cell that never closes is a problem.

/** The separators tried, in the order a tie goes. */
const SEPARATORS = [',', ';', '\t'];

/**
 * @typedef {{ ok: true, notes: string[], header: string[], rows: string[][], separator: string }
 *   | { ok: false, message: string, line: number }} CsvResult
 */

/** Rows looked at to work out the separator and the header: a report's title lines sit within the first few. */
const LOOK = 20;

/**
 * The separator the text uses: of comma, semicolon and tab (outside quotes), the one that appears the same number of
 * times on the most of the first rows. Steadiness, not the total, decides, so a title line ("Sales; March") or the
 * decimal commas of a semicolon file (`1,5;2,5`) don't.
 * @param {string} text
 */
export function separatorOf(text) {
  /** @type {Map<string, number>[]} Each row's count of each separator. */
  const lines = [];
  let counts = new Map(SEPARATORS.map((s) => [s, 0]));
  // Quotes count as readCsv() reads them: only at a cell's start, so the 5" in `5" TV;price` is just a character.
  let quoted = false;
  for (let i = 0; i < text.length && lines.length < LOOK; i++) {
    const c = text[i];
    const prev = text[i - 1];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') i++;
        else quoted = false;
      }
    } else if (c === '"' && (i === 0 || prev === '\n' || prev === '\r' || SEPARATORS.includes(prev))) quoted = true;
    else if (c === '\n' || (c === '\r' && text[i + 1] !== '\n')) {
      lines.push(counts);
      counts = new Map(SEPARATORS.map((s) => [s, 0]));
    } else if (counts.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  lines.push(counts);
  let best = SEPARATORS[0];
  let bestRows = 0;
  for (const s of SEPARATORS) {
    // How many rows share this separator's most common count, leaving out rows without it.
    /** @type {Map<number, number>} */
    const seen = new Map();
    for (const line of lines) {
      const n = line.get(s) ?? 0;
      if (n) seen.set(n, (seen.get(n) ?? 0) + 1);
    }
    const rows = Math.max(0, ...seen.values());
    if (rows > bestRows) [best, bestRows] = [s, rows];
  }
  return best;
}

/**
 * Reads CSV. The header is the first full row (headerAt), the lines above it notes; every row gets as many cells as
 * the widest row, short ones filled with empty cells. Blank lines are left out. A problem comes back as a plain message with its line (from 1).
 * @param {string} text @returns {CsvResult}
 */
export function readCsv(text) {
  // A file saved with a byte-order mark starts with an invisible character; it isn't part of the first cell.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const separator = separatorOf(text);
  /** @type {string[][]} */
  const all = [];
  /** @type {string[]} */
  let row = [];
  let cell = '';
  let line = 1;
  let i = 0;
  const endRow = () => {
    row.push(cell);
    cell = '';
    // A blank line, or one of only separators (`,,,`), holds nothing.
    if (row.some((c) => c !== '')) all.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (c === '"' && cell === '') {
      const opened = line;
      i++;
      for (;;) {
        if (i >= text.length) return { ok: false, message: 'A quoted cell never closes: it needs a " at its end.', line: opened };
        const q = text[i];
        if (q === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
          i++;
          break;
        }
        if (q === '\n' || (q === '\r' && text[i + 1] !== '\n')) line++;
        cell += q;
        i++;
      }
      // Whatever follows the closing quote, up to the separator, joins the cell as written.
      continue;
    }
    if (c === separator) {
      row.push(cell);
      cell = '';
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      line++;
      endRow();
    } else {
      cell += c;
    }
    i++;
  }
  if (cell !== '' || row.length) endRow();
  const start = headerAt(all);
  const notes = all.slice(0, start).map((r) => r[0].trim());
  const table = all.slice(start);
  // A loop, not Math.max(...rows): spreading a few hundred thousand rows overflows the call stack.
  let width = 0;
  for (const r of table) if (r.length > width) width = r.length;
  for (const r of table) while (r.length < width) r.push('');
  return { ok: true, notes, header: table[0] ?? [], rows: table.slice(1), separator };
}

/**
 * Where the header is: past the rows at the top that hold one cell only (`Title` or `Title,,`), such as a report's
 * title, when a row further down has more. Those rows are notes, not the header.
 * shortcut: a title with separators in it (`Sales, March`) still becomes the header; look for a better rule if
 * people bring such files.
 * @param {string[][]} rows
 */
function headerAt(rows) {
  const single = (/** @type {string[]} */ r) => r.slice(1).every((c) => c === '');
  const at = rows.slice(0, LOOK).findIndex((r) => !single(r));
  return Math.max(0, at);
}

/** A cell that reads as a plain number ("12", "-3.5", "1e3"), as that number; anything else, null. @param {string} cell */
function numberOf(cell) {
  const t = cell.trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  const n = Number(t);
  // 1e999 is too big to be a number here; it sorts as text.
  return Number.isFinite(n) ? n : null;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * Two cells in order: numbers by size and before text, text alphabetically ("item 9" before "item 10").
 * @param {string} a @param {string} b
 */
export function compareCells(a, b) {
  const x = numberOf(a);
  const y = numberOf(b);
  if (x !== null && y !== null) return x - y;
  if (x !== null) return -1;
  if (y !== null) return 1;
  return collator.compare(a, b);
}

/**
 * The rows sorted by one column, smallest first ('up') or largest first ('down'); rows that tie keep their order.
 * Empty cells go last either way.
 * @param {string[][]} rows @param {number} column @param {'up' | 'down'} direction
 */
export function sortRows(rows, column, direction) {
  const sign = direction === 'up' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const p = a[column].trim() === '';
    const q = b[column].trim() === '';
    if (p || q) return Number(p) - Number(q);
    return sign * compareCells(a[column], b[column]);
  });
}

/**
 * The rows with a cell that holds `query`, capitals ignored. An empty query keeps every row.
 * @param {string[][]} rows @param {string} query
 */
export function filterRows(rows, query) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return rows;
  return rows.filter((row) => row.some((cell) => cell.toLocaleLowerCase().includes(q)));
}
