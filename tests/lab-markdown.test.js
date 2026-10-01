import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toHtml } from '../src/lib/lab/markdown.js';

const html = (markdown) => toHtml(markdown).trim();

test('headings, paragraphs, bold and italic', () => {
  assert.equal(html('# Title'), '<h1>Title</h1>');
  assert.equal(html('### Smaller'), '<h3>Smaller</h3>');
  assert.equal(html('Some **bold** and _italic_ text.'), '<p>Some <strong>bold</strong> and <em>italic</em> text.</p>');
  assert.equal(html('one\n\ntwo'), '<p>one</p>\n<p>two</p>');
  assert.equal(html(''), '');
});

test('lists, numbered lists and quotes', () => {
  assert.equal(html('- a\n- b'), '<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
  assert.equal(html('1. a\n2. b'), '<ol>\n<li>a</li>\n<li>b</li>\n</ol>');
  assert.equal(html('> said'), '<blockquote>\n<p>said</p>\n</blockquote>');
});

test('links and pictures', () => {
  assert.equal(html('[Jack](https://example.com "home")'), '<p><a href="https://example.com" title="home">Jack</a></p>');
  assert.equal(html('![a cat](https://example.com/cat.png)'), '<p><img src="https://example.com/cat.png" alt="a cat" /></p>');
  // An address typed bare becomes a link (GitHub style).
  assert.equal(html('see https://example.com now'), '<p>see <a href="https://example.com">https://example.com</a> now</p>');
});

test('code keeps its characters as typed', () => {
  assert.equal(html('use `a < b`'), '<p>use <code>a &lt; b</code></p>');
  assert.equal(html('```js\nif (a < b) { go(); }\n```'), '<pre><code class="language-js">if (a &lt; b) { go(); }\n</code></pre>');
});

test('GitHub extras: tables, task lists and strikethrough', () => {
  const table = html('| Name | Score |\n| :-- | --: |\n| Jack | 2048 |');
  assert.match(table, /^<table>\n<thead>\n<tr>\n<th align="left">Name<\/th>\n<th align="right">Score<\/th>/);
  assert.match(table, /<td align="left">Jack<\/td>\n<td align="right">2048<\/td>/);
  assert.equal(html('- [x] done\n- [ ] todo'), '<ul>\n<li><input type="checkbox" disabled="" checked="" /> done</li>\n<li><input type="checkbox" disabled="" /> todo</li>\n</ul>');
  assert.equal(html('~~gone~~'), '<p><del>gone</del></p>');
});

test('HTML typed into the Markdown is shown as text, never run', () => {
  assert.equal(html('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(html('a <b onclick="x()">b</b> c'), '<p>a &lt;b onclick=&quot;x()&quot;&gt;b&lt;/b&gt; c</p>');
  assert.ok(!/<img[^>]+onerror/.test(html('<img src=x onerror=alert(1)>')));
});

test('a link or picture with an unsafe address loses the address', () => {
  assert.equal(html('[click](javascript:alert(1))'), '<p><a href="">click</a></p>');
  assert.equal(html('![x](javascript:alert(1))'), '<p><img src="" alt="x" /></p>');
});
