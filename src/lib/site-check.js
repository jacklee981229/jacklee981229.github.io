// Site Check (/lab/site-check/): the crawl itself, run in the visitor's browser. From the home page it reads
// this site's pages one after another, in the order it finds them, and checks every link on each: this site's own
// addresses are fetched (pages once each, then read for their links in turn; other files with a HEAD only), links to
// other sites are never fetched, only counted, for Jack to check by hand. src/site-check/web.js draws it.
import { isExternal } from './links.js';

/** Most pages one check reads. shortcut: a plain cap; raise it if the site ever outgrows it. */
export const MAX_PAGES = 400;
/** Links on a page checked at the same time. */
const AT_ONCE = 4;

/**
 * What a link on a page is: `page` (this site's, read for its links later), `file` (this site's, but not a page, so only
 * checked), `outside` (another site's: never fetched) or `skip` (#anchors, mailto: and the like). `key` is what it's
 * known by: for this site's, the path alone (a ?query or #part doesn't make another page), for outside ones the address.
 * @param {string} href as written on the page
 * @param {string} from the path of the page it's on
 * @param {string} origin this site's, e.g. https://jacklee981229.github.io
 * @returns {{ kind: 'page' | 'file' | 'outside' | 'skip', key: string }}
 */
export function classifyLink(href, from, origin) {
  const raw = href.trim();
  if (!raw || raw.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:/i.test(raw)) return { kind: 'skip', key: '' };
  let url;
  try {
    url = new URL(raw, new URL(from, origin));
  } catch {
    return { kind: 'skip', key: '' };
  }
  if (isExternal(url.href, origin) || url.origin !== new URL(origin).origin) {
    url.hash = '';
    return { kind: 'outside', key: url.href };
  }
  const path = url.pathname;
  return { kind: /\.[a-z0-9]+$/i.test(path) && !/\.html?$/i.test(path) ? 'file' : 'page', key: path };
}

// The pages that aren't any menu part's go with the home page; any other address of one part is a post's.
// shortcut: a new top-level page outside the menu lands in Writing until it's listed here.
const FRAME = ['/now/', '/changelog/', '/guestbook/'];
const PREFIXES = [['/writing/', 'writing'], ['/tags/', 'writing'], ['/lab/', 'lab'], ['/collections/', 'collection'], ['/travel/', 'travel'], ['/about/', 'about']];
/**
 * The menu part a page of this site belongs to (one of build-log.js's PARTS), by its path: what colours it on the web.
 * @param {string} path @returns {string}
 */
export function partOfPage(path) {
  if (path === '/' || FRAME.includes(path)) return 'home';
  return PREFIXES.find(([prefix]) => path.startsWith(prefix))?.[1] ?? 'writing';
}

/**
 * @typedef {{ status: number, ms: number, html: string | null }} Answer
 *   `status` 0 when nothing came back at all. `html` only for a page that answered with one.
 * @typedef {{ href: string, text: string, kind: 'page' | 'file' | 'outside', key: string, route: 'fine' | 'broken' | 'you', repeat: boolean, status: number, ms: number }} Link
 *   `repeat` when an earlier link (on this page or another) already checked the same address.
 * @typedef {{ path: string, status: number, ms: number, title: string, links: Link[] }} Page
 */

/**
 * Crawls the site from the home page and hands over each page once its links are checked, in order. Stops early when
 * `signal` is aborted. Every request goes through `ask`, only ever for this site's paths.
 * @param {{
 *   origin: string,
 *   ask: (path: string, method: 'GET' | 'HEAD') => Promise<Answer>,
 *   read: (html: string) => { title: string, links: { href: string, text: string }[] },
 *   onPage: (page: Page) => void,
 *   signal?: AbortSignal,
 *   max?: number,
 * }} options
 * @returns {Promise<{ pages: number, links: number }>}
 */
export async function crawl({ origin, ask, read, onPage, signal, max = MAX_PAGES }) {
  /** Each of this site's addresses checked so far, with its answer (a page's kept until it's read). */
  const answers = new Map();
  const seen = new Set();
  const queue = ['/'];
  answers.set('/', ask('/', 'GET'));
  seen.add('/');
  let pages = 0;
  let links = 0;
  while (queue.length && pages < max && !signal?.aborted) {
    const path = /** @type {string} */ (queue.shift());
    const answer = await answers.get(path);
    if (signal?.aborted) break;
    const found = answer.html ? read(answer.html) : { title: path, links: [] };
    /** @type {(Link | null)[]} */
    const checked = [];
    const todo = found.links.map((link, i) => ({ link, i, kind: classifyLink(link.href, path, origin) })).filter((x) => x.kind.kind !== 'skip');
    // In page order, a few at a time: each address is asked once, the first link to it waits for the answer.
    for (let k = 0; k < todo.length; k += AT_ONCE) {
      const batch = todo.slice(k, k + AT_ONCE).map(async ({ link, kind }) => {
        const repeat = seen.has(kind.key);
        seen.add(kind.key);
        if (kind.kind === 'outside') return { ...link, kind: kind.kind, key: kind.key, route: /** @type {const} */ ('you'), repeat, status: 0, ms: 0 };
        if (!answers.has(kind.key)) answers.set(kind.key, ask(kind.key, kind.kind === 'page' ? 'GET' : 'HEAD'));
        const got = await answers.get(kind.key);
        const fine = got.status >= 200 && got.status < 400;
        if (fine && kind.kind === 'page' && !repeat && got.html !== null) queue.push(kind.key);
        return { ...link, kind: kind.kind, key: kind.key, route: fine ? /** @type {const} */ ('fine') : /** @type {const} */ ('broken'), repeat, status: got.status, ms: got.ms };
      });
      checked.push(...(await Promise.all(batch)));
      if (signal?.aborted) break;
    }
    if (signal?.aborted) break;
    // A page read is done with: only its answer's status is kept.
    answers.set(path, Promise.resolve({ status: answer.status, ms: answer.ms, html: null }));
    const done = /** @type {Link[]} */ (checked.filter(Boolean));
    pages++;
    links += done.length;
    onPage({ path, status: answer.status, ms: answer.ms, title: found.title, links: done });
  }
  return { pages, links };
}
