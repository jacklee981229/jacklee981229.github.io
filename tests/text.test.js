import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, excerpt, slugify } from '../src/lib/text.js';

test('excerpt strips code, images, markup and headings', () => {
  const md = [
    '# Terraria',
    '',
    '![cover](./terraria.png)',
    'For my **whole life** (25 years) I [played](https://example.com) games.',
    '',
    '```js',
    'const secret = 1;',
    '```',
    '- A <b>list</b> item',
  ].join('\n');
  assert.equal(excerpt(md), 'For my whole life (25 years) I played games. A list item');
});

test('excerpt cuts long text at a word boundary with an ellipsis', () => {
  const md = 'word '.repeat(60);
  const out = excerpt(md, 23);
  assert.equal(out, 'word word word word…');
});

test('slugify makes readable addresses and refuses empty ones', () => {
  assert.equal(slugify('Flutter Get Started!'), 'flutter-get-started');
  assert.equal(slugify('  Café & Git: part 2 '), 'cafe-git-part-2');
  assert.throws(() => slugify('测试'), /Can't make a web address/);
});

test('escapeXml escapes the five XML characters', () => {
  assert.equal(escapeXml(`Tom & "Jerry" <b>'s</b>`), 'Tom &amp; &quot;Jerry&quot; &lt;b&gt;&apos;s&lt;/b&gt;');
});
