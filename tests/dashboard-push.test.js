// Jack's dashboard as the Now editor takes a push from his laptop (workers/now/dashboard.js). Test snapshots only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOCK_SLACK_MS, LONGEST_PUSH, dashboardPush, readDashboard } from '../workers/now/dashboard.js';

const NOW = Date.parse('2026-11-07T16:00:00+08:00');
const TOKEN = 'test-dashboard-token';
const good = {
  version: 1,
  made_at: '2026-11-07T15:59:00+08:00',
  sideload: { apps: [{ app: 'Expenses', signed_at: '2026-11-07T15:01:47+08:00', runs_out_at: '2026-11-14T15:01:47+08:00', failures: 0, last_error: '', last_failure_at: null, waiting_build_at: null }] },
  deploys: { runs: [{ repo: 'test-site', workflow: 'Test deploy', state: 'success', at: '2026-11-07T08:07:58+08:00', url: 'https://github.com/test/test/actions/runs/1' }] },
  backup: { error: "Can't read the KB backup log: test" },
  repos: { repos: [{ name: 'test-site', uncommitted: 2, unpushed: 0 }] },
  done: { since: '2026-10-26', items: [{ day: '2026-11-07', at: '2026-11-07T15:00:00+08:00', project: 'test-site', kind: 'commit', text: ' Test - a commit ' }] },
};
const raw = (over = {}) => JSON.stringify({ ...good, ...over });

/** A D1 stand-in that keeps the one row as the real upsert would. */
function fakeDb() {
  const db = { row: null };
  db.prepare = (sql) => ({
    bind: (snapshot, madeAt) => ({
      run: async () => {
        assert.match(sql, /WHERE excluded\.made_at > dashboard\.made_at/);
        const kept = !db.row || madeAt > db.row.madeAt;
        if (kept) db.row = { snapshot, madeAt };
        return { meta: { changes: kept ? 1 : 0 } };
      },
    }),
  });
  return db;
}
const put = (body, headers = {}) => new Request('https://now.test/api/dashboard', { method: 'PUT', headers, body });
const push = async (request, db = fakeDb()) => {
  const answer = await dashboardPush(request, { DB: db, DASHBOARD_PUSH_TOKEN: TOKEN }, {}, NOW);
  return { status: answer.status, data: await answer.json(), db };
};

test('a good push is kept, its words trimmed and an unreadable part kept as its error', async () => {
  const { status, data, db } = await push(put(raw(), { Authorization: `Bearer ${TOKEN}` }));
  assert.equal(status, 200);
  assert.deepEqual(data, { kept: true });
  const kept = JSON.parse(db.row.snapshot);
  assert.equal(kept.done.items[0].text, 'Test - a commit');
  assert.deepEqual(kept.backup, { error: "Can't read the KB backup log: test" });
  assert.equal(db.row.madeAt, Date.parse(good.made_at));
});

test('only a newer snapshot replaces the kept one', async () => {
  const db = fakeDb();
  const auth = { Authorization: `Bearer ${TOKEN}` };
  await push(put(raw(), auth), db);
  assert.deepEqual((await push(put(raw({ made_at: '2026-11-07T15:44:00+08:00' }), auth), db)).data, { kept: false });
  assert.deepEqual((await push(put(raw({ made_at: '2026-11-07T16:01:00+08:00' }), auth), db)).data, { kept: true });
});

test('no token or a wrong one is refused, and nothing is kept', async () => {
  for (const headers of [{}, { Authorization: 'Bearer ' }, { Authorization: 'Bearer wrong-token' }, { Authorization: TOKEN.slice(1) }]) {
    const { status, db } = await push(put(raw(), headers));
    assert.equal(status, 401, JSON.stringify(headers));
    assert.equal(db.row, null);
  }
});

test('a browser is refused even with the right token', async () => {
  const { status, db } = await push(put(raw(), { Authorization: `Bearer ${TOKEN}`, Origin: 'http://localhost:4321' }));
  assert.equal(status, 403);
  assert.equal(db.row, null);
});

test('a push over the limit is refused as too big', async () => {
  const big = raw({ done: { since: '2026-10-26', items: [{ ...good.done.items[0], text: 'x'.repeat(LONGEST_PUSH) }] } });
  const { status, db } = await push(put(big, { Authorization: `Bearer ${TOKEN}` }));
  assert.equal(status, 413);
  assert.equal(db.row, null);
});

test('a snapshot that does not look right is refused', () => {
  const app = good.sideload.apps[0];
  const run = good.deploys.runs[0];
  const item = good.done.items[0];
  for (const over of [
    { version: 2 },
    { made_at: '2026-11-07 15:59' },
    { made_at: '2026-11-07T15:59:00' },
    { sideload: undefined },
    { sideload: { apps: 'none' } },
    { sideload: { apps: [{ ...app, runs_out_at: 'soon' }] } },
    { sideload: { apps: [{ ...app, failures: -1 }] } },
    { sideload: { apps: [null] } },
    { deploys: { runs: [{ ...run, state: 'passed' }] } },
    { deploys: { runs: [{ ...run, url: 'javascript:alert(1)' }] } },
    { deploys: { runs: [{ ...run, url: 'https://github.com.evil.test/x' }] } },
    { backup: { error: '  ' } },
    { backup: { last_success_at: 5, last_error: '', last_error_at: null } },
    { repos: { repos: [{ name: 'test-site', uncommitted: 1.5, unpushed: 0 }] } },
    { done: { since: '2026-10-26', items: [{ ...item, kind: 'push' }] } },
    { done: { since: 'last week', items: [] } },
  ]) {
    assert.ok('error' in readDashboard(raw(over), NOW), JSON.stringify(over));
  }
  assert.ok('error' in readDashboard('not json', NOW));
  assert.ok('error' in readDashboard('[]', NOW));
});

test('a snapshot dated ahead of the clock is refused, within the slack it is kept', () => {
  const at = (ms) => new Date(ms).toISOString();
  assert.ok('error' in readDashboard(raw({ made_at: at(NOW + CLOCK_SLACK_MS + 1000) }), NOW));
  assert.ok('snapshot' in readDashboard(raw({ made_at: at(NOW + CLOCK_SLACK_MS) }), NOW));
});

test('only the known fields are kept', () => {
  const { snapshot } = readDashboard(raw({ extra: 'x', repos: { repos: [{ name: 'test-site', uncommitted: 0, unpushed: 1, secret: 'x' }] } }), NOW);
  assert.equal('extra' in snapshot, false);
  assert.deepEqual(snapshot.repos.repos[0], { name: 'test-site', uncommitted: 0, unpushed: 1 });
});
