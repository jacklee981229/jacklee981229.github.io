import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOST_STARS, PICTURE_TYPES, cardColours, galleryOf, itemKey, pictureOf, starFills, starsLabel, stepsFrom, turnFrames, validStars, whiteContrast } from '../src/lib/shelves.js';
import { RESERVED_SLUGS } from '../src/lib/posts.js';

test("an item's name in links is its cover's file name, else its place in the list", () => {
  assert.equal(itemKey({ image: 'zhu-yu.jpg' }, 6), 'zhu-yu');
  assert.equal(itemKey({ image: 'the.last.of.us.webp' }, 0), 'the.last.of.us');
  assert.equal(itemKey({}, 2), '3');
});

test('stars go from 1 to 5, in halves', () => {
  for (const stars of [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]) assert.ok(validStars(stars), `${stars}`);
  for (const stars of [0, 0.5, 5.5, 6, 4.2, 4.25, -1, NaN, Infinity, '4', null, undefined]) assert.ok(!validStars(stars), `${stars}`);
});

test('each star is full, half or empty', () => {
  assert.equal(MOST_STARS, 5);
  assert.deepEqual(starFills(5), [1, 1, 1, 1, 1]);
  assert.deepEqual(starFills(3.5), [1, 1, 1, 0.5, 0]);
  assert.deepEqual(starFills(1), [1, 0, 0, 0, 0]);
  assert.deepEqual(starFills(1.5), [1, 0.5, 0, 0, 0]);
});

test('the stars are said in words', () => {
  assert.equal(starsLabel(4.5), '4.5 out of 5 stars');
  assert.equal(starsLabel(3), '3 out of 5 stars');
});

test("an item's picture is the file it names in its own collection's folder", () => {
  const pictures = { '/src/content/collections/movies/a.jpg': 'movies-a', '/src/content/collections/games/a.jpg': 'games-a', '/src/content/collections/games/B.PNG': 'games-b' };
  assert.equal(pictureOf(pictures, 'movies', { name: 'A', image: 'a.jpg' }), 'movies-a');
  assert.equal(pictureOf(pictures, 'games', { name: 'A', image: 'a.jpg' }), 'games-a');
  assert.equal(pictureOf(pictures, 'games', { name: 'B', image: 'B.PNG' }), 'games-b');
  assert.equal(pictureOf(pictures, 'movies', { name: 'No picture' }), undefined);
});

test('a picture that is not there, or of another type, is a plain message naming the item', () => {
  const pictures = { '/src/content/collections/movies/a.jpg': 'movies-a' };
  assert.throws(() => pictureOf(pictures, 'movies', { name: 'My Film', image: 'missing.jpg' }), /"My Film" in movies asks for the picture "missing\.jpg", but there is no file of that name in src\/content\/collections\/movies\//);
  // Capital letters count: the site is built on a machine that tells A.jpg from a.jpg.
  assert.throws(() => pictureOf(pictures, 'movies', { name: 'My Film', image: 'A.jpg' }), /no file of that name/);
  assert.throws(() => pictureOf(pictures, 'movies', { name: 'My Film', image: 'poster.gif' }), /only \.jpg, \.jpeg, \.png, \.webp pictures are taken/);
  assert.throws(() => pictureOf(pictures, 'movies', { name: 'My Film', image: 'poster' }), /only \.jpg/);
});

test("an item's gallery is its cover, then the pictures its gallery lists, in that order", () => {
  const pictures = { '/src/content/collections/movies/a.jpg': 'a', '/src/content/collections/movies/a-2.jpg': 'a2', '/src/content/collections/movies/a-3.webp': 'a3' };
  assert.deepEqual(galleryOf(pictures, 'movies', { name: 'A', image: 'a.jpg', gallery: ['a-3.webp', 'a-2.jpg'] }), ['a', 'a3', 'a2']);
  assert.deepEqual(galleryOf(pictures, 'movies', { name: 'A', image: 'a.jpg' }), ['a']);
  assert.deepEqual(galleryOf(pictures, 'movies', { name: 'No picture' }), []);
  // A gallery picture that isn't there stops the build like a missing cover.
  assert.throws(() => galleryOf(pictures, 'movies', { name: 'My Film', image: 'a.jpg', gallery: ['a-9.jpg'] }), /"My Film" in movies asks for the picture "a-9\.jpg", but there is no file of that name/);
});

test("the gallery's pictures step round: the middle one, one each side, the rest further round", () => {
  // Five pictures, the second in the middle: the first on its left, the third on its right.
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => stepsFrom(i, 1, 5)), [-1, 0, 1, 2, -2]);
  // From the last, the first comes next on the right, round the end.
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => stepsFrom(i, 4, 5)), [1, 2, -2, -1, 0]);
  // Two pictures: the other one is on the right. One picture: only the middle.
  assert.deepEqual([stepsFrom(1, 0, 2), stepsFrom(0, 1, 2)], [1, 1]);
  assert.equal(stepsFrom(0, 0, 1), 0);
});

test("the pictures are looked for in exactly the types a collection takes, in small letters and capitals", () => {
  const page = readFileSync(new URL('../src/lib/shelf-pictures.ts', import.meta.url), 'utf8');
  const looked = page.match(/collections\/\*\/\*\.\{([^}]+)\}/)?.[1].split(',');
  assert.deepEqual(looked, [...PICTURE_TYPES, ...PICTURE_TYPES.map((type) => type.toUpperCase())]);
});

/** A step of the turntable's turn as numbers: how far back it stands, and how far it has turned. */
const stepOf = (frame) => frame.transform.match(/^translateZ\((-?[\d.]+)px\) rotateY\((-?[\d.]+)deg\)$/).slice(1).map(Number);

test('the turntable makes half a turn: the front card ends up behind, the back one in front', () => {
  const frames = turnFrames(1, 300);
  // It starts and ends where its front card is flat on the page: as far back as the card stands forward.
  assert.deepEqual(stepOf(frames[0]), [-300, 0]);
  assert.deepEqual(stepOf(frames.at(-1)), [-300, -180]);
  // Clockwise seen from above is a negative turn in CSS, and it never turns back on the way.
  const turns = frames.map((frame) => stepOf(frame)[1]);
  for (let i = 1; i < turns.length; i++) assert.ok(turns[i] < turns[i - 1], `step ${i}`);
  // The other way round is the same turn mirrored.
  assert.deepEqual(turnFrames(-1, 300).map((frame) => stepOf(frame)[1]), turns.map((turn) => (turn === 0 ? 0 : -turn)));
});

test('the turntable starts and stops gently, and stands furthest back half-way round', () => {
  const steps = turnFrames(1, 300).map(stepOf);
  const middle = (steps.length - 1) / 2;
  assert.equal(steps[middle][1], -90);
  assert.ok(steps[middle][0] < -400, `${steps[middle][0]}`);
  for (const [back] of steps) assert.ok(back <= -300 && back >= steps[middle][0], `${back}`);
  // The first and last steps are far smaller than the ones in the middle.
  const size = (i) => Math.abs(steps[i][1] - steps[i - 1][1]);
  assert.ok(size(1) < size(middle) / 10 && size(steps.length - 1) < size(middle) / 10, `${size(1)} ${size(middle)}`);
});

test("the new pages' addresses are kept from posts", () => {
  assert.ok(RESERVED_SLUGS.includes('collections') && RESERVED_SLUGS.includes('travel'));
});

const fill = (rgb, n = 24) => Array.from({ length: n }, () => rgb).flat();
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hueOf = ([r, g, b]) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return undefined;
  const d = max - min;
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
};

test("a card takes its cover's colour, deep enough that white text keeps 5:1, darker at its foot", () => {
  for (const cover of [[220, 30, 40], [250, 230, 60], [40, 90, 230], [30, 200, 120], [255, 255, 255]]) {
    const { top, bottom } = cardColours(fill(cover));
    assert.match(top, /^#[0-9A-F]{6}$/);
    assert.match(bottom, /^#[0-9A-F]{6}$/);
    assert.ok(whiteContrast(rgbOf(top)) >= 5, `${cover} gives ${top}`);
    assert.ok(whiteContrast(rgbOf(bottom)) > whiteContrast(rgbOf(top)), `${cover}: ${bottom} is darker than ${top}`);
  }
  // A red cover stays red, a blue one blue.
  assert.ok(Math.abs(hueOf(rgbOf(cardColours(fill([220, 30, 40])).top)) - 356) < 8);
  assert.ok(Math.abs(hueOf(rgbOf(cardColours(fill([40, 90, 230])).top)) - 224) < 8);
});

test('the colourful part of a cover counts more than its dark or grey parts, and a grey cover stays grey', () => {
  // Mostly near-black with some strong blue: the card is blue.
  const poster = [...fill([12, 12, 14], 80), ...fill([30, 80, 220], 20)];
  const hue = hueOf(rgbOf(cardColours(poster).top));
  assert.ok(hue > 200 && hue < 240, `hue ${hue}`);
  const [r, g, b] = rgbOf(cardColours(fill([128, 128, 128])).top);
  assert.ok(r === g && g === b, `${r} ${g} ${b}`);
});
