// The guestbook's rules, apart from the Worker (index.js) so they can be tested: what a note may hold, which notes wait
// for Jack, and which pages may call the Worker.

/** The longest each part of a note may be, in characters. */
export const LIMITS = { name: 40, message: 300, email: 254, website: 200 };
/** How many notes one visitor may post, and over how many minutes. */
export const RATE = { notes: 3, minutes: 10 };

/** @param {unknown} value */
const text = (value) => (typeof value === 'string' ? value : '');

/**
 * A posted note made tidy and checked: the name on one line, the message without runs of empty lines, and the email
 * and website optional (a website without its https:// gets one). The clean note, or the first problem in words for
 * the form.
 * @param {Record<string, unknown> | null | undefined} body
 * @returns {{ note: { name: string, message: string, email: string | null, website: string | null } } | { error: string }}
 */
export function readNote(body) {
  const name = text(body?.name).replace(/\s+/g, ' ').trim();
  const message = text(body?.message).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const email = text(body?.email).trim();
  let website = text(body?.website).trim();
  if (!name) return { error: 'Please add your name.' };
  if ([...name].length > LIMITS.name) return { error: `Your name can be up to ${LIMITS.name} characters.` };
  if (!message) return { error: 'Please write a message.' };
  if ([...message].length > LIMITS.message) return { error: `Your message can be up to ${LIMITS.message} characters.` };
  if (email && (email.length > LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: "That email doesn't look right." };
  if (website) {
    if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
    let url = null;
    try { url = new URL(website); } catch { /* not an address at all */ }
    if (!url || !/^https?:$/.test(url.protocol) || !url.hostname.includes('.') || website.length > LIMITS.website) return { error: "That website doesn't look right." };
    website = url.href;
  }
  return { note: { name, message, email: email || null, website: website || null } };
}

/**
 * Whether a note waits for Jack before it shows: a web address in its message (what spam is made of), or a word from
 * his list in its name, message or website. A word of plain letters and digits counts only as a whole word ("ass"
 * not in "class"); any other (Chinese, say) anywhere it appears.
 * @param {{ name: string, message: string, website: string | null }} note
 * @param {string[]} words
 */
export function needsALook(note, words) {
  if (/https?:\/\/|www\./i.test(note.message)) return true;
  const all = `${note.name}\n${note.message}\n${note.website ?? ''}`.toLowerCase();
  return words.some((w) => {
    const word = w.toLowerCase().trim();
    if (!word) return false;
    return /^[a-z0-9]+$/.test(word) ? new RegExp(`\\b${word}\\b`).test(all) : all.includes(word);
  });
}

/** The pages that may call the guestbook: the site, and previews on this laptop. @param {string | null} origin */
export function allowedOrigin(origin) {
  if (!origin) return null;
  if (origin === 'https://jacklee981229.github.io') return origin;
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ? origin : null;
}
