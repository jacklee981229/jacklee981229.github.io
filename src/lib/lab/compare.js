// Compare Text: two versions of a text compared line by line, and inside a changed line word by word (character by
// character for Chinese, which has no spaces between words), with the diff package; kept apart from the page so the
// tests can check it.
import { diffChars, diffLines, diffWordsWithSpace } from 'diff';

/**
 * @typedef {{ text: string, marked: boolean }} Part  a piece of a line, marked when it's what changed
 * @typedef {{ kind: 'same' | 'add' | 'remove', parts: Part[], before?: number, after?: number }} Row
 *   a line, unchanged, added or removed, with its number in each version it's in
 * @typedef {{ kind: 'gap', count: number }} Gap  unchanged lines left out of the view
 */

/** A text's lines, any kind of line break, and none counted after the last line. @param {string} text */
const linesOf = (text) => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
};

/** Chinese, Japanese or Korean, which go without spaces between words. */
const CJK = /[\u{3040}-\u{30ff}\u{3400}-\u{9fff}\u{ac00}-\u{d7af}\u{f900}-\u{faff}]/u;

/** One whole line, nothing marked inside it. @param {string} text @returns {Part[]} */
const whole = (text) => [{ text, marked: false }];

/** Longer than this, comparing gives up: two long and very different texts could otherwise hold the page up. */
const MOST_MS = 2000;

/**
 * The two versions compared: every line in order, and how many lines were added and removed; `slow` (and no rows)
 * when they were too long and too different to compare in time.
 * @param {string} before @param {string} after
 * @returns {{ rows: Row[], added: number, removed: number, slow?: boolean }}
 */
export function compareTexts(before, after) {
  const join = (lines) => lines.map((line) => `${line}\n`).join('');
  const changes = diffLines(join(linesOf(before)), join(linesOf(after)), { timeout: MOST_MS });
  if (!changes) return { rows: [], added: 0, removed: 0, slow: true };
  /** @type {Row[]} */
  const rows = [];
  let n = 0;
  let m = 0;
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const lines = linesOf(change.value);
    if (!change.added && !change.removed) {
      for (const line of lines) rows.push({ kind: 'same', parts: whole(line), before: ++n, after: ++m });
    } else if (change.removed && changes[i + 1]?.added) {
      // Lines taken out and others put in their place: each with its counterpart, the changed words marked in both.
      const added = linesOf(changes[i + 1].value);
      const pieces = lines.map((line, k) => (k < added.length ? (CJK.test(line + added[k]) ? diffChars : diffWordsWithSpace)(line, added[k]) : null));
      lines.forEach((line, k) => {
        const words = pieces[k];
        rows.push({ kind: 'remove', parts: words ? words.filter((w) => !w.added).map((w) => ({ text: w.value, marked: w.removed })) : whole(line), before: ++n });
      });
      added.forEach((line, k) => {
        const words = pieces[k];
        rows.push({ kind: 'add', parts: words ? words.filter((w) => !w.removed).map((w) => ({ text: w.value, marked: w.added })) : whole(line), after: ++m });
      });
      i++;
    } else {
      for (const line of lines) rows.push(change.added ? { kind: 'add', parts: whole(line), after: ++m } : { kind: 'remove', parts: whole(line), before: ++n });
    }
  }
  return { rows, added: rows.filter((r) => r.kind === 'add').length, removed: rows.filter((r) => r.kind === 'remove').length };
}

/**
 * The rows to show: a long run of unchanged lines folds to a gap, leaving `keep` lines on each side of a change.
 * @param {Row[]} rows @param {number} [keep] @returns {(Row | Gap)[]}
 */
export function withContext(rows, keep = 2) {
  /** @type {(Row | Gap)[]} */
  const out = [];
  for (let i = 0; i < rows.length;) {
    if (rows[i].kind !== 'same') {
      out.push(rows[i++]);
      continue;
    }
    let j = i;
    while (j < rows.length && rows[j].kind === 'same') j++;
    const run = rows.slice(i, j);
    // Lines kept after the change above it, and before the change below it.
    const head = i === 0 ? 0 : keep;
    const tail = j === rows.length ? 0 : keep;
    if (run.length > head + tail + 1) out.push(...run.slice(0, head), { kind: 'gap', count: run.length - head - tail }, ...run.slice(run.length - tail));
    else out.push(...run);
    i = j;
  }
  return out;
}

/** What the comparison found, in a few words. @param {{ added: number, removed: number }} counts */
export function summaryOf({ added, removed }) {
  if (!added && !removed) return 'No differences.';
  const lines = (count) => `${count.toLocaleString('en-US')} ${count === 1 ? 'line' : 'lines'}`;
  if (!removed) return `${lines(added)} added.`;
  if (!added) return `${lines(removed)} removed.`;
  return `${lines(added)} added, ${removed.toLocaleString('en-US')} removed.`;
}
