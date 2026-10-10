// The guestbook's notes as elements, in the browser (styles/guestbook.css): on the wall and the home page's card as
// squares of coloured paper, in the list under the wall as cards. Everything a visitor wrote goes in as text, never
// as HTML.
import { formatDate, timeAgo } from './dates.js';
import { initialOf, lookOf } from './guestbook.js';

/** @typedef {import('./guestbook.js').Note} Note */

/** @param {string} tag @param {string} [className] @param {string} [text] */
function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Who wrote it, linked to their website if they gave one, and when. @param {Note} note @param {Date} now */
function byline(note, now) {
  const by = make('p', 'note-by');
  const who = make(note.website ? 'a' : 'b', 'note-name', note.name);
  if (who instanceof HTMLAnchorElement && note.website) {
    who.href = note.website;
    // A visitor's own link: it opens apart and gives their site no weight with search engines.
    who.rel = 'nofollow ugc noopener noreferrer';
    who.target = '_blank';
  }
  const when = make('time', 'note-when', timeAgo(new Date(note.created_at), now).replace(/^./, (c) => c.toUpperCase()));
  when.setAttribute('datetime', note.created_at);
  when.title = formatDate(new Date(note.created_at));
  by.append(who, when);
  return by;
}

/** Jack's reply under a note, with his face (the site's own logo, so not a visitor's words). @param {Note} note @param {string} face */
function reply(note, face) {
  const box = make('div', 'note-reply');
  box.innerHTML = face;
  const words = make('p');
  words.append(make('b', '', 'Jack: '), document.createTextNode(note.reply ?? ''));
  box.append(words);
  return box;
}

/** A note on paper of its colour, a little askew. @param {Note} note @param {string} face @param {Date} [now] */
export function paperNote(note, face, now = new Date()) {
  const { colour, tilt } = lookOf(note.id);
  const card = make('article', 'note paper');
  card.dataset.id = String(note.id);
  card.style.setProperty('--note', `var(--note-${colour})`);
  card.style.setProperty('--tilt', `${tilt}deg`);
  card.append(make('p', 'note-text', note.message), byline(note, now));
  if (note.reply) card.append(reply(note, face));
  return card;
}

/** A note as a card in the list, the writer's first letter on their note's colour. @param {Note} note @param {string} face @param {Date} [now] */
export function cardNote(note, face, now = new Date()) {
  const card = make('article', 'note card-note');
  card.style.setProperty('--note', `var(--note-${lookOf(note.id).colour})`);
  const head = make('div', 'note-head');
  const initial = make('span', 'note-initial', initialOf(note.name));
  initial.setAttribute('aria-hidden', 'true');
  head.append(initial, byline(note, now));
  card.append(head, make('p', 'note-text', note.message));
  if (note.reply) card.append(reply(note, face));
  return card;
}

/** The note shown while there are none yet. */
export function emptyNote() {
  const card = make('article', 'note paper');
  card.style.setProperty('--note', 'var(--note-1)');
  card.style.setProperty('--tilt', '-1deg');
  card.append(make('p', 'note-text', 'Be the first to leave a note!'));
  return card;
}
