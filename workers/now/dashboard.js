// Jack's dashboard: the snapshot of his personal projects that his laptop pushes every 15 minutes
// (C:\repos\Jack\dashboard, collect.py, whose docstring is the format), kept in the Worker's D1 database (schema.sql,
// dashboard) for his eyes only: the page /dashboard/ (src/lib/dashboard.js). The push and its checks live here, apart
// from the Worker, so they can be tested.
import { KINDS } from '../../src/lib/dashboard.js';
import { rightPassword } from './now-editor.js';

/** The most characters a push may hold: a snapshot is about 30 KB; this leaves room for a busy fortnight. */
export const LONGEST_PUSH = 500_000;
/** How far ahead of the Worker's clock a snapshot may be dated: a laptop clock that runs fast, not a date to come. */
export const CLOCK_SLACK_MS = 5 * 60 * 1000;
// Lists are capped so one row stays well under D1's 2 MB, and words cut, not refused, as with the to-dos.
const MOST = { apps: 20, runs: 100, repos: 100, done: 2000, reminders: 20 };
/** The kinds a repo can be, the page's list (the laptop's table, collect.py's KINDS, uses these keys); one the Worker
 *  doesn't know yet is kept as other, so a new kind on the laptop never stops its push. */
const KIND_KEYS = KINDS.map((k) => k.key);
const LONGEST_TEXT = 300;

/** @param {unknown} data @param {number} status @param {Record<string, string>} headers */
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

class Bad extends Error {}
/** @param {boolean} ok @param {string} what */
const need = (ok, what) => { if (!ok) throw new Bad(what); };

const TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/;
const DAY = /^\d{4}-\d\d-\d\d$/;
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** An ISO time with its zone, as the laptop writes them. @param {unknown} v @param {string} what */
function time(v, what) {
  need(typeof v === 'string' && TIME.test(v) && !Number.isNaN(Date.parse(v)), `${what} must be an ISO time with its zone.`);
  return /** @type {string} */ (v);
}
/** @param {unknown} v @param {string} what */
const maybeTime = (v, what) => (v === null ? null : time(v, what));
/** @param {unknown} v @param {string} what */
function text(v, what, empty = true) {
  need(typeof v === 'string' && (empty || v.trim() !== ''), `${what} must be words.`);
  return /** @type {string} */ (v).trim().slice(0, LONGEST_TEXT);
}
/** Words that may be left out (null or missing): only there when given. @param {unknown} v @param {string} what */
const maybeText = (v, what) => (v === undefined || v === null ? {} : { [what]: text(v, what, false) });
/** @param {unknown} v @param {string} what */
function count(v, what) {
  need(Number.isSafeInteger(v) && /** @type {number} */ (v) >= 0, `${what} must be a whole number.`);
  return /** @type {number} */ (v);
}
/** @param {unknown} v @param {string} what @param {number} most */
function list(v, what, most) {
  need(Array.isArray(v), `${what} must be a list.`);
  need(/** @type {unknown[]} */ (v).length <= most, `${what} holds up to ${most}.`);
  return /** @type {any[]} */ (v);
}

/**
 * One part of the snapshot: what `read` makes of it, or the laptop's word that its source couldn't be read.
 * @param {any} v @param {string} name @param {(v: any) => object} read
 */
function part(v, name, read) {
  need(isObject(v), `${name} is missing.`);
  if ('error' in v) return { error: text(v.error, `${name}.error`, false) };
  return read(v);
}

const sideload = (v) => ({
  apps: list(v.apps, 'sideload.apps', MOST.apps).map((a) => ({
    app: text(a?.app, 'An app', false),
    signed_at: time(a.signed_at, 'signed_at'),
    runs_out_at: time(a.runs_out_at, 'runs_out_at'),
    failures: count(a.failures, 'failures'),
    last_error: text(a.last_error, 'last_error'),
    last_failure_at: maybeTime(a.last_failure_at, 'last_failure_at'),
    waiting_build_at: maybeTime(a.waiting_build_at, 'waiting_build_at'),
    // The repo whose card shows the signing; newer laptops send it.
    ...maybeText(a.project, 'project'),
  })),
});

const deploys = (v) => ({
  runs: list(v.runs, 'deploys.runs', MOST.runs).map((r) => {
    need(['success', 'failure', 'running'].includes(r?.state), 'A run state must be success, failure or running.');
    // The page links to it, so only GitHub's own pages get through.
    need(typeof r.url === 'string' && r.url.startsWith('https://github.com/') && r.url.length <= 500, 'A run url must be on github.com.');
    return { repo: text(r.repo, 'A repo', false), workflow: text(r.workflow, 'A workflow', false), state: r.state, at: time(r.at, 'A run time'), url: r.url };
  }),
});

const backup = (v) => ({
  last_success_at: maybeTime(v.last_success_at, 'last_success_at'),
  last_error: text(v.last_error, 'last_error'),
  last_error_at: maybeTime(v.last_error_at, 'last_error_at'),
  ...maybeText(v.project, 'project'),
});

const repos = (v) => ({
  repos: list(v.repos, 'repos.repos', MOST.repos).map((r) => ({ name: text(r?.name, 'A repo', false), uncommitted: count(r.uncommitted, 'uncommitted'), unpushed: count(r.unpushed, 'unpushed'), ...kind(r.kind) })),
});
/** A repo's kind, when the laptop sends one. @param {unknown} v */
function kind(v) {
  if (v === undefined) return {};
  need(typeof v === 'string', 'A kind must be words.');
  return { kind: KIND_KEYS.includes(/** @type {string} */ (v)) ? v : 'other' };
}

/** The to-dos the laptop put on Jack's list as reminders (a sideload to re-sign), so the page shows them under
 *  Reminders and not as to-dos. Newer laptops send them; none from an older one. @param {unknown} v */
function reminders(v) {
  if (v === undefined) return {};
  return { reminders: list(v, 'reminders', MOST.reminders).map((r) => ({ app: text(r?.app, 'A reminder app', false), project: text(r.project, 'A reminder project', false), text: text(r.text, 'A reminder', false) })) };
}

const done = (v) => {
  need(typeof v.since === 'string' && DAY.test(v.since), 'done.since must be YYYY-MM-DD.');
  return {
    since: v.since,
    items: list(v.items, 'done.items', MOST.done).map((i) => {
      need(typeof i?.day === 'string' && DAY.test(i.day), 'A done day must be YYYY-MM-DD.');
      need(i.kind === 'commit' || i.kind === 'todo', 'A done kind must be commit or todo.');
      return { day: i.day, at: time(i.at, 'A done time'), project: text(i.project, 'A project', false), kind: i.kind, text: text(i.text, 'A done text') };
    }),
  };
};

/**
 * A push as the laptop sends it, checked and rebuilt from the known fields only, with when it was made in
 * milliseconds (only a newer snapshot replaces the kept one).
 * @param {string} raw the request's body @param {number} now the Worker's time, in milliseconds
 * @returns {{ snapshot: object, madeAt: number } | { error: string, status: number }}
 */
export function readDashboard(raw, now = Date.now()) {
  if (raw.length > LONGEST_PUSH) return { error: `A snapshot can be up to ${LONGEST_PUSH} characters.`, status: 413 };
  let body;
  try { body = JSON.parse(raw); } catch { return { error: 'The snapshot is not JSON.', status: 400 }; }
  try {
    need(isObject(body) && body.version === 1, 'version must be 1.');
    const madeAt = Date.parse(time(body.made_at, 'made_at'));
    need(madeAt <= now + CLOCK_SLACK_MS, "made_at is ahead of the Worker's clock.");
    const snapshot = {
      version: 1,
      made_at: body.made_at,
      sideload: part(body.sideload, 'sideload', sideload),
      deploys: part(body.deploys, 'deploys', deploys),
      backup: part(body.backup, 'backup', backup),
      repos: part(body.repos, 'repos', repos),
      done: part(body.done, 'done', done),
      ...reminders(body.reminders),
    };
    return { snapshot, madeAt };
  } catch (error) {
    if (error instanceof Bad) return { error: error.message, status: 400 };
    // A field of the wrong kind deep inside (a run that isn't an object) fails the same way.
    if (error instanceof TypeError) return { error: "The snapshot doesn't look right.", status: 400 };
    throw error;
  }
}

/**
 * The laptop's push, with its own token (DASHBOARD_PUSH_TOKEN). A browser never gets this far: any request with an
 * Origin is turned away, and PUT isn't in the preflight's methods.
 * @param {Request} request @param {any} env @param {Record<string, string>} headers @param {number} [now]
 */
export async function dashboardPush(request, env, headers, now = Date.now()) {
  if (request.headers.get('Origin')) return json({ error: 'Not allowed.' }, 403, headers);
  if (!(await rightPassword(request.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''), env.DASHBOARD_PUSH_TOKEN))) return json({ error: 'Wrong token.' }, 401, headers);
  const read = readDashboard(await request.text(), now);
  if ('error' in read) return json({ error: read.error }, read.status, headers);
  // Only a newer snapshot replaces the kept one, so two pushes arriving out of order never bring back the older.
  const { meta } = await env.DB.prepare('INSERT INTO dashboard (id, snapshot, made_at) VALUES (1, ?, ?) ON CONFLICT (id) DO UPDATE SET snapshot = excluded.snapshot, made_at = excluded.made_at WHERE excluded.made_at > dashboard.made_at')
    .bind(JSON.stringify(read.snapshot), read.madeAt)
    .run();
  return json({ kept: meta.changes > 0 }, 200, headers);
}

/** The latest snapshot, for a browser that has logged in; null before the first push. @param {any} env @param {Record<string, string>} headers */
export async function dashboardRead(env, headers) {
  const row = await env.DB.prepare('SELECT snapshot FROM dashboard WHERE id = 1').first();
  return json({ snapshot: row ? JSON.parse(String(row.snapshot)) : null }, 200, headers);
}
