// Jack's Now editor: a Cloudflare Worker that serves a small page (page.js) for changing src/content/now.md from any
// device. It reads the file from GitHub, asks Claude to tidy the words when Jack wants, and saves by committing the
// file to main, which deploys the site as any push does. Only Jack, logged in with his password, can change anything; the site's command
// palette uses it too (/now, src/lib/now-command.js).
import Anthropic from '@anthropic-ai/sdk';
import { page } from './page.js';
import { COMMIT_MESSAGE, LONGEST, TIDY_SCHEMA, TIDY_SYSTEM, allowedOrigin, fromBase64, joinNow, makePass, rightPassword, signedIn, splitNow, tidiedText, toBase64 } from './now-editor.js';

const PRIVATE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

/** @param {unknown} data @param {number} status */
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...PRIVATE } });

/** An answer with the headers that let the site's palette read it. @param {Response} response @param {string | null} origin */
function shared(response, origin) {
  if (!origin) return response;
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Vary', 'Origin');
  return response;
}
const PREFLIGHT = { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' };

/** A request to GitHub's API for now.md. @param {any} env @param {string} method @param {unknown} [body] */
function github(env, method, body) {
  const url = `https://api.github.com/repos/${env.REPO}/contents/${env.FILE}${method === 'GET' ? `?ref=${env.BRANCH}` : ''}`;
  return fetch(url, {
    method,
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'jacks-space-now-editor', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** now.md as it is on GitHub: its text and the version GitHub knows it by. @param {any} env */
async function readFile(env) {
  const answer = await github(env, 'GET');
  if (!answer.ok) throw new Error(`GitHub answered ${answer.status} to reading now.md`);
  const data = await answer.json();
  return { text: fromBase64(data.content), sha: String(data.sha) };
}

/** @param {any} env */
async function load(env) {
  const { text, sha } = await readFile(env);
  return json({ text: splitNow(text).body, sha });
}

/** @param {Request} request @param {any} env */
async function save(request, env) {
  const body = await readBody(request);
  if (typeof body?.text !== 'string' || typeof body?.sha !== 'string') return json({ error: 'Something went wrong. Please reload and try again.' }, 400);
  if (body.text.length > LONGEST) return json({ error: `Now can be up to ${LONGEST} characters.` }, 413);
  // The top comment comes from the file as it is now, so a save never changes it.
  const current = await readFile(env);
  if (current.sha !== body.sha) return json({ error: 'Now changed somewhere else since this page opened. Reload to see it, then make your change again.' }, 409);
  const text = joinNow(splitNow(current.text).head, body.text);
  if (text === current.text) return json({ error: 'Nothing has changed.' }, 400);
  const answer = await github(env, 'PUT', { message: COMMIT_MESSAGE, content: toBase64(text), sha: body.sha, branch: env.BRANCH });
  if (answer.status === 409 || answer.status === 422) return json({ error: 'Now changed somewhere else since this page opened. Reload to see it, then make your change again.' }, 409);
  if (!answer.ok) throw new Error(`GitHub answered ${answer.status} to saving now.md`);
  const data = await answer.json();
  return json({ sha: String(data.content.sha), commit: String(data.commit.html_url) });
}

/** @param {Request} request @param {any} env */
async function tidy(request, env) {
  const body = await readBody(request);
  const notes = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!notes) return json({ error: 'Write something first.' }, 400);
  if (notes.length > LONGEST) return json({ error: `Now can be up to ${LONGEST} characters.` }, 413);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 4000,
      system: TIDY_SYSTEM,
      messages: [{ role: 'user', content: notes }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: TIDY_SCHEMA } },
    });
    if (response.stop_reason === 'refusal') return json({ error: "Claude wouldn't tidy that. Save it as it is, or change the words." }, 422);
    const block = response.content.find((b) => b.type === 'text');
    let answer = null;
    try { answer = block ? JSON.parse(block.text) : null; } catch { /* answered below */ }
    const text = response.stop_reason === 'end_turn' ? tidiedText(answer) : null;
    return text ? json({ text }) : json({ error: "Claude's answer didn't come out as a list. Try again." }, 502);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json({ error: "Claude didn't accept the API key. Check ANTHROPIC_API_KEY." }, 502);
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'Claude is busy, or the API credits ran out. Try again later.' }, 503);
    if (error instanceof Anthropic.APIError) return json({ error: "Claude couldn't tidy it just now. Try again." }, 502);
    throw error;
  }
}

/** @param {Request} request @param {any} env */
async function login(request, env) {
  const body = await readBody(request);
  if (!(await rightPassword(body?.password, env.NOW_PASSWORD))) {
    // shortcut: one second's wait only slows guessing one try at a time; a long password is the real guard. Add
    // Cloudflare's rate limiting if the address ever gets passed around.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return json({ error: "That's not the password." }, 401);
  }
  return json({ pass: await makePass(env.SESSION_SECRET) });
}

/** @param {Request} request */
async function readBody(request) {
  const raw = await request.text();
  if (raw.length > LONGEST * 4) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default {
  /** @param {Request} request @param {any} env */
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const { method } = request;
    if (method === 'GET' && pathname === '/') return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', ...PRIVATE } });
    if (method === 'GET' && pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } });
    if (!pathname.startsWith('/api/')) return new Response('Not found.', { status: 404, headers: PRIVATE });
    const origin = allowedOrigin(request);
    // A page on another address that isn't allowed gets nothing; the Worker's own page sends no Origin on a GET.
    if (request.headers.get('Origin') && !origin) return json({ error: 'Not allowed.' }, 403);
    if (method === 'OPTIONS') return shared(new Response(null, { status: 204, headers: PREFLIGHT }), origin);
    return shared(await answer(request, env, method, pathname, origin), origin);
  },
};

/** @param {Request} request @param {any} env @param {string} method @param {string} pathname @param {string | null} origin */
async function answer(request, env, method, pathname, origin) {
  try {
    if (method === 'POST' && !origin) return json({ error: 'Not allowed.' }, 403);
    if (method === 'POST' && pathname === '/api/login') return await login(request, env);
    if (!(await signedIn(request.headers.get('Authorization'), env.SESSION_SECRET))) return json({ error: 'Please log in.' }, 401);
    if (method === 'GET' && pathname === '/api/now') return await load(env);
    if (method === 'POST' && pathname === '/api/tidy') return await tidy(request, env);
    if (method === 'POST' && pathname === '/api/save') return await save(request, env);
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
}
