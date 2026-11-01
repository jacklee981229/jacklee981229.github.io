// Jack's drafts: posts he writes on the site (/writing/draft/) and keeps in his Now editor Worker (workers/now) until
// he publishes them. These rules are shared by the editor page and the Worker: what a draft needs before it can go
// out, the names its pictures get, and the index.md that Publish commits.
import { localTimestamp } from './dates.js';
import { TOPIC_IDS } from './topics.js';

/** A tag as the posts' schema takes it (content.config.ts): lowercase words, like "flutter" or "dev tools". */
export const TAG_PATTERN = /^[a-z0-9]+(?:[ -][a-z0-9]+)*$/;

/**
 * The most a draft may hold: its title, its text, and each picture in bytes. A D1 row holds at most 2 MB, and a
 * picture is kept as base64, a third bigger.
 */
export const LIMITS = { title: 200, body: 100_000, image: 1_400_000, images: 30 };

/** The kinds of picture a draft takes, by the name's ending. */
export const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

/** The tags box's words ("ai, claude code") as the post's tags. @param {string} text */
export const readTags = (text) => [...new Set(String(text).split(',').map((t) => t.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))];

/** Every picture of the draft's own that its text shows: `![…](./name.png)`, with or without a title. @param {string} body */
export const pictureNames = (body) => [...String(body).matchAll(/!\[[^\]]*\]\(\.\/([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);

/**
 * The name a picture is kept under, from the file's own name: lowercase letters, numbers, - and _, its ending kept,
 * and a number added when the draft already has that name. Nothing when it isn't a picture the draft takes.
 * @param {string} file @param {string[]} taken
 */
export function pictureName(file, taken) {
  const match = String(file).toLowerCase().match(/^(.*)\.([a-z0-9]+)$/);
  if (!match || !(match[2] in IMAGE_TYPES)) return null;
  const stem = match[1].replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'picture';
  let name = `${stem}.${match[2]}`;
  for (let n = 2; taken.includes(name); n++) name = `${stem}-${n}.${match[2]}`;
  return name;
}

/**
 * What stops a draft from going out, each in words for Jack; none when it's ready.
 * @param {{ title: string, topic: string, tags: string, body: string }} draft @param {string[]} pictures its pictures' names
 */
export function problems(draft, pictures) {
  const found = [];
  if (!draft.title.trim()) found.push('Give it a title.');
  if (!TOPIC_IDS.includes(draft.topic)) found.push('Pick a topic.');
  const bad = readTags(draft.tags).filter((t) => !TAG_PATTERN.test(t));
  if (bad.length) found.push(`Tags are lowercase words and numbers: ${bad.join(', ')}.`);
  if (!draft.body.trim()) found.push('Write something first.');
  const missing = pictureNames(draft.body).filter((name) => !pictures.includes(name));
  if (missing.length) found.push(`The text shows pictures the draft doesn't have: ${missing.join(', ')}.`);
  return found;
}

/**
 * The address Publish gives a post: the first number no folder has yet (posts 1 to 11 make 12). Not the highest plus
 * one, because some named posts are numbers too (the game 2048).
 * @param {string[]} folders the names in src/content/posts
 */
export function nextAddress(folders) {
  let n = 1;
  while (folders.includes(String(n))) n++;
  return String(n);
}

/**
 * The post's index.md, as `npm run new` starts one (scripts/new-post.mjs), published. The first picture in the text
 * is its cover, as for any post.
 * @param {{ title: string, topic: string, tags: string, body: string }} draft @param {Date} date
 */
export const postFile = (draft, date) => [
  '---',
  `title: ${JSON.stringify(draft.title.trim())}`,
  `date: ${localTimestamp(date)}`,
  `topic: ${draft.topic}`,
  `tags: ${JSON.stringify(readTags(draft.tags))}`,
  '---',
  '',
  draft.body.replace(/\r\n?/g, '\n').trim(),
  '',
].join('\n');
