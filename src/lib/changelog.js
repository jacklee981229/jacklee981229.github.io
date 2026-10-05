// The Changelog (src/content/changelog.md): what changed on the site, one list item per change, "- YYYY-MM-DD: text".
// Read like Now (readList in now.js), but a bad date stops the build: this file is written with care, and a change
// without a date can't be put in its place.
import { firstColon, readList } from './now.js';

/** A real day written YYYY-MM-DD: "2026-02-30" is not one. @param {string} text */
export function isDay(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [y, m, d] = text.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** The kinds of change: the word written in the file, and the name and icon its label shows. */
export const KINDS = {
  new: { name: 'New', icon: 'plus-circle' },
  improved: { name: 'Improved', icon: 'bolt' },
  design: { name: 'Design', icon: 'palette' },
  fix: { name: 'Fix', icon: 'wrench' },
};

/** @typedef {{ day: string, kind: keyof typeof KINDS, text: string }} Change */

/**
 * The changes, newest first. New lines go at the bottom of the file, so on the same day a later line is a newer change
 * and comes first. Each line is "- YYYY-MM-DD kind: text", the kind one of KINDS.
 * @param {string} text the file
 * @returns {Change[]}
 */
export function readChangelog(text) {
  const changes = readList(text).items.map(({ text: line, line: number }) => {
    const at = firstColon(line);
    const [day = '', kind = '', ...extra] = at < 0 ? [] : line.slice(0, at).trim().split(/\s+/);
    const what = at < 0 ? '' : line.slice(at + 1).trim();
    if (!isDay(day) || !Object.hasOwn(KINDS, kind) || extra.length || !what) {
      throw new Error(`Changelog: line ${number} of src/content/changelog.md ("- ${line}") needs a date, a kind and the change, like "- 2026-09-26 new: Rebuilt Jack's Space from scratch with Astro". The date is year-month-day, and a real day; the kind is ${Object.keys(KINDS).join(', ')}.`);
    }
    return { day, kind: /** @type {keyof typeof KINDS} */ (kind), text: what };
  });
  // Turned round, the file reads newest line first; Array.prototype.sort keeps equal items in their order, so a day's
  // later lines stay ahead of its earlier ones.
  return changes.reverse().sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

/** Newest-first changes grouped by day, a card each. @param {Change[]} changes */
export function byDay(changes) {
  /** @type {{ day: string, changes: Change[] }[]} */
  const days = [];
  for (const change of changes) {
    if (days.at(-1)?.day !== change.day) days.push({ day: change.day, changes: [] });
    days.at(-1)?.changes.push(change);
  }
  return days;
}

/** Newest-first changes grouped by year, then by day. @param {Change[]} changes */
export function byYear(changes) {
  /** @type {{ year: string, days: { day: string, changes: Change[] }[] }[]} */
  const years = [];
  for (const day of byDay(changes)) {
    const year = day.day.slice(0, 4);
    if (years.at(-1)?.year !== year) years.push({ year, days: [] });
    years.at(-1)?.days.push(day);
  }
  return years;
}

/** The day as a Date at the start of that day in Malaysia, where the site's dates are kept. @param {string} day */
export const dayToDate = (day) => new Date(`${day}T00:00:00+08:00`);
