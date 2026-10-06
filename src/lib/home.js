// The home page's rules: which effect is today's toy, which covers and post its doors show, how the Now lines read
// as one sentence, and which change its "Lately" line tells of. The page itself is src/pages/index.astro.

/** Whole days since 1 Jan 1970 for a date as the visitor's calendar shows it. @param {Date} date */
export const dayNumber = (date) => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);

/** The smallest step above 1 that shares no factor with n, so stepping by it visits every item before repeating. */
function strideFor(n) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  for (let k = 2; k < n; k++) if (gcd(k, n) === 1) return k;
  return 1;
}

/**
 * Today's toy: the same item for everyone on a given day, a different one the next day. Stepping through the list
 * by a stride with no factor in common with its length means two days running never land on the same one, and
 * neighbours in the list don't follow each other.
 * @template T @param {T[]} items @param {Date} date @returns {T | undefined}
 */
export function todaysToy(items, date) {
  if (!items.length) return undefined;
  const n = items.length;
  return items[(((dayNumber(date) * strideFor(n)) % n) + n) % n];
}

/**
 * The first `count` items taken from each list in turn (first of each, then second of each…), skipping lists that run out.
 * @template T @param {T[][]} lists @param {number} count @returns {T[]}
 */
export function interleave(lists, count) {
  const out = [];
  for (let i = 0; out.length < count && lists.some((l) => i < l.length); i++) {
    for (const list of lists) if (i < list.length && out.length < count) out.push(list[i]);
  }
  return out;
}

/**
 * The posts the Writing tile shows: the "Start here" ones if any are marked, otherwise the newest posts not on a
 * legacy topic. Posts come newest first.
 * @template {{ data: { featured?: boolean, topic: string } }} T
 * @param {T[]} posts @param {(topic: string) => boolean} legacy @param {number} count @returns {T[]}
 */
export function writingPicks(posts, legacy, count) {
  const start = posts.filter((p) => p.data.featured);
  return (start.length ? start : posts.filter((p) => !legacy(p.data.topic))).slice(0, count);
}

/**
 * The change the "Lately I …" line tells of: the newest one that isn't a fix, since a fix reads oddly as news.
 * @template {{ kind: string }} T @param {T[]} changes newest first @returns {T | undefined}
 */
export const lately = (changes) => changes.find((change) => change.kind !== 'fix');

/**
 * A word made ready for the middle of a sentence: "Playing" becomes "playing". Words with more capitals than the
 * first ("AI art", "iOS") are names, so they stay as written.
 * @param {string} text
 */
export const lowerFirst = (text) => (/^\p{Lu}\p{Ll}/u.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text);

/**
 * What goes before the item at `index` when `count` items read as a list: nothing before the first, "and" before
 * the last, a comma between the others ("a, b and c").
 * @param {number} index @param {number} count
 */
export const joiner = (index, count) => (index === 0 ? '' : index === count - 1 ? ' and ' : ', ');

/**
 * A Now label split into its leading emoji, if it has one, and the words: "🎮 Playing" is 🎮 and "Playing".
 * @param {string} label @returns {{ emoji?: string, text: string }}
 */
export function splitEmoji(label) {
  const match = label.match(/^(\p{Extended_Pictographic}(?:\u{FE0F}|\u{200D}\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*(.*)$/u);
  return match ? { emoji: match[1], text: match[2].trim() } : { text: label.trim() };
}
