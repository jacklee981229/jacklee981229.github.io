import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyLink, crawl, partOfPage } from '../src/lib/site-check.js';

const ORIGIN = 'https://jacklee981229.github.io';

test('links sort into this site\'s pages and files, other sites, and ones not to follow', () => {
  const c = (href, from = '/4/') => classifyLink(href, from, ORIGIN);
  assert.deepEqual(c('/lab/'), { kind: 'page', key: '/lab/' });
  assert.deepEqual(c('/lab/effects/?e=dot-grid#top'), { kind: 'page', key: '/lab/effects/' });
  assert.deepEqual(c(`${ORIGIN}/11/`), { kind: 'page', key: '/11/' });
  // a relative link is read from the page it's on: the heart.js link that missed its leading slash
  assert.deepEqual(c('2023/03/03/heart-js/'), { kind: 'page', key: '/4/2023/03/03/heart-js/' });
  assert.deepEqual(c('/rss.xml'), { kind: 'file', key: '/rss.xml' });
  assert.deepEqual(c('/old.html'), { kind: 'page', key: '/old.html' });
  assert.deepEqual(c('https://hexo.io/docs/#setup'), { kind: 'outside', key: 'https://hexo.io/docs/' });
  assert.deepEqual(c('//example.com/x'), { kind: 'outside', key: 'https://example.com/x' });
  for (const href of ['#top', 'mailto:jack@example.com', 'tel:123', 'javascript:void(0)', '', '   ']) assert.equal(c(href).kind, 'skip', href);
});

test('each page goes with its menu part; posts with Writing, the frame pages with Home', () => {
  assert.equal(partOfPage('/'), 'home');
  assert.equal(partOfPage('/now/'), 'home');
  assert.equal(partOfPage('/lab/game/2048/'), 'lab');
  assert.equal(partOfPage('/tags/hexo/'), 'writing');
  assert.equal(partOfPage('/11/'), 'writing');
  assert.equal(partOfPage('/collections/'), 'collection');
  assert.equal(partOfPage('/travel/'), 'travel');
  assert.equal(partOfPage('/about/'), 'about');
});

/** A small site: each page's links, by path; anything missing answers 404. */
function fakeSite(pages, files = {}) {
  const asked = [];
  const ask = async (path, method) => {
    asked.push(`${method} ${path}`);
    if (path in pages) return { status: 200, ms: 5, html: method === 'GET' ? JSON.stringify(pages[path]) : null };
    if (path in files) return { status: files[path], ms: 3, html: null };
    return { status: 404, ms: 4, html: null };
  };
  const read = (html) => ({ title: 'T', links: JSON.parse(html).map((href) => ({ href, text: href })) });
  return { asked, ask, read };
}

test('the crawl reads every page once, in the order found, and never fetches another site', async () => {
  const site = fakeSite({
    '/': ['/a/', '/b/', 'https://x.com/', '/missing/', '/rss.xml', '#top', 'mailto:j@x.com', '/a/', '/'],
    '/a/': ['/', '/c/', 'https://x.com/'],
    '/b/': [],
    '/c/': ['/missing/'],
  }, { '/rss.xml': 200 });
  const pages = [];
  const result = await crawl({ origin: ORIGIN, ask: site.ask, read: site.read, onPage: (p) => pages.push(p) });
  assert.deepEqual(pages.map((p) => p.path), ['/', '/a/', '/b/', '/c/']);
  assert.deepEqual(result, { pages: 4, links: 11 });
  // every address asked once; the file with HEAD; nothing outside
  assert.deepEqual(site.asked.sort(), ['GET /', 'GET /a/', 'GET /b/', 'GET /c/', 'GET /missing/', 'HEAD /rss.xml'].sort());
  const home = pages[0].links;
  assert.deepEqual(home.map((l) => [l.key, l.route, l.repeat]), [
    ['/a/', 'fine', false], ['/b/', 'fine', false], ['https://x.com/', 'you', false], ['/missing/', 'broken', false],
    ['/rss.xml', 'fine', false], ['/a/', 'fine', true], ['/', 'fine', true],
  ]);
  assert.equal(home[3].status, 404);
  assert.deepEqual(pages[1].links.map((l) => [l.key, l.repeat]), [['/', true], ['/c/', false], ['https://x.com/', true]]);
  assert.deepEqual(pages[3].links.map((l) => [l.route, l.repeat]), [['broken', true]]);
});

test('a link nothing answers is broken; a page can be cut short, and the crawl stops when asked', async () => {
  const down = { ask: async (path) => (path === '/' ? { status: 200, ms: 1, html: '["/gone/"]' } : { status: 0, ms: 1, html: null }), read: (html) => ({ title: '', links: JSON.parse(html).map((href) => ({ href, text: '' })) }) };
  const pages = [];
  await crawl({ origin: ORIGIN, ...down, onPage: (p) => pages.push(p) });
  assert.deepEqual(pages[0].links.map((l) => l.route), ['broken']);

  const many = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`/${i}/`, [`/${i + 1}/`]]));
  many['/'] = ['/0/'];
  const capped = [];
  await crawl({ origin: ORIGIN, ...fakeSite(many), onPage: (p) => capped.push(p.path), max: 3 });
  assert.deepEqual(capped, ['/', '/0/', '/1/']);

  const stop = new AbortController();
  const stopped = [];
  await crawl({ origin: ORIGIN, ...fakeSite(many), onPage: (p) => { stopped.push(p.path); if (stopped.length === 2) stop.abort(); }, signal: stop.signal });
  assert.deepEqual(stopped, ['/', '/0/']);
});
