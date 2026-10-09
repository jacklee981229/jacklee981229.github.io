import { test } from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { BORDER, qrFileName, qrPixels, qrSquares, qrSvg } from '../src/lib/lab/qr.js';

const COLOURS = { ink: '#000000', paper: '#FFFFFF' };

/** What a scanner reads from a code's PNG pixels, or null if it can't read it. */
const scan = (squares) => {
  const { data, width, height } = qrPixels(squares, COLOURS);
  const found = jsQR(data, width, height);
  return found && Buffer.from(found.binaryData).toString('utf8');
};

test('a link scans back as the same link', () => {
  const text = 'https://jacklee981229.github.io';
  assert.equal(scan(qrSquares(text)), text);
});

test('Chinese and emoji scan back exactly', () => {
  for (const text of ['我對緣分小心翼翼', '你好，世界 👋', 'Line one\nline two']) assert.equal(scan(qrSquares(text)), text);
});

test('the longest message one code holds still scans back', () => {
  const text = 'a'.repeat(2331);
  const squares = qrSquares(text);
  assert.equal(squares.size, 177 + 2 * BORDER, 'the biggest code there is');
  assert.equal(scan(squares), text);
});

test('too long for one code: how many characters over, a Chinese character or an emoji counting as one', () => {
  assert.deepEqual(qrSquares('a'.repeat(2332)), { over: 1 });
  assert.deepEqual(qrSquares('a'.repeat(2335)), { over: 4 });
  // Three bytes each, so 777 fit; four bytes each, so 582 fit.
  assert.deepEqual(qrSquares('字'.repeat(800)), { over: 23 });
  assert.deepEqual(qrSquares('👋'.repeat(600)), { over: 18 });
});

test('nothing to encode makes no code', () => {
  assert.equal(qrSquares(''), null);
});

test('every code sits in a white border four squares wide', () => {
  const { size, dark } = qrSquares('border');
  for (let i = 0; i < BORDER; i++) {
    for (let j = 0; j < size; j++) {
      assert.ok(!dark[i][j] && !dark[size - 1 - i][j] && !dark[j][i] && !dark[j][size - 1 - i], `border square ${i},${j}`);
    }
  }
  // The corner's finder square starts right inside the border.
  assert.ok(dark[BORDER][BORDER]);
});

test('the PNG has sharp squares, at least 1024 pixels across', () => {
  const squares = qrSquares('https://jacklee981229.github.io');
  const { width, height, data } = qrPixels(squares, COLOURS);
  assert.equal(width, height);
  assert.ok(width >= 1024, `${width} pixels across`);
  assert.equal(width % squares.size, 0, 'a whole number of pixels per square');
  let blurred = 0;
  for (let i = 0; i < data.length; i += 4) if (!((data[i] === 0 || data[i] === 255) && data[i + 3] === 255)) blurred++;
  assert.equal(blurred, 0, 'only ink and paper, no in-between pixels');
});

test('the SVG draws exactly the dark squares, on the background', () => {
  const squares = qrSquares('svg check 你好');
  const svg = qrSvg(squares, COLOURS);
  assert.match(svg, /^<svg [^>]*width="1024" height="1024" viewBox="0 0 (\d+) \1"/, 'a size for apps that place it as it is');
  assert.match(svg, new RegExp(`<rect width="${squares.size}" height="${squares.size}" fill="#FFFFFF"/>`));
  const drawn = new Set();
  for (const [, x, y, w] of svg.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
    for (let i = 0; i < Number(w); i++) drawn.add(`${Number(x) + i},${y}`);
  }
  const dark = new Set();
  squares.dark.forEach((row, y) => row.forEach((on, x) => on && dark.add(`${x},${y}`)));
  assert.deepEqual(drawn, dark);
});

test('a download is named from its text', () => {
  assert.equal(qrFileName('https://jacklee981229.github.io', 'png'), 'qr-jacklee981229-github-io.png');
  assert.equal(qrFileName('HTTP://WWW.Example.com/Path?a=1', 'svg'), 'qr-example-com-path-a-1.svg');
  assert.equal(qrFileName('你好', 'png'), 'qr-code.png');
  assert.equal(qrFileName('', 'svg'), 'qr-code.svg');
  assert.equal(qrFileName('one two three four five six seven eight nine ten', 'png'), 'qr-one-two-three-four-five-six-seven-eight.png');
  assert.equal(qrFileName('a'.repeat(60), 'png'), `qr-${'a'.repeat(40)}.png`);
});
