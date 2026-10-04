// The command palette's matching: which items fit what was typed, best first. Small on purpose (no package): case
// and accents don't matter, the words can come in any order, and a word that starts a word in the item counts for
// more than one found inside a word. An item can carry extra words to be found by ("dark", "random").

/** @typedef {{ title: string, group: string, description?: string, words?: string[] }} Item */

/** The groups, in the order they're shown. Posts come last: they're Pagefind's, not matched here. */
export const GROUPS = ['Actions', 'Pages', 'Lab', 'Posts'];

/** Small letters, no accents ("Moiré" is "moire"). @param {string} text */
export const fold = (text) => text.toLowerCase().normalize('NFKD').replace(/[\u{300}-\u{36f}]/gu, '');

/** The words in some text, folded. @param {string} text */
export const wordsOf = (text) => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * How well an item fits the typed words: 0 when one of them isn't in it at all, more the better it fits.
 * @param {Item} item @param {string} query
 */
export function score(item, query) {
  const typed = wordsOf(query);
  if (!typed.length) return 0;
  const title = wordsOf(item.title);
  const extra = (item.words ?? []).flatMap(wordsOf);
  const about = wordsOf(item.description ?? '');
  let total = 0;
  for (const word of typed) {
    const best = Math.max(
      title.includes(word) ? 120 : title.some((w) => w.startsWith(word)) ? 100 : title.some((w) => w.includes(word)) ? 40 : 0,
      extra.includes(word) ? 90 : extra.some((w) => w.startsWith(word)) ? 80 : extra.some((w) => w.includes(word)) ? 30 : 0,
      about.some((w) => w.startsWith(word)) ? 50 : about.some((w) => w.includes(word)) ? 20 : 0,
    );
    if (!best) return 0;
    total += best;
  }
  // The title starting with what was typed, as typed, is the clearest fit of all.
  if (fold(item.title).startsWith(fold(query.trim()))) total += 60;
  return total;
}

/**
 * The items that fit, by group in GROUPS' order, the best fit first within a group; equal fits keep their order.
 * @template {Item} T @param {T[]} items @param {string} query @returns {T[]}
 */
export function search(items, query) {
  return items
    .map((item, index) => ({ item, index, fit: score(item, query) }))
    .filter((r) => r.fit > 0)
    .sort((a, b) => GROUPS.indexOf(a.item.group) - GROUPS.indexOf(b.item.group) || b.fit - a.fit || a.index - b.index)
    .map((r) => r.item);
}

/**
 * A small fingerprint of a word (32-bit FNV-1a, in hex), trimmed and in small letters, so the page can tell the
 * secret word without holding it. A toy, not security.
 * @param {string} text
 */
export function fingerprint(text) {
  let hash = 0x811c9dc5;
  for (const ch of fold(text.trim())) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Something to open at random, never the page you're on (unless it's the only thing there is).
 * @template {{ href: string }} T @param {T[]} things @param {string} here the current page's path @param {() => number} [random]
 * @returns {T | undefined}
 */
export function pickOne(things, here, random = Math.random) {
  const others = things.filter((t) => t.href !== here);
  const from = others.length ? others : things;
  return from[Math.floor(random() * from.length)];
}
