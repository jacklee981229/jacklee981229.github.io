import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASES, changeCase } from '../src/lib/lab/case.js';

const all = (text) => Object.fromEntries(CASES.map((c) => [c.id, changeCase(text, c.id)]));

test('every case on a simple phrase', () => {
  assert.deepEqual(all('hello world'), {
    upper: 'HELLO WORLD', lower: 'hello world', title: 'Hello World', sentence: 'Hello world',
    camel: 'helloWorld', pascal: 'HelloWorld', snake: 'hello_world', kebab: 'hello-world',
  });
});

test('upper and lower case beyond English', () => {
  assert.equal(changeCase('straße café', 'upper'), 'STRASSE CAFÉ');
  assert.equal(changeCase('ÉCOLE ÖFFENTLICH', 'lower'), 'école öffentlich');
  assert.equal(changeCase('我喜欢 coffee', 'upper'), '我喜欢 COFFEE');
});

test('Title Case capitalises each word once', () => {
  assert.equal(changeCase('HELLO wORLD', 'title'), 'Hello World');
  assert.equal(changeCase("don't stop, it's fine", 'title'), "Don't Stop, It's Fine");
  assert.equal(changeCase("'quoted' words", 'title'), "'Quoted' Words");
  assert.equal(changeCase('well-known 3rd place', 'title'), 'Well-Known 3rd Place');
  assert.equal(changeCase('élan vital', 'title'), 'Élan Vital');
  // An accent typed as its own character after the letter.
  assert.equal(changeCase('cafe\u{301} au lait', 'title'), 'Cafe\u{301} Au Lait');
});

test('Sentence case starts each sentence and line with a capital', () => {
  assert.equal(changeCase('HELLO. HOW ARE YOU? i\'m fine!\nnew line here', 'sentence'), "Hello. How are you? I'm fine!\nNew line here");
  assert.equal(changeCase('she said "hi." "and then?"', 'sentence'), 'She said "hi." "And then?"');
  assert.equal(changeCase('so did i. use it, i.e. carefully', 'sentence'), 'So did I. Use it, i.e. carefully');
});

test('the code cases split words at spaces, symbols and capitals', () => {
  assert.equal(changeCase('XMLHttpRequest', 'snake'), 'xml_http_request');
  assert.equal(changeCase('user_id', 'camel'), 'userId');
  assert.equal(changeCase('user-profile-page', 'pascal'), 'UserProfilePage');
  assert.equal(changeCase('version2Update', 'kebab'), 'version2-update');
  assert.equal(changeCase("don't stop", 'camel'), 'dontStop');
  assert.equal(changeCase('  Hello,   World!  ', 'snake'), 'hello_world');
  assert.equal(changeCase('café au lait', 'camel'), 'caféAuLait');
});

test('the code cases keep lines apart', () => {
  assert.equal(changeCase('first name\n\nlast name', 'kebab'), 'first-name\n\nlast-name');
});

test('an unknown case is a mistake in the page', () => {
  assert.throws(() => changeCase('x', 'shout'), /No case "shout"/);
});
