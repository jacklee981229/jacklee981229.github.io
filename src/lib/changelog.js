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

/**
 * A trip Jack marked `away` in its travel post, shown in the Changelog over the days he was away (ChangelogAway.astro):
 * its first and last day, what the chip says, the open card's words, picture and flag, and the post's address.
 * @typedef {{ from: string, to: string, title: string, note: string, flag: string, href: string, photo: string }} Trip
 */

/** A day of changes, or a trip (no changes of its own), placed by its last day. @typedef {{ day: string, changes: Change[], trip?: Trip }} Entry */

/**
 * Newest-first changes grouped by year, then by day, with any trips among the days by their last day; a trip that
 * ends on a day with changes comes after that day's changes.
 * @param {Change[]} changes
 * @param {Trip[]} [trips]
 */
export function byYear(changes, trips = []) {
  /** @type {Entry[]} */
  const entries = [...byDay(changes), ...trips.map((trip) => ({ day: trip.to, changes: [], trip }))];
  // Array.prototype.sort keeps equal items in their order, so a day's changes stay ahead of a trip ending that day.
  entries.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  /** @type {{ year: string, days: Entry[] }[]} */
  const years = [];
  for (const day of entries) {
    const year = day.day.slice(0, 4);
    if (years.at(-1)?.year !== year) years.push({ year, days: [] });
    years.at(-1)?.days.push(day);
  }
  return years;
}

/**
 * A year's days as cards: one a day, except that days with a single change each, one after another, share a card,
 * so a quiet spell doesn't stand as a row of near-empty cards. A trip counts as a quiet day, as nothing changed while
 * Jack was away. A lone quiet day keeps a card of its own.
 * @param {Entry[]} days newest first
 * @returns {Entry[][]} each card's days, newest first
 */
export function cardsOf(days) {
  const quiet = (/** @type {Entry} */ d) => Boolean(d.trip) || d.changes.length === 1;
  /** @type {Entry[][]} */
  const cards = [];
  for (const day of days) {
    const last = cards.at(-1);
    if (quiet(day) && last?.every(quiet)) last.push(day);
    else cards.push([day]);
  }
  return cards;
}

/**
 * The Changelog's cards year by year, split at the fold: the newest `shown` cards show at once, the rest wait behind
 * Expand. A year the fold cuts goes on below it without its heading again (`continued`).
 * @param {{ year: string, days: Entry[] }[]} years newest first
 * @param {number} shown
 */
export function fold(years, shown) {
  /** @type {{ year: string, cards: Entry[][] }[]} */
  const open = [];
  /** @type {{ year: string, cards: Entry[][], continued: boolean }[]} */
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
 * What a shared card's days span, oldest to newest: "26–29 Sep 2026", or "30 Sep – 1 Oct 2026" across a month. A
 * trip's span starts on its first day.
 * @param {{ day: string, trip?: { from: string } }[]} days newest first, all in one year
 */
export function spanOf(days) {
  const last = days[days.length - 1];
  return `${daysSpan(last.trip?.from ?? last.day, days[0].day)} ${days[0].day.slice(0, 4)}`;
}

/** "14–20 Oct", or "30 Sep – 1 Oct" across a month. @param {string} from @param {string} to */
export function daysSpan(from, to) {
  return from.slice(0, 7) === to.slice(0, 7) ? `${Number(from.slice(8))}–${shortDay(to)}` : `${shortDay(from)} – ${shortDay(to)}`;
}

/** The day as a Date at the start of that day in Malaysia, where the site's dates are kept. @param {string} day */
export const dayToDate = (day) => new Date(`${day}T00:00:00+08:00`);

/**
 * How light a day's square is in the calendar: 0 for no changes, then a step each for 1, 2–4, 5–9, and 10 or more.
 * @param {number} count
 */
export const stepOf = (count) => (count === 0 ? 0 : count === 1 ? 1 : count < 5 ? 2 : count < 10 ? 3 : 4);

/** How many changes since `from`, that day included. @param {{ day: string }[]} changes @param {string} from YYYY-MM-DD */
export const changesSince = (changes, from) => changes.filter((change) => change.day >= from).length;

/**
 * The calendar of `today`'s month: its name, how many days of its first week come before the 1st (weeks start on
 * Monday), and its days, each with its count of changes, its step, and whether it's today or still to come.
 * @param {{ day: string }[]} changes
 * @param {string} today YYYY-MM-DD
 */
export function calendarMonth(changes, today) {
  const month = today.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = Array.from({ length }, (_, i) => {
    const day = `${month}-${String(i + 1).padStart(2, '0')}`;
    const count = changes.filter((change) => change.day === day).length;
    return { day, changes: count, step: stepOf(count), today: day === today, later: day > today };
  });
  return { name: `${MONTHS[m - 1]} ${y}`, blank: (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7, days };
}
