// Jack's Space guestbook: a Cloudflare Worker over a D1 database (schema.sql). GET /notes lists the notes that show,
// newest first; POST /notes takes a new one. Only the site (and previews on Jack's laptop) may post. A note that needs
// a look (notes.js) is kept but hidden until Jack shows it; he hides, pins and replies with SQL (README.md).
import { allowedOrigin, needsALook, RATE, readNote } from './notes.js';

/** The most notes one list sends, and the biggest note it takes, in bytes. */
const MOST = 500;
const BIGGEST = 4096;
const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')";

/** @param {string | null} origin */
const cors = (origin) => (origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : {});
/** @param {unknown} data @param {number} status @param {string | null} origin */
const json = (data, status, origin) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) } });

/** The notes that show, newest first, without anyone's email. @param {any} env */
async function list(env) {
  const { results } = await env.DB.prepare(`SELECT id, name, website, message, created_at, pinned, reply, reply_at FROM notes WHERE hidden = 0 ORDER BY created_at DESC, id DESC LIMIT ${MOST}`).all();
  return { notes: results };
}

/**
 * A visitor's address as a code that can't be read back: scrambled with a random salt the Worker keeps in its own
 * database (made on first use), so this public code can't undo it. Kept only to count recent notes.
 * @param {any} env @param {string} address
 */
async function scramble(env, address) {
  let row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'salt'").first();
  if (!row) {
    const salt = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('salt', ?)").bind(salt).run();
    row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'salt'").first();
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${row.value}|${address}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** @param {Request} request @param {any} env @param {string} origin */
async function post(request, env, origin) {
  const raw = await request.text();
  if (raw.length > BIGGEST) return json({ error: 'That note is too long.' }, 413, origin);
  /** @type {any} */
  let body = null;
  try { body = JSON.parse(raw); } catch { /* answered below */ }
  if (!body || typeof body !== 'object') return json({ error: 'Something went wrong. Please try again.' }, 400, origin);
  // A field people can't see: only a bot fills it in. It's told the note will show, and nothing is kept.
  if (body.company) return json({ held: true }, 202, origin);
  const read = readNote(body);
  if ('error' in read) return json({ error: read.error }, 400, origin);
  const code = await scramble(env, request.headers.get('CF-Connecting-IP') ?? 'unknown');
  const recent = await env.DB.prepare(`SELECT COUNT(*) AS n FROM notes WHERE ip_hash = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-${RATE.minutes} minutes')`).bind(code).first();
  if (recent.n >= RATE.notes) return json({ error: `You can leave ${RATE.notes} notes every ${RATE.minutes} minutes. Please try again a little later.` }, 429, origin);
  const { results: words } = await env.DB.prepare('SELECT word FROM words').all();
  const held = needsALook(read.note, words.map((w) => String(w.word)));
  const { note } = read;
  const saved = await env.DB.prepare(`INSERT INTO notes (name, email, website, message, created_at, hidden, ip_hash) VALUES (?, ?, ?, ?, ${NOW}, ?, ?) RETURNING id, name, website, message, created_at, pinned, reply, reply_at`).bind(note.name, note.email, note.website, note.message, held ? 1 : 0, code).first();
  // The codes are only for counting the last few minutes: a day on, they go.
  await env.DB.prepare("UPDATE notes SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND created_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 day')").run();
  return held ? json({ held: true }, 202, origin) : json({ held: false, note: saved }, 201, origin);
}

export default {
  /** @param {Request} request @param {any} env */
  async fetch(request, env) {
    const origin = allowedOrigin(request.headers.get('Origin'));
    if (new URL(request.url).pathname !== '/notes') return json({ error: 'Not found.' }, 404, origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    try {
      if (request.method === 'GET') return json(await list(env), 200, origin);
      if (request.method === 'POST') return origin ? await post(request, env, origin) : json({ error: 'Not allowed.' }, 403, null);
      return json({ error: 'Not allowed.' }, 405, origin);
    } catch {
      return json({ error: 'Something went wrong. Please try again.' }, 500, origin);
    }
  },
};
