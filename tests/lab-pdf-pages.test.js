import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseName, byFileOrder, cutsAfter, move, parseRange, parts, quarter, saveFiles, toRange, turnsToList } from '../src/lib/lab/pdf-pages.js';

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
