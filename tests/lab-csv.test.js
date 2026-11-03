import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareCells, filterRows, readCsv, separatorOf, sortRows } from '../src/lib/lab/csv.js';

const good = (text) => {
  const r = readCsv(text);
  assert.ok(r.ok, `expected good CSV, got: ${r.ok ? '' : r.message}`);
  return r;
};
const cells = (text) => {
  const r = good(text);
  return [r.header, ...r.rows];
};

test('the separator is whichever the first row uses most, quotes aside', () => {
  assert.equal(separatorOf('a,b,c\n1,2,3'), ',');
  assert.equal(separatorOf('a;b;c\n1,5;2,5;3'), ';');
  assert.equal(separatorOf('a\tb\tc'), '\t');
  assert.equal(separatorOf('"a;b;c",d'), ',');
  assert.equal(separatorOf('just one'), ',');
  assert.equal(separatorOf('5" TV;price;stock\n1;2;3'), ';');
  assert.equal(separatorOf('"say ""a;b"" ok",x,y'), ',');
  assert.deepEqual(cells('name;price\nTea;4,50'), [['name', 'price'], ['Tea', '4,50']]);
  assert.deepEqual(cells('name\tcity\nJack\tKL'), [['name', 'city'], ['Jack', 'KL']]);
});

test('quoted cells keep separators, doubled quotes and line breaks', () => {
  assert.deepEqual(cells('a,b\n"x, y","say ""hi"""\n'), [['a', 'b'], ['x, y', 'say "hi"']]);
  assert.deepEqual(cells('a,b\n"two\nlines",c'), [['a', 'b'], ['two\nlines', 'c']]);
  assert.deepEqual(cells('a,b\n"",c'), [['a', 'b'], ['', 'c']]);
  // A quote in the middle of a cell is kept as written.
  assert.deepEqual(cells('a,b\n5" screen,c'), [['a', 'b'], ['5" screen', 'c']]);
});

test('Windows and old Mac line ends, a byte-order mark, blank lines and a last line break', () => {
  assert.deepEqual(cells('\u{feff}a,b\r\n1,2\r\n\r\n3,4\r\n'), [['a', 'b'], ['1', '2'], ['3', '4']]);
  assert.deepEqual(cells('a,b\r1,2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(cells('名字,城市\n杰克,吉隆坡'), [['名字', '城市'], ['杰克', '吉隆坡']]);
});

test('short rows are filled out, long ones widen the table', () => {
  assert.deepEqual(cells('a,b,c\n1\n1,2,3,4'), [['a', 'b', 'c', ''], ['1', '', '', ''], ['1', '2', '3', '4']]);
  assert.deepEqual(cells('a,b\n1,'), [['a', 'b'], ['1', '']]);
  const empty = good('');
  assert.deepEqual([empty.header, empty.rows], [[], []]);
});

test("a report's title lines above the header are notes, and a total row stays a row", () => {
  const report = [
    'Stock report as of 2026-11-03 (1 unit = RM 0.50)',
    'item,shop,count,value_rm',
    'A100,North Shop,4,2.00',
    'A101,South Shop,0,0.00',
    'A102,East Shop,2,1.00',
    'TOTAL,3 items,6,3.00',
  ].join('\n');
  const r = good(report);
  assert.deepEqual(r.notes, ['Stock report as of 2026-11-03 (1 unit = RM 0.50)']);
  assert.deepEqual(r.header, ['item', 'shop', 'count', 'value_rm']);
  assert.equal(r.rows.length, 4);
  assert.deepEqual(r.rows[3], ['TOTAL', '3 items', '6', '3.00']);
  // Two title lines, one quoted with a comma, one padded with commas as spreadsheets save it; a line of only commas.
  const two = good('"Stock report, March",,\nMade by the shop,,\n,,\nitem,shop,count\nA,N,1\nB,S,2\nTOTAL,,3\nC,E');
  assert.deepEqual(two.notes, ['Stock report, March', 'Made by the shop']);
  assert.deepEqual(two.header, ['item', 'shop', 'count']);
  assert.deepEqual(two.rows.at(-1), ['C', 'E', '']);
  // A title over mostly short rows, or over a header alone.
  assert.deepEqual(good('Report title\nname,notes\nA\nB\nC,x').header, ['name', 'notes']);
  assert.deepEqual(good('Report\na,b').header, ['a', 'b']);
  // A title with semicolons doesn't decide the separator.
  assert.equal(good('Sales; March; 2026\nitem,count\nA,1\nB,2\nC,3').header.length, 2);
  // No title: no notes, even when most rows are short or end in a comma; a one-column file keeps its first row.
  assert.deepEqual(good('a,b,c\n1\n2\n3,4').notes, []);
  assert.deepEqual(good('name,score\nA,1,\nB,2,').header, ['name', 'score', '']);
  assert.deepEqual(good('name\nA\nB').header, ['name']);
});

test('the separator is the steady one: decimal commas and quoted cells at a line start', () => {
  assert.equal(separatorOf('a;b\n1,5;2,5\n3,5;4,5'), ';');
  assert.equal(separatorOf('a,b\n"x;y;z",1\n"p;q;r",2'), ',');
  assert.equal(separatorOf('a,b\n"x\ty\tz",1\n"p\tq",2'), ',');
});

test('a file of 300,000 rows reads', () => {
  const r = good(`a,b\n${'1,x\n'.repeat(300_000)}`);
  assert.equal(r.rows.length, 300_000);
});

test('a quoted cell that never closes says so, with the line it opened on', () => {
  const r = readCsv('a,b\n1,2\n3,"open\nstill open');
  assert.equal(r.ok, false);
  assert.equal(r.line, 3);
  assert.match(r.message, /never closes/);
  assert.equal(readCsv('a,b\r\n"x\r\ny",z\r\n"w').line, 4);
});

test('numbers sort by size and before text; text alphabetically, capitals ignored', () => {
  assert.ok(compareCells('9', '10') < 0);
  assert.ok(compareCells('-3.5', '2') < 0);
  assert.ok(compareCells('1e3', '999') > 0);
  assert.ok(compareCells('42', 'apple') < 0);
  assert.ok(compareCells('item 9', 'item 10') < 0);
  assert.equal(compareCells('Apple', 'apple'), 0);
  assert.equal(compareCells('4,50', '4,50'), 0);
  assert.ok(compareCells('5', '1e999') < 0, 'a number too big to hold sorts as text');
});

test('sorting: either way, ties keep their order, empty cells last', () => {
  const rows = [['b', '10'], ['a', ''], ['c', '9'], ['d', '10']];
  assert.deepEqual(sortRows(rows, 1, 'up').map((r) => r[0]), ['c', 'b', 'd', 'a']);
  assert.deepEqual(sortRows(rows, 1, 'down').map((r) => r[0]), ['b', 'd', 'c', 'a']);
  assert.deepEqual(sortRows(rows, 0, 'down').map((r) => r[0]), ['d', 'c', 'b', 'a']);
  assert.deepEqual(rows.map((r) => r[0]), ['b', 'a', 'c', 'd'], 'the rows given are left as they were');
});

test('search keeps the rows with a matching cell, capitals ignored', () => {
  const rows = [['Jack', 'Kuala Lumpur'], ['Mei', 'Penang'], ['杰克', '吉隆坡']];
  assert.deepEqual(filterRows(rows, 'kuala'), [rows[0]]);
  assert.deepEqual(filterRows(rows, ' PEN '), [rows[1]]);
  assert.deepEqual(filterRows(rows, '吉隆'), [rows[2]]);
  assert.equal(filterRows(rows, '  '), rows);
  assert.deepEqual(filterRows(rows, 'nowhere'), []);
});
