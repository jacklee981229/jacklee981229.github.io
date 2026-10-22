import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLACES, byPlace, found, marked, searchText } from '../src/lib/toolbox.js';

const groups = [
  { name: 'Find files', tools: [{ name: 'Everything', where: 'windows', note: 'instant file search' }] },
  { name: 'Video & music', tools: [{ name: 'yoinks', where: 'terminal', note: 'download a video' }, { name: 'OBS Studio', where: 'windows', note: '录屏软件' }] },
  { name: 'Pictures', tools: [{ name: 'Squoosh', where: 'website', note: '图片压缩' }] },
];

test('the Where view keeps the places in their order, each tool in the order listed, and skips empty places', () => {
  const view = byPlace(groups);
  assert.deepEqual(view.map((g) => g.place), ['windows', 'terminal', 'website']);
  assert.deepEqual(view[0].tools.map((t) => t.name), ['Everything', 'OBS Studio']);
  assert.equal(view[0].tools[1].group, 'Video & music');
  assert.equal(view.flatMap((g) => g.tools).length, 4);
  assert.deepEqual(PLACES.map((p) => p.id), ['windows', 'terminal', 'chrome', 'website']);
});

test('a tool is found by its name, note, place or group, in any case, Chinese too', () => {
  const text = searchText({ name: 'OBS Studio', where: 'windows', note: '录屏软件' }, 'Video & music');
  for (const q of ['obs', 'OBS', '录屏', 'windows', 'video', '  studio  ', '']) assert.ok(found(text, q), q);
  for (const q of ['pdf', 'chrome', 'obsx']) assert.ok(!found(text, q), q);
});

test('marking shows every match and escapes the rest', () => {
  assert.equal(marked('长截图插件', '截图'), '长<mark>截图</mark>插件');
  assert.equal(marked('Video video', 'VIDEO'), '<mark>Video</mark> <mark>video</mark>');
  assert.equal(marked('a <b> & "c"', ''), 'a &lt;b&gt; &amp; &quot;c&quot;');
  assert.equal(marked('<img onerror=x>', 'img'), '&lt;<mark>img</mark> onerror=x&gt;');
  assert.equal(marked('Copy', 'xyz'), 'Copy');
});
