import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countText, readingTime } from '../src/lib/lab/count.js';

test('empty text counts nothing', () => {
  assert.deepEqual(countText(''), { characters: 0, charactersNoSpaces: 0, words: 0, lines: 0, paragraphs: 0, minutes: 0 });
  assert.equal(readingTime(0), '0 min');
});

test('a simple sentence', () => {
  const c = countText('Hello world, this is Jack.');
  assert.equal(c.words, 5);
  assert.equal(c.characters, 26);
  assert.equal(c.charactersNoSpaces, 22);
  assert.equal(c.lines, 1);
  assert.equal(c.paragraphs, 1);
});

test('lines and paragraphs, with Windows line breaks and a final line break', () => {
  const c = countText('One line.\r\nSecond line.\r\n\r\nNew paragraph.\n \nThird paragraph.\n');
  assert.equal(c.lines, 6);
  assert.equal(c.paragraphs, 3);
  assert.equal(countText('a\n').lines, 1);
});

test('line breaks are not characters, but other spaces are', () => {
  const c = countText('ab\ncd e');
  assert.equal(c.characters, 6);
  assert.equal(c.charactersNoSpaces, 5);
});

test('hyphenated words and contractions count once', () => {
  assert.equal(countText("well-known facts don't lie").words, 4);
});

test('Chinese is counted by words, not as one long word', () => {
  assert.equal(countText('我喜欢写代码').words, 4);
  assert.equal(countText('我喜欢写代码 and coffee').words, 6);
});

test('an emoji with a skin tone is one character', () => {
  assert.equal(countText('👍🏽').characters, 1);
});

test('reading time at 200 words a minute', () => {
  assert.equal(readingTime(countText('word '.repeat(50)).minutes), 'Under 1 min');
  assert.equal(readingTime(countText('word '.repeat(520)).minutes), 'About 3 min');
});
