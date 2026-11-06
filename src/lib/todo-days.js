// The day Jack plans to do a to-do on ("on", YYYY-MM-DD, "" for none), set in his laptop's to-do widget
// (C:\repos\Jack\todo-widget). The Worker checks it (workers/now/todos.js); the palette's /todo and /brief/ put the
// to-dos whose day has come first. The site orders them itself rather than trusting the laptop's order, so a day that
// comes while the laptop is off still rises to the top. Days are Malaysia's, whatever the browser's time zone.

/** Malaysia's day, YYYY-MM-DD. @param {Date} [now] */
export function malaysiaToday(now = new Date()) {
  // en-CA writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(now);
}

/**
 * A real day written YYYY-MM-DD. Strict, as the laptop's todos.day() is: Date alone rolls 2026-02-31 into March.
 * @param {unknown} text
 */
export function isDay(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [y, m, d] = text.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Days from today to `on`, negative when it has passed. @param {string} on @param {string} today */
const daysFrom = (on, today) => Math.round((Date.parse(on) - Date.parse(today)) / 86400000);

/** Its day has come: today or passed. YYYY-MM-DD compares as text the way dates do. @param {{ on?: string }} item @param {string} today */
export const isDue = (item, today) => !!item.on && item.on <= today;

/**
 * The to-dos whose day has come, the earliest day first; ties keep the order given (the order added).
 * @template {{ on?: string }} T @param {T[]} items @param {string} today @returns {T[]}
 */
export function dueFirst(items, today) {
  return items.filter((i) => isDue(i, today)).sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
}

export const TODAY = 'Today';

/**
 * /todo's groups: Today first (the to-dos whose day has come, from every project), then each project in the order
 * given, without the ones already in Today. Empty groups are left out.
 * @template {{ project: string, on?: string }} T @param {string[]} projects @param {T[]} items @param {string} today
 * @returns {{ name: string, items: T[], today: boolean }[]}
 */
export function todoGroups(projects, items, today) {
  const due = dueFirst(items, today);
  const groups = projects.map((name) => ({ name, items: items.filter((i) => i.project === name && !isDue(i, today)), today: false }));
  return [...(due.length ? [{ name: TODAY, items: due, today: true }] : []), ...groups].filter((g) => g.items.length);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A day as /todo shows it, in the widget's words: Today, Yesterday, 3 days ago, Tomorrow, or Mon 9 Nov; and whether it
 * is late, today or still to come.
 * @param {string} on @param {string} today @returns {{ text: string, kind: 'late' | 'today' | 'later' }}
 */
export function dayWords(on, today) {
  const days = daysFrom(on, today);
  const kind = days < 0 ? 'late' : days === 0 ? 'today' : 'later';
  if (days === 0) return { text: 'Today', kind };
  if (days === -1) return { text: 'Yesterday', kind };
  if (days < 0) return { text: `${-days} days ago`, kind };
  if (days === 1) return { text: 'Tomorrow', kind };
  const date = new Date(Date.parse(on));
  return { text: `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`, kind };
}

/**
 * A passed day as /brief/ shows it: 昨天, 3 天前. Today needs no words there (the box is 今天要做的), nor does a day
 * still to come, which /brief/ never lists.
 * @param {string} on @param {string} today
 */
export function lateWords(on, today) {
  const days = daysFrom(on, today);
  return days >= 0 ? '' : days === -1 ? '昨天' : `${-days} 天前`;
}
