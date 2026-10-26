import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseName, byFileOrder, cutsAfter, joinPages, move, numberSize, numberSpot, pageNumber, pageText, parseRange, parts, previewSpot, quarter, saveFiles, toRange, turnsToList } from '../src/lib/lab/pdf-pages.js';

test('a typed range picks those pages, in order, once each', () => {
  assert.deepEqual(parseRange('1-3, 5', 9), [0, 1, 2, 4]);
  assert.deepEqual(parseRange('5-3', 9), [2, 3, 4]);
  assert.deepEqual(parseRange(' 2 , 2, 4 - 5 ', 9), [1, 3, 4]);
  assert.deepEqual(parseRange('2，4；7', 9), [1, 3, 6]);
});

test('a range leaves out pages past the end, page 0 and words', () => {
  assert.deepEqual(parseRange('8-12', 9), [7, 8]);
  assert.deepEqual(parseRange('0, 20, all, 3x', 9), []);
  assert.deepEqual(parseRange('', 9), []);
});

test('chosen pages turn back into a range to type', () => {
  assert.equal(toRange([0, 1, 2, 4]), '1-3, 5');
  assert.equal(toRange([6, 0, 6]), '1, 7');
  assert.equal(toRange([]), '');
  assert.equal(toRange(parseRange('1-3, 5, 7-9', 9)), '1-3, 5, 7-9');
});

test('Split cuts by hand, after every page, or every few pages, never after the last', () => {
  assert.deepEqual(cutsAfter(5, 'cuts', { cuts: [2, 4] }), [false, false, true, false, false]);
  assert.deepEqual(cutsAfter(4, 'each'), [true, true, true, false]);
  assert.deepEqual(cutsAfter(7, 'every', { every: 3 }), [false, false, true, false, false, true, false]);
  assert.deepEqual(cutsAfter(6, 'every', { every: 3 }), [false, false, true, false, false, false]);
});

test('cuts make parts', () => {
  assert.deepEqual(parts([false, false, true, false, false]), [[0, 1, 2], [3, 4]]);
  assert.deepEqual(parts([false, false]), [[0, 1]]);
  assert.deepEqual(parts([]), []);
});

test('a page moves to its new place', () => {
  assert.deepEqual(move(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(move(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(move(['a', 'b'], 0, 9), ['b', 'a']);
});

test('turns come out as quarter turns from 0 to 270', () => {
  assert.equal(quarter(-90), 270);
  assert.equal(quarter(450), 90);
  assert.equal(quarter(720), 0);
  assert.equal(quarter(-180), 180);
});

test('Merge moves a whole file, each keeping its own page order', () => {
  const pages = [{ file: 'a', n: 2 }, { file: 'b', n: 1 }, { file: 'a', n: 1 }, { file: 'b', n: 2 }];
  assert.deepEqual(byFileOrder(pages, ['b', 'a']).map((p) => p.file + p.n), ['b1', 'b2', 'a2', 'a1']);
});

test('the board turns into the list only the moment it goes past 10 pages', () => {
  assert.equal(turnsToList(9, 21), true);
  assert.equal(turnsToList(10, 11), true);
  assert.equal(turnsToList(4, 10), false);
  assert.equal(turnsToList(21, 33), false);
});

test('new names build on the first file, without its ending or characters files cannot have', () => {
  assert.equal(baseName('Report 2026.PDF'), 'Report 2026');
  assert.equal(baseName('a:b?.pdf'), 'a-b-');
  assert.equal(baseName('.pdf'), '.pdf');
  assert.equal(baseName('   .pdf'), 'document');
});

const board = [
  { file: 'r', n: 1, turn: 0 }, { file: 'r', n: 2, turn: 90 }, { file: 'r', n: 3, turn: -90 },
  { file: 's', n: 1, turn: 0 }, { file: 's', n: 2, turn: 360 },
];
const none = board.map(() => false);
const short = (f) => f.pages.map((p) => `${p.file}${p.n}${p.turn ? `@${p.turn}` : ''}`).join(' ');

test('All saves every page in board order with its turn, or only the chosen ones', () => {
  const one = saveFiles({ task: 'all', pages: board, chosen: none, base: 'report.pdf' });
  assert.equal(one.zip, null);
  assert.deepEqual(one.files.map((f) => f.name), ['report-edited.pdf']);
  assert.equal(short(one.files[0]), 'r1 r2@90 r3@270 s1 s2');
  const some = saveFiles({ task: 'all', pages: board, chosen: [false, true, false, true, false], base: 'report.pdf', onlyChosen: true });
  assert.equal(short(some.files[0]), 'r2@90 s1');
});

test('Take pages out keeps the rest, and taking every page out saves nothing', () => {
  const out = saveFiles({ task: 'out', pages: board, chosen: [true, false, true, false, false], base: 'report.pdf' });
  assert.equal(short(out.files[0]), 'r2@90 s1 s2');
  assert.deepEqual(saveFiles({ task: 'out', pages: board, chosen: board.map(() => true), base: 'report.pdf' }).files, []);
});

test('Split makes one PDF a part, in a ZIP, and nothing without a cut', () => {
  const split = saveFiles({ task: 'split', pages: board, chosen: none, base: 'report.pdf', cuts: cutsAfter(5, 'cuts', { cuts: [2] }) });
  assert.equal(split.zip, 'report-split.zip');
  assert.deepEqual(split.files.map((f) => f.name), ['report-part-1.pdf', 'report-part-2.pdf']);
  assert.deepEqual(split.files.map(short), ['r1 r2@90 r3@270', 's1 s2']);
  assert.deepEqual(saveFiles({ task: 'split', pages: board, chosen: none, base: 'report.pdf', cuts: cutsAfter(5, 'cuts') }).files, []);
  const many = saveFiles({ task: 'split', pages: Array(12).fill(board[0]), chosen: [], base: 'x.pdf', cuts: cutsAfter(12, 'each') });
  assert.equal(many.files[0].name, 'x-part-01.pdf');
  assert.equal(many.files[11].name, 'x-part-12.pdf');
});

test('To pictures makes one picture a page: the chosen ones, else all; one picture needs no ZIP', () => {
  const all = saveFiles({ task: 'pics', pages: board, chosen: none, base: 'report.pdf', picture: 'png' });
  assert.equal(all.zip, 'report-pictures.zip');
  assert.deepEqual(all.files.map((f) => f.name), ['report-page-01.png', 'report-page-02.png', 'report-page-03.png', 'report-page-04.png', 'report-page-05.png']);
  assert.equal(all.files[1].kind, 'png');
  const one = saveFiles({ task: 'pics', pages: board, chosen: [false, false, true, false, false], base: 'report.pdf' });
  assert.equal(one.zip, null);
  assert.deepEqual(one.files.map((f) => [f.name, short(f)]), [['report-page-03.jpg', 'r3@270']]);
});

test('Merge and Turn save every page in one PDF', () => {
  assert.deepEqual(saveFiles({ task: 'merge', pages: board, chosen: none, base: 'report.pdf' }).files.map((f) => f.name), ['report-merged.pdf']);
  assert.deepEqual(saveFiles({ task: 'turn', pages: board, chosen: none, base: 'report.pdf' }).files.map((f) => f.name), ['report-turned.pdf']);
});

test('Page numbers saves every page in one PDF and says where and how to number them', () => {
  const made = saveFiles({ task: 'numbers', pages: board, chosen: none, base: 'report.pdf', numbers: { where: 'right', style: 'of' } });
  assert.deepEqual(made.files.map((f) => f.name), ['report-numbered.pdf']);
  assert.equal(short(made.files[0]), 'r1 r2@90 r3@270 s1 s2');
  assert.deepEqual(made.files[0].numbers, { where: 'right', style: 'of' });
  assert.deepEqual(saveFiles({ task: 'numbers', pages: board, chosen: none, base: 'report.pdf' }).files[0].numbers, { where: 'centre', style: 'n' });
  assert.deepEqual(saveFiles({ task: 'text', pages: board, chosen: none, base: 'report.pdf' }).files, []);
});

test('a number reads "3" or "3 / 9"', () => {
  assert.equal(pageNumber(2, 9, 'n'), '3');
  assert.equal(pageNumber(2, 9, 'of'), '3 / 9');
});

/**
 * Where a point on the unturned page (y up) shows once the page is turned clockwise by `q`, worked out by turning
 * the page's corners, apart from numberSpot's own sums. Returns the point on the shown page and the shown width.
 */
function shown(box, q, [px, py]) {
  const r = (q * Math.PI) / 180;
  const spin = ([a, b]) => [a * Math.cos(r) + b * Math.sin(r), -a * Math.sin(r) + b * Math.cos(r)];
  const corners = [[0, 0], [box.width, 0], [0, box.height], [box.width, box.height]].map(spin);
  const minX = Math.min(...corners.map((c) => c[0])), minY = Math.min(...corners.map((c) => c[1]));
  const [u, v] = spin([px - box.x, py - box.y]);
  return { u: u - minX, v: v - minY, width: Math.max(...corners.map((c) => c[0])) - minX };
}

test('a page number sits upright at the bottom of the page as it shows, however the page is turned', () => {
  const box = { x: 10, y: 20, width: 600, height: 800 };
  const textWidth = 30, size = 11;
  for (const turn of [0, 90, 180, 270, -90, 450]) {
    for (const where of ['centre', 'right']) {
      const spot = numberSpot({ box, turn, where, textWidth, size });
      const q = quarter(turn);
      const start = shown(box, q, [spot.x, spot.y]);
      // The text runs left to right on the shown page: its direction, turned with the page, points right.
      const end = shown(box, q, [spot.x + textWidth * Math.cos((spot.rotate * Math.PI) / 180), spot.y + textWidth * Math.sin((spot.rotate * Math.PI) / 180)]);
      const label = `${where} at ${turn}°`;
      assert.ok(Math.abs(end.v - start.v) < 1e-6 && end.u > start.u, `${label}: upright`);
      assert.ok(Math.abs(start.v - size * 2.4) < 1e-6, `${label}: near the bottom`);
      if (where === 'centre') assert.ok(Math.abs((start.u + end.u) / 2 - start.width / 2) < 1e-6, `${label}: centred`);
      else assert.ok(Math.abs(start.width - end.u - size * 3.6) < 1e-6, `${label}: at the right`);
    }
  }
});

test('page numbers are 11 points on big pages and smaller on small ones', () => {
  assert.equal(numberSize({ width: 595, height: 842 }), 11);
  assert.equal(numberSize({ width: 400, height: 600 }), 8);
  assert.equal(numberSize({ width: 100, height: 100 }), 6);
});

test("the board's preview number sits at the bottom of the page once its picture is turned", () => {
  assert.deepEqual(previewSpot(0, 'centre'), { x: 50, y: 93 });
  assert.deepEqual(previewSpot(0, 'right'), { x: 88, y: 93 });
  // Turned right, the page's right edge is the bottom, and its top is the right.
  assert.deepEqual(previewSpot(90, 'centre'), { x: 93, y: 50 });
  assert.deepEqual(previewSpot(90, 'right'), { x: 93, y: 12 });
  assert.deepEqual(previewSpot(-90, 'right'), { x: 7, y: 88 });
  assert.deepEqual(previewSpot(180, 'right'), { x: 12, y: 7 });
});

test("a page's text comes out line by line, spaces tidied", () => {
  const items = [{ str: 'Hello ', hasEOL: false }, { str: ' world', hasEOL: true }, { type: 'beginMarkedContent' }, { str: '', hasEOL: true }, { str: '  second   line ', hasEOL: true }, { str: '中文', hasEOL: false }];
  assert.equal(pageText(items), 'Hello world\nsecond line\n中文');
  assert.equal(pageText([]), '');
});

test('all the text comes with a line before each page, and an empty page says it may be a scan', () => {
  assert.equal(joinPages(['One', '', 'Three\nmore']), '— Page 1 —\nOne\n\n— Page 2: no text, it may be a scan —\n\n— Page 3 —\nThree\nmore');
});
