import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { metaOf, missingPictures, picturesToMake, shareKey, shareLabel, sharePath, unescapeHtml } from '../src/lib/share.js';
import { paletteFor } from '../src/lib/share-image.js';

const SITE = 'https://example.github.io';
const page = (file, metas) => ({ file, html: `<html><head>${metas.map(([k, v]) => `<meta property="${k}" content="${v}">`).join('')}</head></html>` });

test("a page's picture is named after its address", () => {
  assert.equal(shareKey('/'), 'index');
  assert.equal(shareKey('/lab/count-words/'), 'lab/count-words');
  assert.equal(shareKey('/404'), '404');
  assert.equal(sharePath('/tags/hexo/'), '/og/tags/hexo.png');
});

test('the label says which part of the site a page is in', () => {
  const cases = { '/': 'Home', '/lab/': 'Lab', '/lab/json-preview/': 'Lab · Tool', '/lab/effects/': 'Lab · Effects', '/lab/world/town/': 'Lab · Little World', '/lab/game/snake/': 'Lab · Game', '/random/': 'Lab · Random', '/writing/': 'Writing', '/tags/git/': 'Writing · Tag', '/collections/': 'Collection', '/travel/': 'Travel', '/about/': 'About', '/now/': 'Now', '/changelog/': 'Changelog', '/404': 'Not found' };
  for (const [path, label] of Object.entries(cases)) assert.equal(shareLabel(path), label, path);
  assert.equal(shareLabel('/g1/', 'Git'), 'Writing · Git');
});

test('meta tags are read by property or name, their text unescaped', () => {
  const html = `<meta property="og:title" content="Jack&#39;s Lab &amp; more"><meta name="share:label" content="Lab · Tool">`;
  assert.equal(metaOf(html, 'og:title'), "Jack's Lab & more");
  assert.equal(metaOf(html, 'share:label'), 'Lab · Tool');
  assert.equal(metaOf(html, 'og:description'), undefined);
  assert.equal(unescapeHtml('&quot;a&quot; &lt;b&gt; &#x27;c&#x27;'), `"a" <b> 'c'`);
});

test('pictures are made only for pages pointing at one under /og/; covers are left alone', () => {
  const pages = [
    page('lab/index.html', [['og:image', `${SITE}/og/lab.png`], ['og:title', "Jack's Lab"], ['og:description', 'Tiny things.'], ['share:label', 'Lab']]),
    page('g1/index.html', [['og:image', `${SITE}/_astro/cover.jpg`], ['og:title', 'Git']]),
  ];
  assert.deepEqual(picturesToMake(pages, SITE), [{ path: '/og/lab.png', title: "Jack's Lab", description: 'Tiny things.', label: 'Lab', accent: undefined }]);
});

test('every page needs its picture to be in the build; redirect pages are skipped', () => {
  const pages = [
    page('a/index.html', [['og:image', `${SITE}/og/a.png`]]),
    page('b/index.html', [['og:image', `${SITE}/og/b.png`]]),
    page('c/index.html', []),
    { file: 'old/index.html', html: '<meta http-equiv="refresh" content="0;url=/">' },
  ];
  assert.deepEqual(missingPictures(pages, SITE, (p) => p === '/og/a.png'), [`b/index.html (${SITE}/og/b.png)`, 'c/index.html (no og:image)']);
});

test("the pictures take the dark theme's colours from tokens.css", () => {
  const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  const dark = paletteFor(css);
  for (const name of ['paper', 'ink', 'muted', 'rule', 'focus', 'lane-games']) assert.match(dark[name], /^#[0-9A-F]{6}$/i, name);
});
