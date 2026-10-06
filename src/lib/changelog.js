// The Changelog (src/content/changelog.md): what changed on the site, one list item per change, "- YYYY-MM-DD: text".
// Read like Now (readList in now.js), but a bad date stops the build: this file is written with care, and a change
// without a date can't be put in its place.
import { MONTHS } from './dates.js';
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

/**
 * A year's days as cards: one a day, except that days with a single change each, one after another, share a card,
 * so a quiet spell doesn't stand as a row of near-empty cards. A lone quiet day keeps a card of its own.
 * @param {{ day: string, changes: Change[] }[]} days newest first
 * @returns {{ day: string, changes: Change[] }[][]} each card's days, newest first
 */
export function cardsOf(days) {
  /** @type {{ day: string, changes: Change[] }[][]} */
  const cards = [];
  for (const day of days) {
    const last = cards.at(-1);
    if (day.changes.length === 1 && last?.every((d) => d.changes.length === 1)) last.push(day);
    else cards.push([day]);
  }
  return cards;
}

/**
 * The Changelog's cards year by year, split at the fold: the newest `shown` cards show at once, the rest wait behind
 * Expand. A year the fold cuts goes on below it without its heading again (`continued`).
 * @param {{ year: string, days: { day: string, changes: Change[] }[] }[]} years newest first
 * @param {number} shown
 */
export function fold(years, shown) {
  /** @type {{ year: string, cards: { day: string, changes: Change[] }[][] }[]} */
  const open = [];
  /** @type {{ year: string, cards: { day: string, changes: Change[] }[][], continued: boolean }[]} */
  const folded = [];
  let left = shown;
  for (const { year, days } of years) {
    const cards = cardsOf(days);
    const now = cards.slice(0, Math.max(0, left));
    left -= now.length;
    if (now.length) open.push({ year, cards: now });
    if (cards.length > now.length) folded.push({ year, cards: cards.slice(now.length), continued: now.length > 0 });
  }
  return { open, folded };
}

/** "29 Sep" for "2026-09-29". @param {string} day */
export const shortDay = (day) => `${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

/**
 * What a shared card's days span, oldest to newest: "26–29 Sep 2026", or "30 Sep – 1 Oct 2026" across a month.
 * @param {{ day: string }[]} days newest first, all in one year
 */
export function spanOf(days) {
  const [newest, oldest] = [days[0].day, days.at(-1).day];
  const year = newest.slice(0, 4);
  if (newest.slice(0, 7) === oldest.slice(0, 7)) return `${Number(oldest.slice(8))}–${shortDay(newest)} ${year}`;
  return `${shortDay(oldest)} – ${shortDay(newest)} ${year}`;
}

/** The day as a Date at the start of that day in Malaysia, where the site's dates are kept. @param {string} day */
export const dayToDate = (day) => new Date(`${day}T00:00:00+08:00`);
