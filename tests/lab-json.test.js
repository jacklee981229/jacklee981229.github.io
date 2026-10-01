import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DEPTH, jsonPieces, leafText, readJson, sizeOf, writeJson } from '../src/lib/lab/json.js';

const good = (text) => {
  const r = readJson(text);
  assert.ok(r.ok, `expected good JSON, got: ${r.ok ? '' : r.message}`);
  return r.value;
};
// Where and what a problem is: [line, column, the message's first words].
const wrong = (text) => {
  const r = readJson(text);
  assert.ok(!r.ok, 'expected a problem');
  return [r.line, r.column, r.message];
};
const starts = (text, line, column, words) => {
  const [l, c, message] = wrong(text);
  assert.deepEqual([l, c], [line, column], `${JSON.stringify(text)} -> ${message}`);
  assert.ok(message.startsWith(words), `${JSON.stringify(text)} said: ${message}`);
};

test('every kind of value is read', () => {
  assert.deepEqual(good('"hi"'), { type: 'string', value: 'hi' });
  assert.deepEqual(good(' 42 '), { type: 'number', raw: '42' });
  assert.deepEqual(good('true'), { type: 'boolean', value: true });
  assert.deepEqual(good('false'), { type: 'boolean', value: false });
  assert.deepEqual(good('null'), { type: 'null' });
  assert.deepEqual(good('[]'), { type: 'array', items: [] });
  assert.deepEqual(good('{ }'), { type: 'object', entries: [] });
  assert.deepEqual(good('{"a": [1, {"b": null}]}'), {
    type: 'object',
    entries: [{ key: 'a', value: { type: 'array', items: [{ type: 'number', raw: '1' }, { type: 'object', entries: [{ key: 'b', value: { type: 'null' } }] }] } }],
  });
});

test('text: escapes are read, and written back safely', () => {
  assert.equal(good('"a\\"b\\\\c\\/d\\n\\t\\u00e9\\ud83d\\ude00"').value, 'a"b\\c/d\n\t\u{e9}\u{1f600}');
  assert.equal(leafText(good('"line\\nbreak \\"quoted\\""')), '"line\\nbreak \\"quoted\\""');
  assert.equal(good('"\u{4f60}\u{597d}"').value, '\u{4f60}\u{597d}');
});

test('numbers stay exactly as written, however big or precise', () => {
  for (const n of ['0', '-0', '12345678901234567890', '0.1000', '-1.5e+10', '1E5', '3.141592653589793238462643']) {
    assert.deepEqual(good(n), { type: 'number', raw: n });
    assert.equal(writeJson(good(`[${n}]`), ''), `[${n}]`);
  }
});

test('names keep their order, even ones that look like numbers or repeat', () => {
  const node = good('{"b":1,"2":2,"1":3,"b":4}');
  assert.deepEqual(node.entries.map((e) => e.key), ['b', '2', '1', 'b']);
  assert.equal(writeJson(node, ''), '{"b":1,"2":2,"1":3,"b":4}');
});

test('tidy and compact writing', () => {
  const node = good('{"name":"Jack","tags":["a","b"],"empty":{},"none":[],"n":null}');
  assert.equal(writeJson(node), '{\n  "name": "Jack",\n  "tags": [\n    "a",\n    "b"\n  ],\n  "empty": {},\n  "none": [],\n  "n": null\n}');
  assert.equal(writeJson(node, ''), '{"name":"Jack","tags":["a","b"],"empty":{},"none":[],"n":null}');
  assert.equal(writeJson(good(' "just text" ')), '"just text"');
  assert.equal(sizeOf(node), 5);
  assert.equal(sizeOf(good('7')), 0);
});

test('the pieces for colouring: each with its kind, and joined up they are the same text', () => {
  const text = '{"name":"Jack","tags":["a",1,true,null],"empty":{},"quote":"a\\"b:c"}';
  const pieces = [...jsonPieces(good(text), '')];
  assert.equal(pieces.map(([, piece]) => piece).join(''), text);
  assert.deepEqual(pieces.slice(0, 5), [['mark', '{'], ['key', '"name"'], ['mark', ':'], ['string', '"Jack"'], ['mark', ',']]);
  assert.deepEqual(pieces.filter(([kind]) => kind === 'key').map(([, piece]) => piece), ['"name"', '"tags"', '"empty"', '"quote"']);
  assert.deepEqual(pieces.filter(([kind]) => kind !== 'key' && kind !== 'mark'), [['string', '"Jack"'], ['string', '"a"'], ['number', '1'], ['boolean', 'true'], ['null', 'null'], ['string', '"a\\"b:c"']]);
});

test('a file saved with a byte-order mark still reads', () => {
  assert.deepEqual(good('\u{feff}{"a":1}'), { type: 'object', entries: [{ key: 'a', value: { type: 'number', raw: '1' } }] });
});

test('common slips get a plain message at the right place', () => {
  starts("{'a': 1}", 1, 2, 'Names need double quotes ("), not single');
  starts('{a: 1}', 1, 2, 'Names need double quotes, like');
  starts("['a']", 1, 2, 'Text needs double quotes');
  starts('[1, 2,]', 1, 6, 'Take out this comma');
  starts('{"a": 1,}', 1, 8, 'Take out this comma');
  starts('[1 2]', 1, 4, 'A comma is missing');
  starts('{"a": 1 "b": 2}', 1, 9, 'A comma is missing');
  starts('{"a" 1}', 1, 6, 'A colon (:) is missing');
  starts('{"a": }', 1, 5, 'A value is missing after this colon');
  starts('[1}', 1, 3, 'This list was opened with [');
  starts('{"a":1]', 1, 7, 'This was opened with {');
  starts('{"a": True}', 1, 7, 'True must be written true');
  starts('{"a": None}', 1, 7, 'None must be written null');
  starts('[undefined]', 1, 2, "undefined isn't JSON");
  starts('{"a": 1} extra', 1, 10, 'The JSON has ended');
  starts('[1, // one\n 2]', 1, 5, "JSON can't have comments");
});

test('problems on later lines give that line and column', () => {
  starts('{\n  "a": 1,\n  "b": [1, 2,\n}', 4, 1, 'This list was opened with [');
  starts('{\n  "a": 1,\n  "b": [1, 2,]\n}', 3, 13, 'Take out this comma');
  starts('[}', 1, 2, 'This } has nothing to close');
  starts('{\r\n  "a": tru\r\n}', 2, 8, "tru isn't JSON");
  starts('[\n\n\n   @]', 4, 4, "@ can't start a value");
});

test('unfinished JSON says what is still open', () => {
  starts('', 1, 1, 'The JSON stops here');
  starts('[1, 2', 1, 1, 'The JSON stops before this [ is closed');
  starts('{"a": {"b": 1}', 1, 1, 'The JSON stops before this { is closed');
  starts('{"a"', 1, 5, 'The JSON stops after this name');
  starts('["abc', 1, 2, 'This text never closes');
  starts('[1,', 1, 4, 'The JSON stops here');
});

test('text and number slips', () => {
  starts('"a\nb"', 1, 3, "Text can't run on to a new line");
  starts('"a\tb"', 1, 3, "There's an invisible control character");
  starts('"a\\xb"', 1, 3, "\\x isn't an escape JSON knows");
  starts('"\\u12G4"', 1, 2, '\\u needs four');
  starts('[01]', 1, 2, "A number can't start with 0");
  starts('[-]', 1, 2, 'A minus sign needs a number');
  starts('[1.]', 1, 3, 'A decimal point needs digits');
  starts('[1e]', 1, 3, 'The e in a number needs digits');
  starts('[.5]', 1, 2, "A number can't start with a dot");
  starts('[+1]', 1, 2, "A number can't start with +");
});

test('deep nesting: read and written up to the limit, refused beyond it with a plain message', () => {
  const deep = '['.repeat(MAX_DEPTH) + '1' + ']'.repeat(MAX_DEPTH);
  assert.equal(writeJson(good(deep), ''), deep);
  const [line, , message] = wrong('['.repeat(MAX_DEPTH + 2) + ']'.repeat(MAX_DEPTH + 2));
  assert.equal(line, 1);
  assert.ok(message.startsWith(`This JSON is nested more than ${MAX_DEPTH} levels deep`));
});

test('a big file reads and writes quickly', () => {
  const rows = Array.from({ length: 12000 }, (_, i) => ({ id: i, name: `Item ${i}`, tags: ['a', 'b'], price: i * 1.5, ok: i % 2 === 0 }));
  const text = JSON.stringify(rows);
  assert.ok(text.length > 800_000);
  const t0 = performance.now();
  const node = good(text);
  const written = writeJson(node, '');
  const ms = performance.now() - t0;
  assert.equal(written, text);
  assert.ok(ms < 1500, `took ${Math.round(ms)} ms`);
});
