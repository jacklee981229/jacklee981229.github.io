// Count Words: what gets counted, kept apart from the page so the tests can check it.

// Word boundaries from the browser's own dictionary, so Chinese (written without spaces) is counted by words too.
const words = new Intl.Segmenter(undefined, { granularity: 'word' });
// Characters as people see them: an emoji with a skin tone is one character, not four.
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Reading speed for the estimate, in words per minute. */
export const WORDS_PER_MINUTE = 200;

/** @param {string} text */
export function countText(text) {
  const normal = text.replace(/\r\n?/g, '\n');
  const chars = [...graphemes.segment(normal)].map((s) => s.segment).filter((c) => c !== '\n');
  // "well-known" is one word, as in a word processor; the underscore keeps the segmenter from splitting it.
  const joined = normal.replace(/(\p{L})-(?=\p{L})/gu, '$1_');
  const wordCount = [...words.segment(joined)].filter((s) => s.isWordLike).length;
  // A line break at the very end doesn't start a new line.
  const body = normal.replace(/\n$/, '');
  return {
    characters: chars.length,
    charactersNoSpaces: chars.filter((c) => !/^\s+$/u.test(c)).length,
    words: wordCount,
    lines: body ? body.split('\n').length : 0,
    paragraphs: normal.split(/\n\s*\n/).filter((p) => p.trim()).length,
    minutes: wordCount / WORDS_PER_MINUTE,
  };
}

/** @param {number} minutes */
export function readingTime(minutes) {
  if (minutes === 0) return '0 min';
  if (minutes < 1) return 'Under 1 min';
  return `About ${Math.round(minutes)} min`;
}
