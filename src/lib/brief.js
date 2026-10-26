// Morning Brief: one file a day, src/content/brief/YYYY-MM-DD.json, written each morning by scripts/brief/ and read
// here while the site is built. The file comes from a model, so nothing in it can stop the build: an item that
// doesn't hold together is left out, and a file that doesn't is no day at all.

/** The four kinds an item can be, in the order the page lists them; each has its colours in tokens.css. */
export const KINDS = { ai: 'AI', open: '开源项目', dev: '开发', fun: '好玩' };

/** Where items come from, as the page names them. */
export const SOURCES = { hn: 'Hacker News', github: 'GitHub', lobsters: 'Lobsters' };

/** How many items are marked 今日重点. */
export const LEADS = 3;

/** The page's lead, under its title. */
export const BRIEF_LEAD = '每天早上 7 点，Claude 从科技圈挑出值得看的几件事，用华语写给我。';

/** A day's address: the newest day is /brief/ itself. @param {string} date @param {string | undefined} newest */
export const briefPath = (date, newest) => (date === newest ? '/brief/' : `/brief/${date}/`);

/** @param {unknown} v */
const text = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** Only plain web addresses; anything else (javascript:, a typo) is no link. @param {unknown} v */
function webAddress(v) {
  try {
    const url = new URL(text(v));
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

/**
 * @typedef {{ id: string, kind: keyof typeof KINDS, lead: boolean, title: string, line: string, desc: string,
 *   why: string, orig: string, source: keyof typeof SOURCES, signal: number, url: string, discuss: string }} BriefItem
 * @typedef {{ date: string, made: string, items: BriefItem[] }} Brief
 */

/**
 * One day's brief made tidy: its items in order, the leads first and at most LEADS of them, each with what the page
 * needs. Null when there's no day to show.
 * @param {unknown} data the parsed file @returns {Brief | null}
 */
export function readBrief(data) {
  const day = /** @type {any} */ (data);
  const date = text(day?.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(day?.items)) return null;
  const seen = new Set();
  const items = [];
  for (const raw of day.items) {
    const item = {
      id: text(raw?.id),
      kind: text(raw?.kind),
      lead: raw?.lead === true,
      title: text(raw?.title),
      line: text(raw?.line),
      desc: text(raw?.desc),
      why: text(raw?.why),
      orig: text(raw?.orig),
      source: text(raw?.source),
      signal: Number.isFinite(raw?.signal) ? Math.max(0, Math.round(raw.signal)) : 0,
      url: webAddress(raw?.url),
      discuss: webAddress(raw?.discuss),
    };
    if (!item.id || seen.has(item.id) || !(item.kind in KINDS) || !(item.source in SOURCES) || !item.title || !item.url) continue;
    seen.add(item.id);
    items.push(/** @type {BriefItem} */ (item));
  }
  if (!items.length) return null;
  // The leads come first; a model that marks too many or none still gives a page with LEADS of them.
  let leads = items.filter((i) => i.lead).slice(0, LEADS);
  if (!leads.length) leads = items.slice(0, Math.min(LEADS, items.length));
  const ordered = [...leads, ...items.filter((i) => !leads.includes(i))].map((i) => ({ ...i, lead: leads.includes(i) }));
  return { date, made: text(day?.made), items: ordered };
}

/**
 * How an item's source counts it, the way the page shows it: "125 分", "今日 +1,317 ★".
 * @param {Pick<BriefItem, 'source' | 'signal'>} item
 */
export function signalText(item) {
  if (!item.signal) return '';
  const n = item.signal.toLocaleString('en-US');
  return item.source === 'github' ? `今日 +${n} ★` : `${n} 分`;
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/** "10 月 26 日 星期一", for a day written as "2026-10-26". @param {string} date */
export function dayTitle(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${m} 月 ${d} 日 ${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
}

/**
 * The day before and after `date` among the days there are, for 昨天 / 明天. `days` is sorted, oldest first.
 * @param {string[]} days @param {string} date @returns {{ before?: string, after?: string }}
 */
export function neighbours(days, date) {
  const at = days.indexOf(date);
  if (at < 0) return {};
  return { before: days[at - 1], after: days[at + 1] };
}

/**
 * An item's lasting name, for scores: the same address gives the same id on any day. 32-bit FNV-1a, in hex.
 * @param {string} url
 */
export function itemId(url) {
  let hash = 0x811c9dc5;
  for (const ch of url) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
