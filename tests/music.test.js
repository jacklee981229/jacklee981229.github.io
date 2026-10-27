import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_VOLUME, RESUME_WITHIN, SONG_COLOURS, back, barHeights, clock, levelAt, resume, songAfter, songColour, volumeFrom } from '../src/lib/music.js';

const songs = JSON.parse(readFileSync(new URL('../src/lib/music-songs.json', import.meta.url), 'utf8'));

test('times read m:ss, rounded down, never negative', () => {
  assert.equal(clock(0), '0:00');
  assert.equal(clock(59.9), '0:59');
  assert.equal(clock(60), '1:00');
  assert.equal(clock(125.4), '2:05');
  assert.equal(clock(-3), '0:00');
  assert.equal(clock(NaN), '0:00');
  assert.equal(clock(Infinity), '0:00');
});

test('songs take the colours in turn, round again after the last', () => {
  assert.equal(songColour(0), 'var(--music-1)');
  assert.equal(songColour(SONG_COLOURS - 1), `var(--music-${SONG_COLOURS})`);
  assert.equal(songColour(SONG_COLOURS), 'var(--music-1)');
  const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  for (let n = 1; n <= SONG_COLOURS; n++) assert.match(tokens, new RegExp(`--music-${n}:`));
  assert.doesNotMatch(tokens, new RegExp(`--music-${SONG_COLOURS + 1}:`));
});

test('next and previous go round the list', () => {
  assert.equal(songAfter(7, 8), 0);
  assert.equal(songAfter(0, 8, -1), 7);
  assert.equal(songAfter(3, 8), 4);
});

test('previous starts the song again once it has played a few seconds', () => {
  assert.equal(back(2, 8, 5), 2);
  assert.equal(back(2, 8, 2), 1);
  assert.equal(back(0, 8, 0), 7);
});

test('a page plays on only when the last was playing, moments ago, and this page is on screen', () => {
  const now = 1_000_000;
  const saved = { index: 3, time: 42.5, playing: true, at: now - 1500 };
  assert.deepEqual(resume(saved, 8, now, true), { index: 3, time: 42.5, play: true });
  assert.equal(resume(saved, 8, now, false).play, false, 'a tab opened behind');
  assert.equal(resume({ ...saved, playing: false }, 8, now, true).play, false);
  assert.equal(resume({ ...saved, at: now - RESUME_WITHIN }, 8, now, true).play, false, 'left long ago');
  assert.equal(resume({ ...saved, at: now + 5000 }, 8, now, true).play, false, 'a clock that moved back');
  assert.equal(resume({ ...saved, at: undefined }, 8, now, true).play, false);
});

test('not playing on, it still waits at the same song and second', () => {
  assert.deepEqual(resume({ index: 5, time: 80, playing: false, at: 0 }, 8, 1e9, true), { index: 5, time: 80, play: false });
});

test('anything else saved starts fresh, or at the song\'s start', () => {
  const fresh = { index: 0, time: 0, play: false };
  assert.deepEqual(resume(null, 8, 0, true), fresh);
  assert.deepEqual(resume('3', 8, 0, true), fresh);
  assert.deepEqual(resume({ index: 8, time: 1, playing: true, at: 0 }, 8, 0, true), fresh, 'a song no longer there');
  assert.deepEqual(resume({ index: 1.5 }, 8, 0, true), fresh);
  assert.equal(resume({ index: 2, time: -4 }, 8, 0, true).time, 0);
  assert.equal(resume({ index: 2, time: 'x' }, 8, 0, true).time, 0);
});

test('a saved volume is kept between 0 and 1; none or junk is the default', () => {
  assert.equal(volumeFrom('0.25'), 0.25);
  assert.equal(volumeFrom('0'), 0);
  assert.equal(volumeFrom('3'), 1);
  assert.equal(volumeFrom('-1'), 0);
  assert.equal(volumeFrom(null), DEFAULT_VOLUME);
  assert.equal(volumeFrom(''), DEFAULT_VOLUME);
  assert.equal(volumeFrom('loud'), DEFAULT_VOLUME);
});

test('loudness reads a tenth of a second per character, held at the ends', () => {
  assert.equal(levelAt('0z', 0), 0);
  assert.equal(levelAt('0z', 0.15), 1);
  assert.equal(levelAt('0z', 99), 1);
  assert.equal(levelAt('0z', -1), 0);
  assert.equal(levelAt('', 1), 0);
});

test('the closed button\'s bars stay between 0.35 and 1', () => {
  for (const level of ['0000000000000000', 'zzzzzzzzzzzzzzzz', songs[0].level]) {
    for (const t of [0, 1.3, 60, 1e4]) {
      for (const h of barHeights(level, t)) assert.ok(h >= 0.35 && h <= 1, `${h} at ${t}`);
    }
  }
});

test('every song has its file in music/, credits, a length, 64 bars and its loudness throughout', () => {
  assert.ok(songs.length > 0);
  for (const song of songs) {
    assert.match(song.file, /^music\/[a-z0-9-]+\.m4a$/);
    assert.ok(song.title && song.artist);
    assert.match(song.url, /^https:\/\//);
    assert.ok(song.duration > 10);
    assert.equal(song.bars.length, 64);
    assert.ok(song.bars.every((b) => b >= 0 && b <= 1));
    assert.ok(Math.abs(song.level.length - song.duration * 10) <= 2, song.title);
    assert.ok([...song.level].every((c) => c >= '0' && c <= 'z'));
  }
});
