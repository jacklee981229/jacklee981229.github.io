// Convert Timestamp: Unix time to a readable date and back, in the visitor's time zone or UTC. Kept apart from the
// page so the tests can check it.
import { MONTHS } from '../dates.js';

// Numbers this big are read as milliseconds: in seconds they'd be past the year 5000.
const MILLISECONDS_FROM = 1e11;
// Dates show for the years 1 to 9999, the same as the date picker.
const EARLIEST = Date.parse('0001-01-01T00:00:00Z');
const LATEST = Date.parse('9999-12-31T23:59:59.999Z');

/**
 * A Unix time as typed, in seconds or milliseconds (told apart by size). Null while the field is empty.
 * @param {string} input
 * @returns {{ ms: number, unit: 'seconds' | 'milliseconds' } | { error: string } | null}
 */
export function readUnixTime(input) {
  const typed = input.trim();
  if (!typed) return null;
  if (!/^-?\d+(\.\d+)?$/.test(typed)) return { error: 'Type a Unix time in digits, like 1727600000.' };
  const n = Number(typed);
  const unit = Math.abs(n) >= MILLISECONDS_FROM ? 'milliseconds' : 'seconds';
  const ms = Math.round(unit === 'seconds' ? n * 1000 : n);
  if (ms < EARLIEST || ms > LATEST) return { error: 'That’s too far from today to show as a date.' };
  return { ms, unit };
}

/**
 * "29 Sep 2024, 16:53:20" in a time zone, with milliseconds when there are any.
 * @param {number} ms
 * @param {string} [timeZone] the visitor's own when left out
 */
export function formatInstant(ms, timeZone) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(ms).map((x) => [x.type, x.value]));
  const rest = ((ms % 1000) + 1000) % 1000;
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}, ${p.hour}:${p.minute}:${p.second}${rest ? `.${String(rest).padStart(3, '0')}` : ''}`;
}

/**
 * "GMT+8": how far a time zone is from UTC at that moment (it can change with daylight saving).
 * @param {number} ms
 * @param {string} [timeZone] the visitor's own when left out
 */
export function offsetName(ms, timeZone) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' });
  return f.formatToParts(ms).find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/**
 * A date picker's value ("2024-09-29T16:53", maybe with seconds) as Unix time. Null until the date is complete.
 * @param {string} value
 * @param {'local' | 'utc'} zone local reads it in the visitor's time zone
 * @returns {{ seconds: number, milliseconds: number } | null}
 */
export function dateToUnix(value, zone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(value)) return null;
  // A date without a time zone reads as local time; a "Z" at the end makes it UTC.
  const ms = Date.parse(zone === 'utc' ? `${value}Z` : value);
  if (Number.isNaN(ms)) return null;
  return { seconds: Math.floor(ms / 1000), milliseconds: ms };
}
