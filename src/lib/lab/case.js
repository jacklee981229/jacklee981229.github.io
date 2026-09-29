// Change Case: the eight cases, kept apart from the page so the tests can check them.

/** In the order the page shows them; `code` ones sit in a second row, for code. */
export const CASES = [
  { id: 'upper', name: 'UPPERCASE' },
  { id: 'lower', name: 'lowercase' },
  { id: 'title', name: 'Title Case' },
  { id: 'sentence', name: 'Sentence case' },
  { id: 'camel', name: 'camelCase', code: true },
  { id: 'pascal', name: 'PascalCase', code: true },
  { id: 'snake', name: 'snake_case', code: true },
  { id: 'kebab', name: 'kebab-case', code: true },
];

// A letter starting a word: no letter, accent or digit just before it, and not the "t" in "don't".
const WORD_START = /(?<![\p{L}\p{M}\p{N}]|[\p{L}\p{M}\p{N}]['’])\p{L}/gu;
// The first letter of the text, of a line, or after . ! or ? (and any closing quote) and a space, past any opening
// quote or bracket. The last dot of "i.e." or "U.S." doesn't end a sentence.
const SENTENCE_START = /(^|(?:[!?]|(?<!\.\p{L})\.)["'”’)\]]*\s+|\n\s*)(["'“‘([]*)(\p{L})/gu;
// "i" on its own ("i think", "i'm") is always a capital, but not the one in "i.e.".
const LONE_I = /(?<![\p{L}\p{M}\p{N}])i(?![\p{L}\p{M}\p{N}]|\.\p{L})/gu;
// An apostrophe inside a word, dropped for the code cases: "don't" becomes one word, "dont".
const INNER_APOSTROPHE = /(?<=[\p{L}\p{N}])['’](?=\p{L})/gu;
// Where one word ends and the next begins inside "XMLHttpRequest" or "version2Update".
const CASE_BREAK = /(?<=[\p{Ll}\p{N}])(?=\p{Lu})|(?<=\p{Lu})(?=\p{Lu}\p{Ll})/u;

/** @param {string} word */
const capital = (word) => {
  const [first = '', ...rest] = word.toLowerCase();
  return first.toUpperCase() + rest.join('');
};

/** The words of a line for the code cases: "XMLHttpRequest id_2" gives XML, Http, Request, id, 2. @param {string} line */
function wordsOf(line) {
  return line
    .replace(INNER_APOSTROPHE, '')
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .flatMap((chunk) => chunk.split(CASE_BREAK))
    .filter(Boolean);
}

/** @param {string[]} words @param {string} to */
function joinWords(words, to) {
  if (to === 'camel') return words.map((w, i) => (i ? capital(w) : w.toLowerCase())).join('');
  if (to === 'pascal') return words.map(capital).join('');
  if (to === 'snake') return words.map((w) => w.toLowerCase()).join('_');
  return words.map((w) => w.toLowerCase()).join('-');
}

/**
 * @param {string} text
 * @param {string} to the id of one of CASES
 */
export function changeCase(text, to) {
  if (!CASES.some((c) => c.id === to)) throw new Error(`No case "${to}". Use one of CASES in src/lib/lab/case.js.`);
  if (to === 'upper') return text.toUpperCase();
  if (to === 'lower') return text.toLowerCase();
  if (to === 'title') return text.toLowerCase().replace(WORD_START, (c) => c.toUpperCase());
  if (to === 'sentence') {
    return text.toLowerCase()
      .replace(SENTENCE_START, (_, before, open, c) => before + open + c.toUpperCase())
      .replace(LONE_I, 'I');
  }
  // The code cases work line by line, so a list of names stays a list.
  return text.split('\n').map((line) => joinWords(wordsOf(line), to)).join('\n');
}
