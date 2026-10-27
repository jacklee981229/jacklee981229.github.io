// The Morning Brief's sources, read into one shape: a candidate the model can pick. Each reader takes what its
// source sent (JSON, or GitHub Trending's HTML, since Trending has no API) and keeps only what the brief uses.
import { itemId } from '../../src/lib/brief.js';

/**
 * @typedef {{ id: string, source: 'hn' | 'github' | 'lobsters', title: string, url: string, discuss: string,
 *   signal: number, about: string, posted?: number, excerpt?: string }} Candidate
 * (`posted`: when the story went up, in ms; GitHub Trending has none.)
 */

/** @param {unknown} v */
const text = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** The entities GitHub's HTML uses in descriptions. @param {string} s */
const unescape = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ');

/**
 * Hacker News stories from the API's items. A story without its own link ("Ask HN") links to its discussion.
 * @param {any[]} items @returns {Candidate[]}
 */
export function readHn(items) {
  return items
    .filter((it) => it && it.type === 'story' && !it.dead && !it.deleted && text(it.title))
    .map((it) => {
      const discuss = `https://news.ycombinator.com/item?id=${it.id}`;
      const url = text(it.url) || discuss;
      return { id: itemId(url), source: 'hn', title: text(it.title), url, discuss, signal: Number(it.score) || 0, about: '', posted: Number(it.time) * 1000 || undefined };
    });
}

/**
 * GitHub Trending's repositories from its page: name, description, stars today.
 * @param {string} html @returns {Candidate[]}
 */
export function readTrending(html) {
  return html
    .split('<article class="Box-row"')
    .slice(1)
    .map((row) => {
      const repo = (row.match(/<h2[^>]*>\s*<a[^>]*href="\/([^"/]+\/[^"/]+)"/) ?? [])[1];
      if (!repo) return null;
      const about = text(unescape((row.match(/<p class="col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/) ?? [])[1] ?? ''));
      const today = Number(((row.match(/([\d,]+)\s+stars today/) ?? [])[1] ?? '0').replace(/,/g, ''));
      const url = `https://github.com/${repo}`;
      return { id: itemId(url), source: 'github', title: repo, url, discuss: '', signal: today, about };
    })
    .filter(Boolean);
}

/**
 * Lobsters' hottest stories from its JSON; its tags say what a story is about.
 * @param {any[]} stories @returns {Candidate[]}
 */
export function readLobsters(stories) {
  return stories
    .filter((s) => s && text(s.title))
    .map((s) => {
      const discuss = text(s.comments_url) || text(s.short_id_url);
      const url = text(s.url) || discuss;
      return { id: itemId(url), source: 'lobsters', title: text(s.title), url, discuss, signal: Number(s.score) || 0, about: Array.isArray(s.tags) ? s.tags.join(', ') : '', posted: Date.parse(s.created_at) || undefined };
    });
}

/**
 * Only the news since the last brief, so each day tells what happened since the day before: a story that went up
 * earlier is left out, however hot it still is. GitHub Trending's daily list has no date and needs none: its stars
 * are the last day's already.
 * @param {Candidate[]} candidates @param {number} from ms
 */
export const postedSince = (candidates, from) => candidates.filter((c) => !c.posted || c.posted >= from);

/** How much of a page the model reads about each candidate, in characters: enough to say what it is, cheap to send. */
export const EXCERPT = 1500;

/**
 * What a page says about itself, as plain text: its description, then its first paragraphs, up to EXCERPT
 * characters. A README is Markdown with bits of HTML in it: its markup is mostly dropped instead.
 * @param {string} body the page's HTML or a README's Markdown @param {boolean} markdown
 */
export function excerptOf(body, markdown = false) {
  const meta = (name) => text(unescape((body.match(new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]*)"`, 'i')) ?? [])[1] ?? ''));
  const description = meta('og:description') || meta('description');
  let rest = '';
  if (!markdown) {
    const clean = body.replace(/<(script|style|nav|header|footer|svg|noscript)[\s\S]*?<\/\1>/gi, ' ');
    rest = [...clean.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => text(unescape(m[1]))).filter((p) => p.length > 40).join(' ');
  } else {
    rest = text(body.replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[#>*_`|-]+/g, ' '));
  }
  return text(`${description} ${rest}`).slice(0, EXCERPT);
}

/**
 * All candidates, each address once (the first source to have it keeps it), and none already in the last few days'
 * briefs, so a story that stays on the front page isn't told twice.
 * @param {Candidate[][]} lists @param {Set<string>} shownBefore ids @returns {Candidate[]}
 */
export function mergeCandidates(lists, shownBefore = new Set()) {
  const seen = new Set(shownBefore);
  const out = [];
  for (const list of lists) {
    for (const c of list) {
      if (!c.url || seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}
