// Now (src/content/now.md): what Jack is up to, one list item per line. The file is edited by hand, often on a
// phone, so nothing in it can stop the build: whatever can't be read as an item is shown as it is. The Changelog
// (changelog.js) is written the same way and shares the list reading here.
import { micromark } from 'micromark';
import { NEW_TAB, isExternal } from './links.js';

/**
 * A list file's lines: each list item ("- " or "* " at the start), in file order, and everything else that isn't
 * blank or an HTML comment, as the note.
 * @param {string} text @returns {{ items: { text: string, line: number }[], note: string }}
 */
export function readList(text) {
  const items = [];
  const note = [];
  // Comments may run over several lines; they're blanked out, keeping the line count for messages.
  const lines = String(text ?? '').replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, '')).split(/\r?\n/);
  lines.forEach((raw, i) => {
    const item = raw.match(/^\s*[-*]\s+(.*)$/);
    if (item) {
      if (item[1].trim()) items.push({ text: item[1].trim(), line: i + 1 });
    } else note.push(raw);
  });
  return { items, note: note.join('\n').trim() };
}

/**
 * Where the first colon is that isn't inside brackets or a link's address ("[a](https://b)"), or -1.
 * @param {string} text
 */
export function firstColon(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[' || c === '<') depth++;
    else if ((c === ')' || c === ']' || c === '>') && depth > 0) depth--;
    else if (c === ':' && depth === 0) return i;
  }
  return -1;
}

/**
 * A value and its detail: the words after the first " — " (or " - ", easier to type on a phone) that isn't inside a
 * link. "Media Studio — An app for my photos" is "Media Studio" and "An app for my photos".
 * @param {string} text @returns {{ value: string, detail?: string }}
 */
export function splitDetail(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[' || c === '<') depth++;
    else if ((c === ')' || c === ']' || c === '>') && depth > 0) depth--;
    else if (depth === 0 && (c === '—' || c === '-') && text[i - 1] === ' ' && text[i + 1] === ' ') {
      const value = text.slice(0, i).trim();
      const detail = text.slice(i + 1).trim();
      if (value && detail) return { value, detail };
    }
  }
  return { value: text };
}

/**
 * Now's items: the label before the first colon (an emoji is part of it) and the value after it, which may hold more
 * colons, then the value's detail, if it has one (splitDetail). A line without a colon is just a line.
 * @param {string} text the file @returns {{ items: { label?: string, value: string, detail?: string }[], note: string }}
 */
export function readNow(text) {
  const { items, note } = readList(text);
  return {
    items: items.map(({ text: line }) => {
      const at = firstColon(line);
      const label = at < 0 ? '' : line.slice(0, at).trim();
      const value = at < 0 ? line : line.slice(at + 1).trim();
      return label && value ? { label, ...splitDetail(value) } : splitDetail(line);
    }),
    note,
  };
}

/**
 * Which thing an item is, the same whatever its emoji, capitals or detail: "🛠️ Building: Media Studio — …" is
 * "building media studio".
 * @param {{ label?: string, value: string }} item
 */
export const itemKey = (item) => `${item.label ?? ''} ${plainText(item.value)}`.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Now's past, from the versions of now.md (newest first, each with when it was committed): since when each current
 * item has been on Now without a break, and the Nows before this one, newest first, each dated by when it was set.
 * A version that only changes details, emoji or order is the same Now.
 * @param {{ label?: string, value: string }[]} current the items shown now
 * @param {{ date: Date, text: string }[]} versions @param {number} most how many earlier Nows
 * @returns {{ since: (Date | undefined)[], earlier: { date: Date, items: ReturnType<typeof readNow>['items'] }[] }}
 */
export function nowHistory(current, versions, most = 5) {
  /** @type {{ id: string, keys: string[], date: Date, items: ReturnType<typeof readNow>['items'] }[]} */
  const runs = [];
  for (const version of versions) {
    const items = readNow(version.text).items;
    const keys = items.map(itemKey);
    const id = [...keys].sort().join('\n');
    const last = runs.at(-1);
    if (last?.id === id) last.date = version.date;
    else runs.push({ id, keys, date: version.date, items });
  }
  const keys = current.map(itemKey);
  // The newest run is usually this Now itself; while an edit isn't committed yet, every run is an earlier one.
  const first = runs[0]?.id === [...keys].sort().join('\n') ? 1 : 0;
  const since = keys.map((key) => {
    let date;
    for (const run of runs) {
      if (!run.keys.includes(key)) break;
      date = run.date;
    }
    return date;
  });
  const earlier = runs.slice(first).filter((run) => run.items.length).slice(0, most).map(({ date, items }) => ({ date, items }));
  return { since, earlier };
}

/**
 * Whether an item's value names this title: the title itself, or the title and "post" ("Yunnan Post" names the post
 * "Yunnan"), ignoring capitals and links.
 * @param {string} value @param {string} title
 */
export function namesTitle(value, title) {
  const said = plainText(value).toLowerCase().replace(/\s+/g, ' ');
  const name = title.trim().toLowerCase().replace(/\s+/g, ' ');
  return Boolean(name) && (said === name || said === `${name} post`);
}

/** Links to other sites open in a new tab, as they do in posts (rehypeExternalLinks in links.js). */
const markExternal = (html, site) =>
  html.replace(/<a href="([^"]*)"/g, (whole, href) => (isExternal(href.replace(/&amp;/g, '&'), site) ? `${whole} target="${NEW_TAB.target}" rel="${NEW_TAB.rel}" aria-describedby="${NEW_TAB['aria-describedby']}"` : whole));

/**
 * One line of Markdown as HTML without its paragraph: links, bold and the like. Typed HTML comes out as text.
 * @param {string} text @param {string} site
 */
export const inlineHtml = (text, site) => markExternal(micromark(text).trim().replace(/^<p>([\s\S]*)<\/p>$/, '$1'), site);

/** A note's Markdown as HTML, its paragraphs kept. @param {string} text @param {string} site */
export const blockHtml = (text, site) => markExternal(micromark(text), site);

/** The text a line of Markdown shows, without its links' addresses: "[Jack's Space](/)" is "Jack's Space". */
export const plainText = (text) => text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').trim();
