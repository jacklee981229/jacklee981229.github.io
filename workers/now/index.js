// Jack's Now editor: a Cloudflare Worker that serves a small page (page.js) for changing src/content/now.md from any
// device. It reads the file from GitHub, asks Claude to tidy the words when Jack wants, and saves by committing the
// file to main, which deploys the site as any push does. Only Jack, logged in with his password, can change anything; the site's command
// palette uses it too (/now, src/lib/now-command.js).
import Anthropic from '@anthropic-ai/sdk';
import { draftRoute } from './drafts.js';
import { page } from './page.js';
import { LIMITS } from '../../src/lib/drafts.js';
import { MOST_SCORES, readScore } from './scores.js';
import { readTodos } from './todos.js';
import { COMMIT_MESSAGE, LONGEST, TIDY_SCHEMA, TIDY_SYSTEM, allowedOrigin, bytesToBase64, fromBase64, joinNow, makePass, rightPassword, signedIn, splitNow, tidied, toBase64 } from './now-editor.js';
import { pictureBytes, steamPictures } from './pictures.js';
import { pictureFile, readNow } from '../../src/lib/now.js';

/** Where the pictures Jack picks for Now go (src/lib/now-pictures.ts reads them). */
const PICTURES = 'src/assets/now';

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

/** A request to GitHub's API for this repo. @param {any} env @param {string} method @param {string} path @param {unknown} [body] */
function githubApi(env, method, path, body) {
  return fetch(`https://api.github.com/repos/${env.REPO}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'jacks-space-now-editor', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** A request to GitHub's API for now.md. @param {any} env @param {string} method @param {unknown} [body] */
const github = (env, method, body) => githubApi(env, method, `contents/${env.FILE}${method === 'GET' ? `?ref=${env.BRANCH}` : ''}`, body);

/** A GitHub answer's JSON, or an error naming what was asked. @param {Response} answer @param {string} what */
async function githubJson(answer, what) {
  if (!answer.ok) throw new Error(`GitHub answered ${answer.status} to ${what}`);
  return answer.json();
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
  if (body.picture) return await saveWithPicture(env, text, body.sha, body.picture);
  if (text === current.text) return json({ error: 'Nothing has changed.' }, 400);
  const answer = await github(env, 'PUT', { message: COMMIT_MESSAGE, content: toBase64(text), sha: body.sha, branch: env.BRANCH });
  if (answer.status === 409 || answer.status === 422) return json({ error: 'Now changed somewhere else since this page opened. Reload to see it, then make your change again.' }, 409);
  if (!answer.ok) throw new Error(`GitHub answered ${answer.status} to saving now.md`);
  const data = await answer.json();
  return json({ sha: String(data.content.sha), commit: String(data.commit.html_url) });
}

/**
 * now.md and the picture Jack picked for one of its items, saved as one commit: the contents call takes one file at a
 * time, so this builds the commit from GitHub's blobs and trees. The picture is named after the item's thing
 * (pictureFile), so an older picture of the same thing is replaced. Another commit landing in between makes the
 * branch move refuse, and Jack tries again.
 * @param {any} env @param {string} text the whole new now.md @param {string} sha now.md's version the palette read
 * @param {any} picture { line, url }: which item, and one of the Steam pictures it was offered
 */
async function saveWithPicture(env, text, sha, picture) {
  const item = Number.isInteger(picture?.line) ? readNow(text).items[picture.line] : undefined;
  const name = item ? pictureFile(item.value) : '';
  const bytes = name ? await pictureBytes(picture.url) : null;
  if (!bytes) return json({ error: "That picture couldn't be fetched. Pick another, or save without one." }, 400);
  const head = (await githubJson(await githubApi(env, 'GET', `git/ref/heads/${env.BRANCH}`), 'reading the branch')).object.sha;
  const commit = await githubJson(await githubApi(env, 'GET', `git/commits/${head}`), 'reading the last commit');
  // now.md as of that very commit, so a change made since the palette read it isn't overwritten.
  const file = await githubJson(await githubApi(env, 'GET', `contents/${env.FILE}?ref=${head}`), 'reading now.md');
  if (String(file.sha) !== sha) return json({ error: 'Now changed somewhere else since this page opened. Reload to see it, then make your change again.' }, 409);
  const blob = await githubJson(await githubApi(env, 'POST', 'git/blobs', { content: bytesToBase64(bytes), encoding: 'base64' }), 'storing the picture');
  const tree = await githubJson(
    await githubApi(env, 'POST', 'git/trees', {
      base_tree: commit.tree.sha,
      tree: [
        { path: env.FILE, mode: '100644', type: 'blob', content: text },
        { path: `${PICTURES}/${name}`, mode: '100644', type: 'blob', sha: blob.sha },
      ],
    }),
    'making the tree',
  );
  const made = await githubJson(await githubApi(env, 'POST', 'git/commits', { message: COMMIT_MESSAGE, tree: tree.sha, parents: [head] }), 'making the commit');
  const moved = await githubApi(env, 'PATCH', `git/refs/heads/${env.BRANCH}`, { sha: made.sha, force: false });
  if (moved.status === 409 || moved.status === 422) return json({ error: 'Now changed somewhere else since this page opened. Reload to see it, then make your change again.' }, 409);
  await githubJson(moved, 'moving the branch');
  return json({ commit: String(made.html_url) });
}

/** A game's pictures on Steam for the palette to offer. @param {URL} url */
async function pictures(url) {
  const name = (url.searchParams.get('name') ?? '').trim();
  if (!name || name.length > 200) return json({ error: 'Which game?' }, 400);
  try {
    return json(await steamPictures(name));
  } catch (error) {
    console.error(error);
    return json({ error: "Couldn't reach Steam for pictures just now." }, 502);
  }
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
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: TIDY_SCHEMA } },
    });
    if (response.stop_reason === 'refusal') return json({ error: "Claude wouldn't tidy that. Save it as it is, or change the words." }, 422);
    const block = response.content.find((b) => b.type === 'text');
    let answer = null;
    try { answer = block ? JSON.parse(block.text) : null; } catch { /* answered below */ }
    const made = response.stop_reason === 'end_turn' ? tidied(answer) : null;
    return made ? json(made) : json({ error: "Claude's answer didn't come out as a list. Try again." }, 502);
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

/** Jack's Morning Brief scores, newest first. @param {any} env */
async function scoresList(env) {
  const { results } = await env.DB.prepare(`SELECT id, day, title, kind, source, score, scored_at FROM brief_scores ORDER BY scored_at DESC LIMIT ${MOST_SCORES}`).all();
  return json({ scores: results });
}

/** Saves one score, or takes it back with 0. @param {Request} request @param {any} env */
async function scoreSave(request, env) {
  const read = readScore(await readBody(request));
  if ('error' in read) return json({ error: read.error }, 400);
  const { id, day, title, kind, source, score } = read.score;
  if (score === 0) await env.DB.prepare('DELETE FROM brief_scores WHERE id = ?').bind(id).run();
  else await env.DB.prepare("INSERT INTO brief_scores (id, day, title, kind, source, score, scored_at) VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) ON CONFLICT (id) DO UPDATE SET score = excluded.score, scored_at = excluded.scored_at").bind(id, day, title, kind, source, score).run();
  return json({ id, score });
}

/**
 * The laptop's push of Jack's open to-dos (todos.js), with its own token. A browser never gets this far: any request
 * with an Origin is turned away, and PUT isn't in the preflight's methods.
 * @param {Request} request @param {any} env
 */
async function todosPush(request, env) {
  if (request.headers.get('Origin')) return json({ error: 'Not allowed.' }, 403);
  if (!(await rightPassword(request.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''), env.TODO_PUSH_TOKEN))) return json({ error: 'Wrong token.' }, 401);
  const read = readTodos(await readBody(request, 1_000_000));
  if ('error' in read) return json({ error: read.error }, 400);
  const { pushedAt, projects, items } = read.list;
  // Only a newer push replaces the list, so two pushes arriving out of order never bring back the older one.
  const { meta } = await env.DB.prepare('INSERT INTO todo_list (id, list, pushed_at) VALUES (1, ?, ?) ON CONFLICT (id) DO UPDATE SET list = excluded.list, pushed_at = excluded.pushed_at WHERE excluded.pushed_at > todo_list.pushed_at')
    .bind(JSON.stringify({ projects, items }), pushedAt)
    .run();
  return json({ kept: meta.changes > 0, count: items.length });
}

/** Jack's open to-dos as last pushed: none before the first push. @param {any} env */
async function todosList(env) {
  const row = await env.DB.prepare('SELECT list, pushed_at FROM todo_list WHERE id = 1').first();
  return json(row ? { pushedAt: row.pushed_at, ...JSON.parse(String(row.list)) } : { pushedAt: null, projects: [], items: [] });
}

/** @param {Request} request @param {number} [longest] the most characters taken */
async function readBody(request, longest = LONGEST * 4) {
  const raw = await request.text();
  if (raw.length > longest) return null;
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
    // The brief's maker reads the scores with its own read-only token; the page reads them with Jack's pass.
    if (method === 'GET' && pathname === '/api/brief/scores' && (await rightPassword(request.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''), env.BRIEF_READ_TOKEN))) return await scoresList(env);
    if (method === 'PUT' && pathname === '/api/todos') return await todosPush(request, env);
    if (!(await signedIn(request.headers.get('Authorization'), env.SESSION_SECRET))) return json({ error: 'Please log in.' }, 401);
    if (method === 'GET' && pathname === '/api/todos') return await todosList(env);
    if (method === 'GET' && pathname === '/api/brief/scores') return await scoresList(env);
    if (method === 'POST' && pathname === '/api/brief/score') return await scoreSave(request, env);
    if (method === 'GET' && pathname === '/api/now') return await load(env);
    if (method === 'POST' && pathname === '/api/tidy') return await tidy(request, env);
    if (method === 'GET' && pathname === '/api/pictures') return await pictures(new URL(request.url));
    if (method === 'POST' && pathname === '/api/save') return await save(request, env);
    if (pathname.startsWith('/api/drafts')) {
      const drafted = await draftRoute(request, env, method, pathname, PRIVATE, (r) => readBody(r, LIMITS.body * 6 + 2000));
      if (drafted) return drafted;
    }
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
}
