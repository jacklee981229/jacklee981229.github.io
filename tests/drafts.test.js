import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextAddress, pictureName, pictureNames, postFile, problems, readTags } from '../src/lib/drafts.js';

const draft = (extra = {}) => ({ title: 'Token week', topic: 'ai', tags: 'ai, claude code', body: 'Hello\n\n![chart](./chart.png)', ...extra });

test('tags come from a comma list, lowercased, without repeats or blanks', () => {
  assert.deepEqual(readTags(' AI,  Claude   Code ,,ai '), ['ai', 'claude code']);
  assert.deepEqual(readTags(''), []);
});

test('the pictures a text shows are only its own (./name)', () => {
  assert.deepEqual(pictureNames('![a](./one.png) ![b](https://x.io/two.png) ![](./three-3.webp) ![c](./four.png "A title")'), ['one.png', 'three-3.webp', 'four.png']);
});

test('a picture keeps a safe name, its ending, and a number when taken', () => {
  assert.equal(pictureName('My Chart (1).PNG', []), 'my-chart-1.png');
  assert.equal(pictureName('chart.png', ['chart.png', 'chart-2.png']), 'chart-3.png');
  assert.equal(pictureName('图.jpg', []), 'picture.jpg');
  assert.equal(pictureName('notes.txt', []), null);
  assert.equal(pictureName('noending', []), null);
});

test('a ready draft has no problems', () => {
  assert.deepEqual(problems(draft(), ['chart.png']), []);
});

test('each thing missing is named', () => {
  const found = problems(draft({ title: ' ', topic: 'nope', tags: 'Good, b@d', body: '![x](./gone.png)' }), []);
  assert.equal(found.length, 4);
  assert.match(found[0], /title/);
  assert.match(found[1], /topic/);
  assert.match(found[2], /b@d/);
  assert.match(found[3], /gone\.png/);
  assert.match(problems(draft({ body: '  ' }), [])[0], /Write something/);
});

test('the next address is the first free number, whatever the named folders', () => {
  assert.equal(nextAddress(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '2048', 'c1', 'yunnan-2026']), '12');
  assert.equal(nextAddress(['1', '3', 'c2']), '2');
  assert.equal(nextAddress([]), '1');
});

test('index.md comes out like npm run new writes it, published', () => {
  const file = postFile(draft({ title: '  上个礼拜 "token"  ', body: 'Line one\r\nLine two\n\n' }), new Date('2026-11-02T02:05:09Z'));
  assert.equal(file, [
    '---',
    'title: "上个礼拜 \\"token\\""',
    'date: 2026-11-02T10:05:09+08:00',
    'topic: ai',
    'tags: ["ai","claude code"]',
    '---',
    '',
    'Line one\nLine two',
    '',
  ].join('\n'));
});
