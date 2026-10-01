import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countedPath, mostPopular, pageVisits, parseCount } from '../src/lib/lab/popular.js';

const BASE = 'https://example.goatcounter.com';
// A stand-in for GoatCounter: answers each counter address from `pages` ({ path: status or count text }).
const counter = (pages, asked = []) => async (url) => {
  asked.push(url);
  const path = decodeURIComponent(url.slice(`${BASE}/counter/`.length, -'.json'.length));
  const answer = pages[path];
  if (answer === undefined) return { status: 404, ok: false };
  if (typeof answer === 'number') return { status: answer, ok: false };
  return { status: 200, ok: true, json: async () => ({ count: answer }) };
};
const items = (...paths) => paths.map((path) => ({ path }));

test("GoatCounter's formatted counts become numbers", () => {
  assert.equal(parseCount('7'), 7);
  assert.equal(parseCount('1,234'), 1234);
  assert.equal(parseCount('12 345'), 12345);
  assert.equal(parseCount('1\u{202f}234'), 1234);
  assert.equal(parseCount(''), 0);
});

test('a page is asked for the way GoatCounter keeps it: no slash at the end', () => {
  assert.equal(countedPath('/lab/count-words/'), '/lab/count-words');
  assert.equal(countedPath('/lab/game/2048/'), '/lab/game/2048');
  assert.equal(countedPath('/'), '/');
});

test('visits come from the public counter; a page nobody visited counts as 0', async () => {
  const asked = [];
  const visits = await pageVisits(['/lab/count-words/', '/lab/game/2048/'], BASE, counter({ '/lab/count-words': '1,204' }, asked));
  assert.deepEqual([...visits], [['/lab/count-words/', 1204], ['/lab/game/2048/', 0]]);
  assert.deepEqual(asked, [`${BASE}/counter/%2Flab%2Fcount-words.json`, `${BASE}/counter/%2Flab%2Fgame%2F2048.json`]);
});

test('no ranking when the counter is switched off or out of reach', async () => {
  assert.equal(await pageVisits(['/lab/a/', '/lab/b/'], BASE, counter({ '/lab/a': '5', '/lab/b': 403 })), null);
  assert.equal(await pageVisits(['/lab/a/'], BASE, async () => { throw new Error('offline'); }), null);
  assert.deepEqual(mostPopular(items('/a/', '/b/', '/c/', '/d/'), null), []);
});

test('the four most visited, most visited first, ties in the Lab\'s own order', () => {
  const lab = items('/a/', '/b/', '/c/', '/d/', '/e/', '/f/');
  const visits = new Map([['/a/', 3], ['/b/', 9], ['/c/', 3], ['/d/', 0], ['/e/', 12], ['/f/', 1]]);
  assert.deepEqual(mostPopular(lab, visits).map((i) => i.path), ['/e/', '/b/', '/a/', '/c/']);
  assert.deepEqual(mostPopular(lab, visits, 2).map((i) => i.path), ['/e/', '/b/']);
});

test('nothing until four items have been visited at all', () => {
  const lab = items('/a/', '/b/', '/c/', '/d/', '/e/');
  assert.deepEqual(mostPopular(lab, new Map([['/a/', 5], ['/b/', 2], ['/c/', 1]])), []);
  assert.equal(mostPopular(lab, new Map([['/a/', 5], ['/b/', 2], ['/c/', 1], ['/e/', 1]])).length, 4);
});
