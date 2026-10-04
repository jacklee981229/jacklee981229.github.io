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
 * Now's items: the label before the first colon (an emoji is part of it) and the value after it, which may hold more
 * colons. A line without a colon is just a line.
 * @param {string} text the file @returns {{ items: { label?: string, value: string }[], note: string }}
 */
export function readNow(text) {
  const { items, note } = readList(text);
  return {
    items: items.map(({ text: line }) => {
      const at = firstColon(line);
      const label = at < 0 ? '' : line.slice(0, at).trim();
      const value = at < 0 ? line : line.slice(at + 1).trim();
      return label && value ? { label, value } : { value: line };
    }),
    note,
  };
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
