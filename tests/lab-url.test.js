import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeUrl, encodeUrl } from '../src/lib/lab/url.js';

test('encoding makes text safe for a web address', () => {
  assert.deepEqual(encodeUrl('a b&c'), { text: 'a%20b%26c' });
  assert.deepEqual(encodeUrl('q=1/2?x#y'), { text: 'q%3D1%2F2%3Fx%23y' });
  assert.deepEqual(encodeUrl(''), { text: '' });
});

test('encoding uses UTF-8, so any language and emoji work', () => {
  assert.equal(encodeUrl('你好 👍').text, '%E4%BD%A0%E5%A5%BD%20%F0%9F%91%8D');
  assert.equal(encodeUrl('café').text, 'caf%C3%A9');
});

test('a broken character gets a plain message instead of an error', () => {
  const r = encodeUrl('bad \uD83D here');
  assert.equal(r.text, '');
  assert.match(r.note ?? '', /broken character/);
});

test('decoding reads % codes back, in either letter case', () => {
  assert.deepEqual(decodeUrl('a%20b%26c'), { text: 'a b&c' });
  assert.deepEqual(decodeUrl('caf%c3%a9'), { text: 'café' });
  assert.deepEqual(decodeUrl('%F0%9F%91%8D ok'), { text: '👍 ok' });
  assert.deepEqual(decodeUrl('no codes here'), { text: 'no codes here' });
});

test('decoding leaves a plus sign alone', () => {
  assert.deepEqual(decodeUrl('a+b'), { text: 'a+b' });
});

test('any text survives encoding and decoding', () => {
  const text = 'Jack’s Space: 你好, café & 👍🏽 100%!\nline two';
  assert.deepEqual(decodeUrl(encodeUrl(text).text), { text });
});

test('broken % codes stay as they were, and the note counts them', () => {
  assert.deepEqual(decodeUrl('100%'), { text: '100%', note: '1 % code couldn’t be read, so it’s left as it was.' });
  assert.deepEqual(decodeUrl('50%25 off%21 and 100%'), { text: '50% off! and 100%', note: '1 % code couldn’t be read, so it’s left as it was.' });
  assert.equal(decodeUrl('%zz%2').text, '%zz%2');
  // Half a character: the first two of the three codes for "€".
  assert.deepEqual(decodeUrl('%E2%82 then %20'), { text: '%E2%82 then  ', note: '2 % codes couldn’t be read, so they’re left as they were.' });
  // A byte that can't start a character, and one that isn't UTF-8 at all.
  assert.equal(decodeUrl('%80%FFx').text, '%80%FFx');
});
