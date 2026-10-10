// Jack's Exact Time (src/pages/lab/exact-time.astro): checking this device's clock against the site's server, and
// what the page shows for a moment in a time zone. The same check sets the beat of Jack's Firefly River.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The cities under the clock, as on time.is: their names and time zones. */
export const CITIES = [
  ['Los Angeles', 'America/Los_Angeles'],
  ['New York', 'America/New_York'],
  ['London', 'Europe/London'],
  ['Paris', 'Europe/Paris'],
  ['Beijing', 'Asia/Shanghai'],
  ['Tokyo', 'Asia/Tokyo'],
];

/**
 * When the site's server got a request and how long it kept it, from the `X-Timer` header that GitHub Pages' CDN
 * (Fastly) adds to every answer: "S1791374542.156116,VS0,VE270" is { at: 1791374542156.116, kept: 270 }, both in
 * milliseconds. Fastly writes the whole seconds rounded rather than cut off, so from half a second on they're one
 * ahead of the fraction beside them (seen on 7 Oct 2026: "S…278.639171" in an answer dated :17): those lose the extra
 * second. Null when the header is missing (a local preview) or isn't in that shape.
 * @param {string | null | undefined} header
 */
export function readTimer(header) {
  const m = /^S(\d+)(?:\.(\d+))?,.*\bVE(\d+)$/.exec(header?.trim() ?? '');
  if (!m) return null;
  const fraction = Number(`0.${m[2] ?? 0}`);
  return { at: (Number(m[1]) - (fraction >= 0.5 ? 1 : 0) + fraction) * 1000, kept: Number(m[3]) };
}

/**
 * How far the server's clock is ahead of this device's, in milliseconds (negative when the device is ahead), from one
 * request sent and answered at `sent` and `answered` on the device's clock, which reached the server at `at` and was
 * kept `kept` ms. The trip is taken as the same both ways, so the answer is right to within half the time on the road
 * (`within`): the request with the shortest road is the surest.
 * @param {{ sent: number, answered: number, at: number, kept: number }} request
 */
export function offsetOf({ sent, answered, at, kept }) {
  return { offset: at + kept / 2 - (sent + answered) / 2, within: Math.max(0, answered - sent - kept) / 2 };
}

/**
 * Checks this device's clock against the site's server: a few quick asks of a page's headers, keeping the surest.
 * GitHub Pages' CDN stamps each answer with when the ask reached it (X-Timer); a local preview doesn't, and then the
 * answer is null and the device's time stays. Used by Jack's Exact Time and Jack's Firefly River. `ask`, `wall` and
 * `tick` are the browser's fetch, Date.now and performance.now, there for the tests.
 * @param {string} url
 * @param {{ ask?: (url: string, init: RequestInit) => Promise<{ headers: { get: (name: string) => string | null } }>, wall?: () => number, tick?: () => number }} [using]
 * @returns {Promise<{ offset: number, within: number } | null>}
 */
export async function checkClock(url, { ask = fetch, wall = Date.now, tick = () => performance.now() } = {}) {
  /** @type {{ offset: number, within: number } | null} */
  let best = null;
  for (let i = 0; i < 4; i++) {
    const sent = wall();
    const start = tick();
    const answer = await ask(url, { method: 'HEAD', cache: 'no-store' });
    const timer = readTimer(answer.headers.get('x-timer'));
    if (!timer) return null;
    const found = offsetOf({ sent, answered: sent + (tick() - start), ...timer });
    if (!best || found.within < best.within) best = found;
  }
  return best;
}

/** "0.09 s", "12.3 s", "2 min 5 s", "3 h 2 min", "2 days 3 h": how long a gap is, as briefly as it reads well. @param {number} ms */
export function gapOf(ms) {
  const s = Math.abs(ms) / 1000;
  // Just under 10 s or a minute would round up to "10.00 s" or "60.0 s".
  if (s < 9.995) return `${s.toFixed(2)} s`;
  if (s < 59.95) return `${s.toFixed(1)} s`;
  const whole = Math.round(s);
  if (whole < 3600) return `${Math.floor(whole / 60)} min ${whole % 60} s`;
  if (whole < 86400) return `${Math.floor(whole / 3600)} h ${Math.floor((whole % 3600) / 60)} min`;
  const days = Math.floor(whole / 86400);
  return `${days} ${days === 1 ? 'day' : 'days'} ${Math.floor((whole % 86400) / 3600)} h`;
}

/**
 * What the check says about this device's clock, from how far the server's is ahead of it: exact within half a
 * second, close within 5 s, else off; the words for each, and the detail with how sure the check is.
 * @param {number} offset ms, the server's clock minus the device's
 * @param {number} within ms
 * @returns {{ level: 'exact' | 'close' | 'off', title: string, detail: string }}
 */
export function verdictOf(offset, within) {
  const off = Math.abs(offset);
  const way = offset > 0 ? 'behind' : 'ahead of';
  // Never "±0.00 s": on a quick connection the margin rounds to nothing, which would claim a perfect check.
  const sure = `(±${gapOf(Math.max(within, 10))})`;
  if (off < 500) return { level: 'exact', title: 'Your clock is exact.', detail: `It's ${gapOf(off)} ${way} this site's server ${sure}.` };
  return { level: off < 5000 ? 'close' : 'off', title: `Your clock is ${gapOf(off)} ${offset > 0 ? 'behind' : 'ahead'}.`, detail: `Checked against this site's server ${sure}.` };
}

/**
 * The ISO week of a day: weeks start on Monday, and week 1 is the one with the year's first Thursday.
 * @param {number} y @param {number} m 1 to 12 @param {number} d
 */
export function isoWeek(y, m, d) {
  const day = new Date(Date.UTC(y, m - 1, d));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  return Math.ceil(((day.getTime() - Date.UTC(day.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

/**
 * The clock's face and the date at a moment in a time zone: "20", "05", "41" (or "8", "05", "41" and "PM" on the
 * 12-hour clock), "Wednesday, 7 October 2026", its week, and the day as YYYY-MM-DD.
 * @param {number} ms
 * @param {string} [timeZone] the visitor's own when left out
 * @param {boolean} [twelve] the 12-hour clock
 */
export function faceOf(ms, timeZone, twelve = false) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: twelve ? 'h12' : 'h23' });
  const p = Object.fromEntries(f.formatToParts(ms).map((x) => [x.type, x.value]));
  const [y, m, d] = [Number(p.year), Number(p.month), Number(p.day)];
  return {
    hours: twelve ? String(Number(p.hour)) : p.hour,
    minutes: p.minute,
    seconds: p.second,
    half: twelve ? p.dayPeriod : '',
    date: `${p.weekday}, ${d} ${MONTHS[m - 1]} ${y}`,
    week: isoWeek(y, m, d),
    day: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  };
}

/** "Yesterday", "Today" or "Tomorrow": a city's day next to the visitor's, both YYYY-MM-DD. @param {string} day @param {string} home */
export const dayWord = (day, home) => (day < home ? 'Yesterday' : day > home ? 'Tomorrow' : 'Today');

/** "Kuala Lumpur" for "Asia/Kuala_Lumpur": the place a time zone is named after. @param {string} timeZone */
export const placeOf = (timeZone) => timeZone.split('/').pop()?.replace(/_/g, ' ') ?? timeZone;
