import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigin, needsALook, readNote } from '../workers/guestbook/notes.js';

test('a note is tidied: its name on one line, no runs of empty lines, an email and a website if given', () => {
  assert.deepEqual(readNote({ name: '  Mei \n Lin ', message: 'Hi!\r\n\r\n\r\n\r\nBye  ' }), { note: { name: 'Mei Lin', message: 'Hi!\n\nBye', email: null, website: null } });
  assert.deepEqual(readNote({ name: 'Ken', message: 'Hey', email: ' ken@example.com ', website: 'ken.example' }), { note: { name: 'Ken', message: 'Hey', email: 'ken@example.com', website: 'https://ken.example/' } });
});

test('a note without a name or a message, or too long, or with a bad email or website, says what to fix', () => {
  assert.equal(readNote({ message: 'Hi' }).error, 'Please add your name.');
  assert.equal(readNote({ name: 'A' }).error, 'Please write a message.');
  assert.match(readNote({ name: 'x'.repeat(41), message: 'Hi' }).error, /up to 40/);
  assert.match(readNote({ name: 'A', message: 'y'.repeat(301) }).error, /up to 300/);
  assert.equal(readNote({ name: 'A', message: 'B', email: 'not-an-email' }).error, "That email doesn't look right.");
  for (const site of ['javascript:alert(1)', 'ftp://x.example', 'localhost', 'https://']) assert.equal(readNote({ name: 'A', message: 'B', website: site }).error, "That website doesn't look right.", site);
  assert.equal(readNote(null).error, 'Please add your name.');
  // Chinese and emoji count as one character each.
  assert.ok('note' in readNote({ name: '小明'.repeat(20), message: '🐟'.repeat(300) }));
});

test('a note waits for Jack with a web address in its message, or a word from his list', () => {
  const note = (message, name = 'A', website = null) => ({ name, message, website });
  assert.equal(needsALook(note('Nice site!'), ['casino']), false);
  assert.equal(needsALook(note('Visit www.spam.example'), []), true);
  assert.equal(needsALook(note('see https://x.example'), []), true);
  assert.equal(needsALook(note('Best CASINO here'), ['casino']), true);
  // A word of letters counts only whole; a Chinese one anywhere.
  assert.equal(needsALook(note('I took a class'), ['ass']), false);
  assert.equal(needsALook(note('你好，垃圾广告'), ['垃圾']), true);
  assert.equal(needsALook(note('Hello', 'Casino King'), ['casino']), true);
  assert.equal(needsALook(note('Hello', 'A', 'https://casino.example/'), ['casino']), true);
});

test('only the site and previews on the laptop may post to the guestbook', () => {
  assert.equal(allowedOrigin('https://jacklee981229.github.io'), 'https://jacklee981229.github.io');
  assert.equal(allowedOrigin('http://localhost:4321'), 'http://localhost:4321');
  assert.equal(allowedOrigin('http://127.0.0.1:4600'), 'http://127.0.0.1:4600');
  for (const origin of [null, 'https://evil.example', 'http://jacklee981229.github.io', 'http://localhost.evil.example:80', 'https://jacklee981229.github.io.evil.example']) assert.equal(allowedOrigin(origin), null, String(origin));
});
