// The home page's rules: which effect is today's toy, which Collection items and posts its tiles show, the newest
// changes, and a Now label's emoji. The page itself is src/pages/index.astro.

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
 * The newest `count` changes (the list is already newest first), grouped under their days.
 * @template {{ day: string }} T @param {T[]} changes @param {number} count @returns {{ day: string, changes: T[] }[]}
 */
export function latestChanges(changes, count) {
  const days = [];
  for (const change of changes.slice(0, count)) {
    if (days.at(-1)?.day !== change.day) days.push({ day: change.day, changes: [] });
    days.at(-1).changes.push(change);
  }
  return days;
}

/**
 * A Now label split into its leading emoji, if it has one, and the words: "🎮 Playing" is 🎮 and "Playing".
 * @param {string} label @returns {{ emoji?: string, text: string }}
 */
export function splitEmoji(label) {
  const match = label.match(/^(\p{Extended_Pictographic}(?:\u{FE0F}|\u{200D}\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*(.*)$/u);
  return match ? { emoji: match[1], text: match[2].trim() } : { text: label.trim() };
}
