// Jack's drafts, kept in the Worker's D1 database (schema.sql) so nothing reaches the public repo before he presses
// Publish. Publish commits the post's index.md and its pictures to main in one commit through GitHub's Git Data API;
// the site deploys as after any push. The rules a draft follows are shared with the editor page (src/lib/drafts.js).
// Pictures arrive and are kept as base64, made by the browser, and Publish sends them one per request: turning a
// picture into base64 here takes about 45 ms of CPU, and the Workers free plan allows 10 ms a request.
import { IMAGE_TYPES, LIMITS, nextAddress, pictureName, postFile, problems } from '../../src/lib/drafts.js';
import { toBase64 } from './now-editor.js';

const POSTS = 'src/content/posts';
const STAMP = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** @param {unknown} data @param {number} status @param {Record<string, string>} headers */
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

/** How many bytes a picture's base64 stands for. @param {string} base64 */
const bytesOf = (base64) => Math.floor((base64.length * 3) / 4) - (base64.match(/=*$/)?.[0].length ?? 0);

/** A draft's fields from what the page sent, each cut to its limit. @param {any} body */
const fields = (body) => ({
  title: String(body?.title ?? '').slice(0, LIMITS.title),
  topic: String(body?.topic ?? ''),
  tags: String(body?.tags ?? '').slice(0, 300),
  body: String(body?.body ?? '').slice(0, LIMITS.body),
});

/** @param {any} env @param {string} id */
const findDraft = (env, id) => env.DB.prepare('SELECT id, title, topic, tags, body, created_at, updated_at FROM drafts WHERE id = ?').bind(id).first();
/** @param {any} env @param {string} id @returns {Promise<{ name: string, type: string, size: number }[]>} */
const listImages = async (env, id) => (await env.DB.prepare('SELECT name, type, size FROM draft_images WHERE draft_id = ? ORDER BY created_at').bind(id).all()).results;

/**
 * GitHub's API, as the Now editor's token. @param {any} env @param {string} method @param {string} path
 * @param {unknown} [body] an object, or a string already in JSON
 */
async function github(env, method, path, body) {
  // GITHUB_API is set only by local probes, to a stand-in that never touches the real main.
  const answer = await fetch(`${env.GITHUB_API ?? 'https://api.github.com'}/repos/${env.REPO}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'jacks-space-now-editor', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  return answer;
}

/** @param {any} env @param {string} method @param {string} path @param {unknown} [body] */
async function githubJson(env, method, path, body) {
  const answer = await github(env, method, path, body);
  if (!answer.ok) throw new Error(`GitHub answered ${answer.status} to ${method} ${path}`);
  return answer.json();
}

/**
 * One commit on top of main holding the post's folder: index.md and the pictures, already on GitHub as blobs.
 * Returns null when main moved while it was being made, so the caller can start again from the new main.
 * @param {any} env @param {{ title: string, topic: string, tags: string, body: string }} draft
 * @param {Record<string, string>} blobs each picture's name and its blob on GitHub
 */
async function commitPost(env, draft, blobs) {
  const head = await githubJson(env, 'GET', `git/ref/heads/${env.BRANCH}`);
  const parent = head.object.sha;
  const commit = await githubJson(env, 'GET', `git/commits/${parent}`);
  const folders = await githubJson(env, 'GET', `contents/${POSTS}?ref=${parent}`);
  const address = nextAddress(folders.filter((f) => f.type === 'dir').map((f) => f.name));
  const index = await githubJson(env, 'POST', 'git/blobs', { content: toBase64(postFile(draft, new Date())), encoding: 'base64' });
  const tree = [
    { path: `${POSTS}/${address}/index.md`, mode: '100644', type: 'blob', sha: index.sha },
    ...Object.entries(blobs).map(([name, sha]) => ({ path: `${POSTS}/${address}/${name}`, mode: '100644', type: 'blob', sha })),
  ];
  const made = await githubJson(env, 'POST', 'git/trees', { base_tree: commit.tree.sha, tree });
  // Fixed words and the address, not the title: titles name products, and names like those stay out of commit
  // messages (as with Now's saves).
  const next = await githubJson(env, 'POST', 'git/commits', { message: `Post - publish /${address}/`, tree: made.sha, parents: [parent] });
  const moved = await github(env, 'PATCH', `git/refs/heads/${env.BRANCH}`, { sha: next.sha, force: false });
  if (moved.status === 422) return null;
  if (!moved.ok) throw new Error(`GitHub answered ${moved.status} to moving ${env.BRANCH}`);
  return { address, commit: String(next.html_url ?? '') };
}

/**
 * Publish, in steps the page takes one after another: the check (is the draft ready, and which pictures go), then
 * "picture" once for each (it goes to GitHub as a blob, not yet in any commit), then "finish" (the commit, and the
 * draft removed).
 * @param {Request} request @param {any} env @param {string} id @param {string | undefined} step
 * @param {Record<string, string>} headers @param {(request: Request) => Promise<any>} readBody
 */
async function publish(request, env, id, step, headers, readBody) {
  const draft = await findDraft(env, id);
  if (!draft) return json({ error: 'That draft is gone.' }, 404, headers);
  const names = (await listImages(env, id)).map((i) => i.name);
  const found = problems(draft, names);
  if (found.length) return json({ error: found.join(' ') }, 400, headers);
  if (!step) return json({ pictures: names }, 200, headers);
  if (step === 'picture') {
    const name = new URL(request.url).searchParams.get('name') ?? '';
    const image = await env.DB.prepare('SELECT data FROM draft_images WHERE draft_id = ? AND name = ?').bind(id, name).first();
    if (!image) return json({ error: `${name} is gone. Reload and try again.` }, 404, headers);
    // The base64 goes in as it is: JSON.stringify would copy the whole picture once more.
    const blob = await githubJson(env, 'POST', 'git/blobs', `{"content":"${image.data}","encoding":"base64"}`);
    return json({ sha: String(blob.sha) }, 200, headers);
  }
  const blobs = (await readBody(request))?.blobs ?? {};
  const fits = Object.keys(blobs).sort().join('/') === [...names].sort().join('/') && Object.values(blobs).every((sha) => typeof sha === 'string' && /^[0-9a-z-]+$/i.test(sha));
  if (!fits) return json({ error: 'The pictures changed while publishing. Press Publish again.' }, 409, headers);
  // Someone else's push (the Morning Brief, a Now save) can land between reading main and moving it: try once more.
  const done = (await commitPost(env, draft, blobs)) ?? (await commitPost(env, draft, blobs));
  if (!done) return json({ error: 'The site changed on GitHub while publishing. Press Publish again.' }, 409, headers);
  // shortcut: if this delete fails after main has moved, the draft stays and a second Publish posts it twice. D1
  // failing just then is rare; mark the draft as published before the commit if it ever happens.
  await env.DB.batch([env.DB.prepare('DELETE FROM draft_images WHERE draft_id = ?').bind(id), env.DB.prepare('DELETE FROM drafts WHERE id = ?').bind(id)]);
  return json(done, 200, headers);
}

/**
 * The drafts' routes, all behind Jack's login; null for any other address.
 * @param {Request} request @param {any} env @param {string} method @param {string} pathname
 * @param {Record<string, string>} headers @param {(request: Request) => Promise<any>} readBody
 */
export async function draftRoute(request, env, method, pathname, headers, readBody) {
  if (method === 'GET' && pathname === '/api/drafts') {
    const { results } = await env.DB.prepare('SELECT d.id, d.title, d.topic, d.updated_at, (SELECT count(*) FROM draft_images i WHERE i.draft_id = d.id) AS images FROM drafts d ORDER BY d.updated_at DESC').all();
    return json({ drafts: results }, 200, headers);
  }
  if (method === 'POST' && pathname === '/api/drafts') {
    const id = crypto.randomUUID();
    const body = await readBody(request);
    if (!body) return json({ error: 'Something went wrong. Please try again.' }, 400, headers);
    const f = fields(body);
    await env.DB.prepare(`INSERT INTO drafts (id, title, topic, tags, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ${STAMP}, ${STAMP})`).bind(id, f.title, f.topic, f.tags, f.body).run();
    return json({ id }, 200, headers);
  }
  const match = pathname.match(/^\/api\/drafts\/([0-9a-f-]{36})(?:\/(delete|publish|images)(?:\/([a-z0-9_.-]+?)(\/delete)?)?)?$/);
  if (!match) return null;
  const [, id, action, name, remove] = match;
  const tooLong = () => json({ error: `A draft can be up to ${LIMITS.body.toLocaleString('en')} characters.` }, 413, headers);

  if (!action && method === 'GET') {
    const draft = await findDraft(env, id);
    return draft ? json({ draft, images: await listImages(env, id) }, 200, headers) : json({ error: 'That draft is gone.' }, 404, headers);
  }
  if (!action && method === 'POST') {
    const body = await readBody(request);
    if (!body) return tooLong();
    const draft = await findDraft(env, id);
    if (!draft) return json({ error: 'That draft is gone.' }, 404, headers);
    // A save from a page that opened an older copy (another tab, the phone) would undo the newer words.
    if (body?.updated_at !== draft.updated_at) return json({ error: 'This draft changed somewhere else since this page opened. Reload to see it, then make your change again.' }, 409, headers);
    const f = fields(body);
    const saved = await env.DB.prepare(`UPDATE drafts SET title = ?, topic = ?, tags = ?, body = ?, updated_at = ${STAMP} WHERE id = ? RETURNING updated_at`).bind(f.title, f.topic, f.tags, f.body, id).first();
    return json({ updated_at: saved.updated_at }, 200, headers);
  }
  if (action === 'delete' && method === 'POST') {
    await env.DB.batch([env.DB.prepare('DELETE FROM draft_images WHERE draft_id = ?').bind(id), env.DB.prepare('DELETE FROM drafts WHERE id = ?').bind(id)]);
    return json({ deleted: true }, 200, headers);
  }
  if (action === 'publish' && method === 'POST') {
    const step = new URL(request.url).searchParams.get('step') ?? undefined;
    if (step && step !== 'picture' && step !== 'finish') return json({ error: 'Not found.' }, 404, headers);
    return publish(request, env, id, step, headers, readBody);
  }

  if (action === 'images' && !name && method === 'POST') {
    if (!(await findDraft(env, id))) return json({ error: 'That draft is gone.' }, 404, headers);
    const images = await listImages(env, id);
    if (images.length >= LIMITS.images) return json({ error: `A draft can have up to ${LIMITS.images} pictures.` }, 413, headers);
    const file = new URL(request.url).searchParams.get('name') ?? '';
    const picked = pictureName(file, images.map((i) => i.name));
    if (!picked) return json({ error: 'Pictures can be PNG, JPG, WebP or GIF.' }, 400, headers);
    // The picture as base64 (the page makes it), so Publish can pass it to GitHub as it is.
    const data = (await request.text()).trim();
    if (!data) return json({ error: 'That picture is empty.' }, 400, headers);
    if (data.length > Math.ceil(LIMITS.image / 3) * 4) return json({ error: `Pictures can be up to ${LIMITS.image / 1_000_000} MB.` }, 413, headers);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return json({ error: "That picture didn't arrive whole. Try again." }, 400, headers);
    const size = bytesOf(data);
    const type = IMAGE_TYPES[/** @type {keyof typeof IMAGE_TYPES} */ (picked.split('.').pop())];
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO draft_images (draft_id, name, type, size, data, created_at) VALUES (?, ?, ?, ?, ?, ${STAMP})`).bind(id, picked, type, size, data),
      env.DB.prepare(`UPDATE drafts SET updated_at = ${STAMP} WHERE id = ?`).bind(id),
    ]);
    const draft = await findDraft(env, id);
    return json({ name: picked, type, size, updated_at: draft.updated_at }, 200, headers);
  }
  if (action === 'images' && name && !remove && method === 'GET') {
    const image = await env.DB.prepare('SELECT type, data FROM draft_images WHERE draft_id = ? AND name = ?').bind(id, name).first();
    if (!image) return json({ error: 'That picture is gone.' }, 404, headers);
    // As base64, which the page shows as a data: address; turning it back into bytes here would cost the CPU.
    return json({ type: image.type, base64: image.data }, 200, headers);
  }
  if (action === 'images' && name && remove && method === 'POST') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM draft_images WHERE draft_id = ? AND name = ?').bind(id, name),
      env.DB.prepare(`UPDATE drafts SET updated_at = ${STAMP} WHERE id = ?`).bind(id),
    ]);
    const draft = await findDraft(env, id);
    return json({ deleted: name, updated_at: draft?.updated_at }, 200, headers);
  }
  return json({ error: 'Not found.' }, 404, headers);
}
