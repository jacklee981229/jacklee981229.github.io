import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, DEFAULTS } from '../src/lib/lab/clean.js';

const OFF = { lineBreaks: false, trim: false, spaces: false, emptyLines: 'keep' };
const messy = '  Dear   Jack,\r\n\r\n\r\n\tThanks for\u{a0}\u{a0}the  help.  \n\n\n\nBest,\u{2028}Ann  \n\n';

test('everything on by default', () => {
  assert.deepEqual(DEFAULTS, { lineBreaks: true, trim: true, spaces: true, emptyLines: 'one' });
  assert.equal(cleanText(messy), 'Dear Jack,\n\nThanks for the help.\n\nBest,\nAnn');
});

test('with every option off, the text stays as it was', () => {
  assert.equal(cleanText(messy, OFF), messy);
});

test('line breaks: Windows, old Mac, Word and PDF ones become plain ones', () => {
  assert.equal(cleanText('a\r\nb\rc\u{2028}d\u{2029}e\vf', { ...OFF, lineBreaks: true }), 'a\nb\nc\nd\ne\nf');
});

test('trim lines: spaces at the start and end of each line, and empty lines at both ends of the text', () => {
  assert.equal(cleanText('\n\n  one  \n\t two\t\n\n', { ...OFF, trim: true }), 'one\ntwo');
  assert.equal(cleanText('a  \n\n  b', { ...OFF, trim: true }), 'a\n\nb');
});

test('collapse repeated spaces: runs of spaces, tabs and no-break spaces become one space', () => {
  assert.equal(cleanText('too   many \t spaces\u{a0}\u{a0}here', { ...OFF, spaces: true }), 'too many spaces here');
  // A single tab, as between spreadsheet cells, stays.
  assert.equal(cleanText('name\tage', { ...OFF, spaces: true }), 'name\tage');
});

test('empty lines: keep one between paragraphs, remove them all, or keep them', () => {
  const text = 'one\n\n\n\ntwo\n  \nthree';
  assert.equal(cleanText(text, { ...OFF, emptyLines: 'one' }), 'one\n\ntwo\n  \nthree');
  assert.equal(cleanText(text, { ...OFF, emptyLines: 'none' }), 'one\ntwo\nthree');
  assert.equal(cleanText(text, { ...OFF, emptyLines: 'keep' }), text);
});

test('Chinese text and emoji pass through untouched', () => {
  assert.equal(cleanText('  你好，  世界 👍🏽  '), '你好， 世界 👍🏽');
});

test('empty text stays empty', () => {
  assert.equal(cleanText(''), '');
  assert.equal(cleanText(' \n \n '), '');
});
