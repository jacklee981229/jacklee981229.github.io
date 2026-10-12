import { test } from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { BORDER, FRAME, qrFileName, qrLogoBox, qrPixels, qrSquares, qrSvg } from '../src/lib/lab/qr.js';

// The site's own colours (tokens.css): deep orange squares on white, in a bright orange card.
const COLOURS = { ink: '#D9480F', paper: '#FFFFFF', frame: '#F26B1D' };

/** What a scanner that only reads dark squares on light (as many phone cameras do) gets from a code's PNG pixels, or
    null if it can't read it. The logo's tile is left white here; the test after this one fills it instead. */
const scan = (squares) => {
  const { data, width, height } = qrPixels(squares, COLOURS);
  const found = jsQR(data, width, height, { inversionAttempts: 'dontInvert' });
  return found && Buffer.from(found.binaryData).toString('utf8');
};

/** The same code with its logo's tile filled with ink: the worst a logo could look to a scanner. */
const blotted = (squares) => {
  const { at, tile } = squares.logo;
  const dark = squares.dark.map((row, y) => row.map((on, x) => on || (x >= at && x < at + tile && y >= at && y < at + tile)));
  return { ...squares, dark };
};

test('a link scans back as the same link', () => {
  const text = 'https://jacklee981229.github.io';
  assert.equal(scan(qrSquares(text)), text);
});

test('Chinese and emoji scan back exactly', () => {
  for (const text of ['我對緣分小心翼翼', '你好，世界 👋', 'Line one\nline two']) assert.equal(scan(qrSquares(text)), text);
});

test('the longest message one code holds still scans back', () => {
  const text = 'a'.repeat(1273);
  const squares = qrSquares(text);
  assert.equal(squares.size, 177 + 2 * BORDER, 'the biggest code there is');
  assert.equal(scan(squares), text);
});

test('with the logo tile filled in, every size of code still scans', () => {
  for (const n of [1, 20, 60, 150, 400, 800, 1273]) {
    const text = 'a'.repeat(n);
    assert.equal(scan(blotted(qrSquares(text))), text, `${n} characters`);
  }
});

test('the logo stays clear of the three corner squares and covers little of the code', () => {
  for (const n of [1, 20, 60, 150, 400, 800, 1273]) {
    const { size, logo } = qrSquares('a'.repeat(n));
    const inner = size - 2 * BORDER;
    // A corner square and the white gap round it take 8 squares from each corner.
    assert.ok(logo.at >= BORDER + 8 && logo.at + logo.tile <= size - BORDER - 8, `${n} characters: tile ${JSON.stringify(logo)}`);
    assert.equal(logo.at * 2 + logo.tile, size, 'centred on whole squares');
    assert.ok((logo.tile / inner) ** 2 < 0.08, `${n} characters: the tile covers ${Math.round((logo.tile / inner) ** 2 * 100)}%`);
    const box = qrLogoBox({ logo });
    assert.ok(box.x > logo.at && box.x + box.width < logo.at + logo.tile, 'the logo keeps a white margin in its tile');
  }
});

test('too long for one code: how many characters over, a Chinese character or an emoji counting as one', () => {
  assert.deepEqual(qrSquares('a'.repeat(1274)), { over: 1 });
  assert.deepEqual(qrSquares('a'.repeat(1277)), { over: 4 });
  // Three bytes each, so 424 fit; four bytes each, so 318 fit.
  assert.deepEqual(qrSquares('字'.repeat(800)), { over: 376 });
  assert.deepEqual(qrSquares('👋'.repeat(600)), { over: 282 });
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

test('the PNG has sharp squares, at least 1024 pixels across, in a card with clear corners', () => {
  const squares = qrSquares('https://jacklee981229.github.io');
  const { width, height, scale, data } = qrPixels(squares, COLOURS);
  assert.equal(width, height);
  assert.ok(width >= 1024, `${width} pixels across`);
  assert.equal(width, (squares.size + 2 * FRAME) * scale, 'a whole number of pixels per square');
  const allowed = new Set(['217,72,15,255', '255,255,255,255', '242,107,29,255', '0,0,0,0']);
  let blurred = 0;
  for (let i = 0; i < data.length; i += 4) if (!allowed.has(data.slice(i, i + 4).join(','))) blurred++;
  assert.equal(blurred, 0, 'only ink, paper, the card and clear, no in-between pixels');
  const at = (x, y) => data.slice((y * width + x) * 4, (y * width + x) * 4 + 4).join(',');
  assert.equal(at(0, 0), '0,0,0,0', 'the card has round corners');
  assert.equal(at(Math.floor(width / 2), 2), '242,107,29,255', 'the card is orange at its edge');
});

test('the SVG draws exactly the dark squares, on the panel in the card, with the logo', () => {
  const squares = qrSquares('svg check 你好');
  const svg = qrSvg(squares, COLOURS);
  const card = squares.size + 2 * FRAME;
  assert.match(svg, new RegExp(`^<svg [^>]*width="1024" height="1024" viewBox="-${FRAME} -${FRAME} ${card} ${card}"`), 'a size for apps that place it as it is');
  assert.match(svg, new RegExp(`<rect x="-${FRAME}" y="-${FRAME}" width="${card}" height="${card}" rx="[\\d.]+" fill="#F26B1D"/>`));
  assert.match(svg, new RegExp(`<rect width="${squares.size}" height="${squares.size}" rx="[\\d.]+" fill="#FFFFFF"/>`));
  assert.match(svg, /<svg [^>]*viewBox="0 0 100 100"/, 'the logo inside');
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
