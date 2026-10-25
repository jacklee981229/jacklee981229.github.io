// The Now editor's rules, apart from the Worker (index.js) so they can be tested: the login pass, which pages may call
// the Worker, how now.md is split and put back together, and the words Claude is asked to tidy and gives back.
import { readNow } from '../../src/lib/now.js';

/** How long a login lasts, in seconds. */
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
/** The most text the page may send, in characters. */
export const LONGEST = 4000;

const encoder = new TextEncoder();
const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** @param {string} secret @param {string} data */
async function sign(secret, data) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

/** Two strings compared in a time that doesn't depend on where they first differ. @param {string} a @param {string} b */
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Whether a typed password is the right one. Both are hashed first, so the comparison takes the same time whatever
 * their lengths.
 * @param {unknown} typed @param {string | undefined} password
 */
export async function rightPassword(typed, password) {
  if (typeof typed !== 'string' || !typed || !password) return false;
  const digest = async (text) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
  return sameText(await digest(typed), await digest(password));
}

/**
 * A login pass: when it runs out (seconds since 1970) and a signature over that. The browser keeps it and sends it
 * as "Authorization: Bearer <pass>": a cookie wouldn't reach the Worker from the site, another address.
 * @param {string} secret @param {number} now in milliseconds
 */
export async function makePass(secret, now = Date.now()) {
  const until = String(Math.floor(now / 1000) + SESSION_SECONDS);
  return `${until}.${await sign(secret, until)}`;
}

/**
 * Whether a request carries a pass that this Worker signed and that hasn't run out.
 * @param {string | null} authorization the request's Authorization header @param {string | undefined} secret
 * @param {number} now in milliseconds
 */
export async function signedIn(authorization, secret, now = Date.now()) {
  if (!secret || !authorization) return false;
  const [until, signature] = authorization.replace(/^Bearer\s+/i, '').split('.');
  if (!/^\d+$/.test(until ?? '') || !signature) return false;
  if (Number(until) * 1000 <= now) return false;
  return sameText(signature, await sign(secret, until));
}

/**
 * The page a request comes from, when it's one that may call the Worker: the Worker's own page, the site, and
 * previews on this laptop. Browsers always send Origin from another address and on a POST.
 * @param {Request} request @returns {string | null}
 */
export function allowedOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  if (origin === new URL(request.url).origin || origin === 'https://jacklee981229.github.io') return origin;
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ? origin : null;
}

/**
 * now.md split in two: the comment at its top, kept exactly as it is, and everything under it, which the editor shows.
 * @param {string} file @returns {{ head: string, body: string }}
 */
export function splitNow(file) {
  const head = file.match(/^\s*<!--[\s\S]*?-->[^\S\n]*\n?/)?.[0] ?? '';
  return { head, body: file.slice(head.length).trim() };
}

/** now.md put back together from its top comment and the editor's text. @param {string} head @param {string} body */
export const joinNow = (head, body) => `${head}${body.replace(/\r\n?/g, '\n').trim()}\n`;

/** UTF-8 text as base64, the way GitHub's API takes a file. @param {string} text */
export function toBase64(text) {
  let binary = '';
  for (const byte of encoder.encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** GitHub's base64 (wrapped over several lines) as UTF-8 text. @param {string} base64 */
export function fromBase64(base64) {
  const binary = atob(base64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/**
 * The commit message for a save. Fixed words, not the items: Now often names games and shows, and names like those
 * stay out of commit messages.
 */
export const COMMIT_MESSAGE = 'Now - update';

/** What Claude is told when it tidies. */
export const TIDY_SYSTEM = `You tidy the "Now" list on Jack's personal website: what he is up to at the moment. He sends rough notes in English; you send back the list, one item per line.

Each item is one emoji, a space, a doing word ending in -ing (Playing, Building, Watching, Reading, Learning, Planning, Listening to), a colon, then the thing itself, for example:
🎮 Playing: Shape of Dreams
🛠️ Building: a little tool to update this list
On the website each line reads on as a phrase ("Playing Shape of Dreams"), so the doing word and the thing must read well together.

Jack may say a little about a thing after it, often after a dash: "Building Media Studio - an app that can ease me in processing many photos". That is the item's detail. Put it after the thing, after a space, an em dash and a space:
🛠️ Building: Media Studio — An app that helps me process lots of photos in one go
English doesn't always come out the way Jack means it, so don't just fix his grammar: work out what he is trying to say and say it the way a native speaker would, clear, natural and short (about 12 words at most). Rewrite freely, changing words and sentence shape, but keep his meaning and every name in it, and add no facts he didn't give. For example, "an app that can ease me in processing many photos and videos in a batch" becomes "An app that helps me sort through lots of photos and videos at once". Make it one sentence starting with a capital, with no full stop. An item without a detail gets none: never write one for him.

A new item starts where Jack starts another thing he is doing, usually with a doing word (Building, Writing, Playing), not at every full stop: a full stop may sit inside a detail.

Keep every name of a thing exactly as he wrote it, and keep Markdown links as they are; in the thing itself fix only capitals, spelling and punctuation. Drop nothing he said. Keep his order. One thing per item: split a line that holds two. No full stop at the end of an item. If something can't take a doing word, keep it as a plain line without a colon, still starting with an emoji.`;

/** The shape Claude's answer must take: the items, one per entry. */
export const TIDY_SCHEMA = {
  type: 'object',
  properties: { items: { type: 'array', items: { type: 'string' } } },
  required: ['items'],
  additionalProperties: false,
};

/**
 * Claude's answer as the editor's text, one "- " line per item, or nothing when there's nothing usable in it.
 * Every item must read as one of Now's lines, the way the site reads them (src/lib/now.js).
 * @param {unknown} answer the parsed JSON @returns {string | null}
 */
export function tidiedText(answer) {
  const items = /** @type {any} */ (answer)?.items;
  if (!Array.isArray(items)) return null;
  const lines = items.filter((item) => typeof item === 'string').map((item) => item.replace(/\s+/g, ' ').replace(/^[-*]\s+/, '').trim()).filter(Boolean);
  if (!lines.length) return null;
  const text = lines.map((line) => `- ${line}`).join('\n');
  return readNow(text).items.length === lines.length ? text : null;
}
