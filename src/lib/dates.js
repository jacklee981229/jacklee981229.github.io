// Dates always show in Malaysia time, whatever time zone the site is built in (GitHub builds in UTC).
const TIME_ZONE = 'Asia/Kuala_Lumpur';
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const partsFormat = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric' });

/** @param {Date} date @returns {{ y: number, m: number, d: number }} */
function localParts(date) {
  const parts = Object.fromEntries(partsFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
}

/** "2023-10-16" @param {Date} date */
export function isoDay(date) {
  const { y, m, d } = localParts(date);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "16 Oct 2023" @param {Date} date */
export function formatDate(date) {
  const { y, m, d } = localParts(date);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Oct" @param {Date} date */
export const monthName = (date) => MONTHS[localParts(date).m - 1];

/** "2023" @param {Date} date */
export const yearOf = (date) => String(localParts(date).y);

/** "2023-10" @param {Date} date */
export const monthKey = (date) => isoDay(date).slice(0, 7);

/** Whole calendar days from `older` to `newer`, counted in Malaysia time. @param {Date} newer @param {Date} older */
export function daysBetween(newer, older) {
  const day = (/** @type {Date} */ date) => { const { y, m, d } = localParts(date); return Date.UTC(y, m - 1, d) / 86400000; };
  return day(newer) - day(older);
}

/** "2026-09-26T14:05:00+08:00", for new posts' front matter. Malaysia has no daylight saving, so the offset is fixed. @param {Date} date */
export function localTimestamp(date) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  return `${isoDay(date)}T${f.format(date)}+08:00`;
}

/**
 * How long ago, in Malaysia calendar days, said the way a person would: "today", "yesterday", "3 days ago",
 * "2 weeks ago", "5 months ago", "1 year ago". A date still to come counts as today.
 * @param {Date} then @param {Date} now
 */
export function timeAgo(then, now) {
  const days = daysBetween(now, then);
  const say = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return say(days, 'day');
  if (days < 30) return say(Math.floor(days / 7), 'week');
  if (days < 365) return say(Math.max(1, Math.floor(days / 30)), 'month');
  return say(Math.floor(days / 365), 'year');
}
