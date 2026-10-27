import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { groupLabel, groupsOf, missingFiles, momentLabel, paragraphs, photoPath, srcsetOf, storyFiles, tripDays } from '../src/lib/travel/story.js';
import { photoFor, stepTo, stopAt, stopsOf } from '../src/lib/travel/story-scroll.js';

const story = { folder: 'yunnan-2026', moments: [{ id: 'img_6050' }, { id: 'img_6061' }] };

test('the largest photo sits on top of its folder, the smaller two in their own', () => {
  assert.equal(photoPath('yunnan-2026', 'img_6050', 2048), 'yunnan-2026/img_6050.webp');
  assert.equal(photoPath('yunnan-2026', 'img_6050', 640), 'yunnan-2026/smaller/img_6050_640.webp');
  assert.equal(srcsetOf('/media/', 'yunnan-2026', 'img_6050'),
    '/media/yunnan-2026/smaller/img_6050_640.webp 640w, /media/yunnan-2026/smaller/img_6050_1280.webp 1280w, /media/yunnan-2026/img_6050.webp 2048w');
  assert.equal(storyFiles(story).length, 6);
});

test('a clip needs its video and its cover, in the trip\'s videos folder', () => {
  const told = { folder: 'yunnan-2026', moments: [{ id: 'img_6050' }, { id: 'img_6051', kind: 'video' }] };
  assert.deepEqual(storyFiles(told).slice(3), ['yunnan-2026/videos/img_6051.mp4', 'yunnan-2026/videos/img_6051.webp']);
});

test("a trip runs from its first photo's day to its last's, in the place's own time, skipping photos with no time", () => {
  const taken = (t) => ({ taken: t });
  assert.deepEqual(tripDays([taken('2026-10-15T08:37:13+08:00'), taken(null), taken('2026-10-14T14:58:20+08:00'), taken('2026-10-20T23:59:00+08:00')]), { from: '2026-10-14', to: '2026-10-20' });
  assert.equal(tripDays([taken(null)]), null);
});

test('joined moments make a group with the one before', () => {
  assert.deepEqual(groupsOf([{}, { joined: true }, { joined: true }, {}, { joined: true }]), [{ first: 0, count: 3 }, { first: 3, count: 2 }]);
  assert.deepEqual(groupsOf([{ joined: true }, {}]), [{ first: 0, count: 1 }, { first: 1, count: 1 }], 'the first moment has nothing to join');
  assert.equal(groupLabel('2026-10-19T10:26:00+08:00', '2026-10-19T12:48:00+08:00'), '19 Oct · 10:26 – 12:48');
  assert.equal(groupLabel('2026-10-19T23:50:00+08:00', '2026-10-20T00:10:00+08:00'), '19 Oct · 23:50 – 20 Oct · 00:10');
  assert.equal(groupLabel('2026-10-19T10:26:00+08:00', null), '19 Oct · 10:26');
});

test('a story stops once per photo, the opening and closing words at its ends', () => {
  const groups = [{ first: 0, count: 1 }, { first: 1, count: 3 }];
  assert.deepEqual(stopsOf(groups).map((s) => [s.photo, s.say, s.place]), [[0, 0, 0], [1, 1, 0], [2, 1, 1], [3, 1, 2]]);
  const ends = stopsOf(groups, { intro: 0, outro: 3 });
  assert.deepEqual(ends.map((s) => [s.photo, s.say]), [[0, 'intro'], [0, 0], [1, 1], [2, 1], [3, 1], [3, 'outro']]);
  assert.deepEqual(stopsOf(groups, { intro: 2 })[0], { photo: 2, say: 'intro', place: 0 }, 'a photo Jack picked for the opening');
  assert.deepEqual(stopsOf([], { intro: 0, outro: 0 }), [], 'no photos, no stops');
  assert.deepEqual(stopsOf([{ first: 0, count: 2, after: true }, { first: 2, count: 1 }]).map((s) => [s.photo, s.say]),
    [[0, 0], [1, 0], [1, 'after-0'], [2, 1]], 'words on their own after a group, over its last photo');
  const moments = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(photoFor(moments, 'b', 0), 1);
  assert.equal(photoFor(moments, undefined, 2), 2, 'none picked: the default');
  assert.equal(photoFor(moments, 'gone', 0), 0, 'a photo no longer in the story: the default');
});

test('a story\'s song is one of its files', () => {
  const told = { folder: 'yunnan-2026', moments: [{ id: 'img_6050' }], music: { file: 'music/song.mp3' } };
  assert.equal(storyFiles(told).at(-1), 'yunnan-2026/music/song.mp3');
});

test('words become paragraphs, one per line', () => {
  assert.deepEqual(paragraphs('第一天。\n\n  第二段  \r\n'), ['第一天。', '第二段']);
  assert.deepEqual(paragraphs(''), []);
});

test('a moment shows the time the camera wrote, without moving it to Malaysia time', () => {
  assert.equal(momentLabel('2026-10-14T14:58:20+08:00'), '14 Oct · 14:58');
  assert.equal(momentLabel('2026-03-02T09:05:00'), '2 Mar · 09:05');
  assert.equal(momentLabel(null), '');
});

test('missing photos are found in the local media folder, else on the live site', async () => {
  const local = mkdtempSync(join(tmpdir(), 'media-'));
  mkdirSync(join(local, 'yunnan-2026', 'smaller'), { recursive: true });
  for (const file of storyFiles(story).slice(0, 5)) writeFileSync(join(local, file), 'x');
  assert.deepEqual(await missingFiles(story, { local, live: 'https://example.test/media/' }), ['yunnan-2026/img_6061.webp']);
  const asked = [];
  const fetch = async (url) => { asked.push(url); return { ok: !url.includes('img_6061_640') }; };
  assert.deepEqual(await missingFiles(story, { local: join(local, 'nowhere'), live: 'https://example.test/media/', fetch }), ['yunnan-2026/smaller/img_6061_640.webp']);
  assert.equal(asked.length, 7, 'six asked, and the missing one asked again');
});

test('a photo that drops its answer once is asked again, not counted missing', async () => {
  let tries = 0;
  const flaky = async (url) => (url.includes('img_6050_640') && tries++ === 0 ? Promise.reject(new Error('dropped')) : { ok: true });
  assert.deepEqual(await missingFiles(story, { local: join(tmpdir(), 'nowhere-at-all'), live: 'https://example.test/media/', fetch: flaky }), []);
  assert.equal(tries, 2);
});

test('each scroll goes one stop, and past the ends the page scrolls on', () => {
  assert.equal(stepTo(0, 5, 1), 1);
  assert.equal(stepTo(2, 5, -1), 1);
  assert.equal(stepTo(4, 5, 1), null, 'past the last stop');
  assert.equal(stepTo(0, 5, -1), null, 'back above the first');
  assert.equal(stepTo(-0.3, 5, 1), 0, 'coming in from above');
  assert.equal(stepTo(4.3, 5, -1), 4, 'coming back in from below');
  assert.equal(stepTo(-0.3, 5, -1), null, 'leaving upwards');
  assert.equal(stepTo(4.3, 5, 1), null, 'leaving downwards');
  assert.equal(stepTo(-0.8, 5, 1), null, 'the story less than half on screen');
  assert.equal(stepTo(2.3, 5, 1), 3, 'between stops, down settles on the next');
  assert.equal(stepTo(2.3, 5, -1), 2, 'and up on the one before');
  assert.equal(stepTo(2.7, 5, -1), 2);
  assert.equal(stepTo(0, 0, 1), null);
  assert.equal(stopAt(-0.4, 5), 0);
  assert.equal(stopAt(2.6, 5), 3);
  assert.equal(stopAt(9, 5), 4);
});
