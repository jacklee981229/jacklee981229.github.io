// Clean Text: the cleaning steps, kept apart from the page so the tests can check them.

/**
 * The options, and how the page starts: every step on, keeping one empty line between paragraphs.
 * @typedef {{ lineBreaks: boolean, trim: boolean, spaces: boolean, emptyLines: 'one' | 'none' | 'keep' }} Options
 * @type {Options}
 */
export const DEFAULTS = { lineBreaks: true, trim: true, spaces: true, emptyLines: 'one' };

// Line breaks other than a plain one: Windows and old Mac ones, and the rarer ones Word and PDFs leave in copied text.
const ODD_BREAKS = /\r\n?|[\v\f\u{85}\u{2028}\u{2029}]/gu;
// Two or more spaces, tabs, no-break spaces or other Unicode spaces in a row (not line breaks).
const SPACE_RUN = /[^\S\n]{2,}/g;
const isEmpty = (/** @type {string} */ line) => !/\S/.test(line);

/**
 * @param {string} text
 * @param {Partial<Options>} [options]
 */
export function cleanText(text, options) {
  const o = { ...DEFAULTS, ...options };
  let lines = (o.lineBreaks ? text.replace(ODD_BREAKS, '\n') : text).split('\n');
  if (o.trim) lines = lines.map((line) => line.trim());
  if (o.spaces) lines = lines.map((line) => line.replace(SPACE_RUN, ' '));
  if (o.emptyLines === 'none') lines = lines.filter((line) => !isEmpty(line));
  if (o.emptyLines === 'one') lines = lines.filter((line, i) => !(isEmpty(line) && i > 0 && isEmpty(lines[i - 1])));
  // Trimming also takes the empty lines off the start and end of the text.
  if (o.trim) {
    while (lines.length && !lines[0]) lines.shift();
    while (lines.length && !lines[lines.length - 1]) lines.pop();
  }
  return lines.join('\n');
}
