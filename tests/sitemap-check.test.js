import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressOf, compareSitemap, sitemapAddresses, sitemapProblem, staysOut } from '../src/lib/sitemap-check.js';

const SITE = 'https://example.github.io';
const sitemap = (...paths) => `<?xml version="1.0"?><urlset>${paths.map((p) => `<url><loc>${SITE}${p}</loc></url>`).join('')}</urlset>`;
const page = (file, head = '') => ({ file, html: `<html><head>${head}</head><body></body></html>` });

test('a built file is the page at its folder', () => {
  assert.equal(addressOf('index.html'), '/');
  assert.equal(addressOf('lab/index.html'), '/lab/');
  assert.equal(addressOf('lab\\game\\2048\\index.html'), '/lab/game/2048/');
});

test('redirects and noindex pages stay out; ordinary pages do not', () => {
  assert.equal(staysOut('<meta http-equiv="refresh" content="0;url=/archives/">'), true);
  assert.equal(staysOut('<meta name="robots" content="noindex">'), true);
  assert.equal(staysOut('<meta name="robots" content="noindex, nofollow">'), true);
  assert.equal(staysOut('<meta name="description" content="noindex is a word here">'), false);
  assert.equal(staysOut('<meta name="author" content="Jack">'), false);
});

test('sitemap addresses lose the site part, and the home page is "/"', () => {
  assert.deepEqual(sitemapAddresses(sitemap('/', '/lab/'), SITE), ['/', '/lab/']);
  assert.deepEqual(sitemapAddresses(sitemap('/', '/lab/'), `${SITE}/`), ['/', '/lab/']);
});

test('the same pages both ways is no problem', () => {
  const result = compareSitemap([page('index.html'), page('lab/index.html'), page('404.html')], sitemap('/', '/lab/'), SITE);
  assert.deepEqual(result, { unlisted: [], missing: [] });
  assert.equal(sitemapProblem(result), '');
});

test('a built page missing from the sitemap is named', () => {
  const result = compareSitemap([page('index.html'), page('lab/game/2048/index.html')], sitemap('/'), SITE);
  assert.deepEqual(result.unlisted, ['/lab/game/2048/']);
  assert.match(sitemapProblem(result), /Built but not in the sitemap.*\/lab\/game\/2048\//);
});

test('a listed page that was never built is named', () => {
  const result = compareSitemap([page('index.html')], sitemap('/', '/now/'), SITE);
  assert.deepEqual(result.missing, ['/now/']);
  assert.match(sitemapProblem(result), /In the sitemap but not built.*\/now\//);
});

test('redirects, noindex pages and 404 are not asked for, and listing one is a mistake', () => {
  const pages = [page('index.html'), page('tags/index.html', '<meta http-equiv="refresh" content="0;url=/">'), page('random/index.html', '<meta name="robots" content="noindex">'), page('404.html')];
  assert.deepEqual(compareSitemap(pages, sitemap('/'), SITE), { unlisted: [], missing: [] });
  assert.deepEqual(compareSitemap(pages, sitemap('/', '/random/'), SITE).missing, ['/random/']);
});
