// The Now editor Worker's rules (workers/now/now-editor.js) and the palette's /now (src/lib/now-command.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_SECONDS, allowedOrigin, fromBase64, joinNow, makePass, rightPassword, signedIn, splitNow, tidiedText, toBase64 } from '../workers/now/now-editor.js';
import { oneLine, readNowCommand } from '../src/lib/now-command.js';

const SECRET = 'a-test-secret-only';
const NOW = Date.UTC(2026, 9, 13, 12);

test('a pass signed by the Worker is accepted until it runs out', async () => {
  const pass = await makePass(SECRET, NOW);
  assert.equal(await signedIn(`Bearer ${pass}`, SECRET, NOW), true);
  assert.equal(await signedIn(`Bearer ${pass}`, SECRET, NOW + (SESSION_SECONDS - 1) * 1000), true);
  assert.equal(await signedIn(`Bearer ${pass}`, SECRET, NOW + SESSION_SECONDS * 1000), false);
});

test('a pass is refused when forged, changed, signed with another secret or missing', async () => {
  const pass = await makePass(SECRET, NOW);
  const [until, signature] = pass.split('.');
  assert.equal(await signedIn(`Bearer ${Number(until) + 999999}.${signature}`, SECRET, NOW), false);
  assert.equal(await signedIn(`Bearer ${until}.${'0'.repeat(signature.length)}`, SECRET, NOW), false);
  assert.equal(await signedIn(`Bearer ${pass}`, 'another-secret', NOW), false);
  assert.equal(await signedIn('Bearer ', SECRET, NOW), false);
  assert.equal(await signedIn(null, SECRET, NOW), false);
  assert.equal(await signedIn(`Bearer ${pass}`, undefined, NOW), false);
});

test('only the right password logs in, and an unset one lets nobody in', async () => {
  assert.equal(await rightPassword('correct horse', 'correct horse'), true);
  assert.equal(await rightPassword('correct hors', 'correct horse'), false);
  assert.equal(await rightPassword('', ''), false);
  assert.equal(await rightPassword('anything', undefined), false);
  assert.equal(await rightPassword(42, 'correct horse'), false);
});

test('the Worker answers its own page, the site and laptop previews, and no other site', () => {
  const from = (origin) => new Request('https://jacks-space-now.jacklee981229.workers.dev/api/save', { method: 'POST', headers: origin ? { Origin: origin } : {} });
  assert.equal(allowedOrigin(from('https://jacks-space-now.jacklee981229.workers.dev')), 'https://jacks-space-now.jacklee981229.workers.dev');
  assert.equal(allowedOrigin(from('https://jacklee981229.github.io')), 'https://jacklee981229.github.io');
  assert.equal(allowedOrigin(from('http://127.0.0.1:4602')), 'http://127.0.0.1:4602');
  assert.equal(allowedOrigin(from('https://evil.example')), null);
  assert.equal(allowedOrigin(from('https://jacklee981229.github.io.evil.example')), null);
  assert.equal(allowedOrigin(from(null)), null);
});

test('now.md keeps its top comment exactly; the editor gets and gives only what is under it', () => {
  const file = '<!-- One line per item, like "- 🎮 Playing: Shape of Dreams". -->\n- Getting ready for a week in Yunnan ✈\n';
  const { head, body } = splitNow(file);
  assert.equal(head, '<!-- One line per item, like "- 🎮 Playing: Shape of Dreams". -->\n');
  assert.equal(body, '- Getting ready for a week in Yunnan ✈');
  assert.equal(joinNow(head, body), file);
  assert.equal(joinNow(head, '\r\n- 🎮 Playing: Chess\r\n- Reading: a book  \r\n\r\n'), `${head}- 🎮 Playing: Chess\n- Reading: a book\n`);
  assert.deepEqual(splitNow('- No comment\n'), { head: '', body: '- No comment' });
});

test('emoji and accents survive the trip through base64 both ways', () => {
  const text = '- 🎮 Playing: Shape of Dreams\n- ✈️ Visiting: Yunnan 云南, café\n';
  assert.equal(fromBase64(toBase64(text)), text);
  // GitHub wraps its base64 over lines.
  const wrapped = toBase64(text).replace(/(.{20})/g, '$1\n');
  assert.equal(fromBase64(wrapped), text);
});

test("Claude's answer becomes the editor's lines, and anything else is turned away", () => {
  assert.equal(tidiedText({ items: ['🎮 Playing: Shape of Dreams', '- ✈️ Visiting: Yunnan'] }), '- 🎮 Playing: Shape of Dreams\n- ✈️ Visiting: Yunnan');
  assert.equal(tidiedText({ items: ['  🛠️ Building:   a  tool '] }), '- 🛠️ Building: a tool');
  assert.equal(tidiedText({ items: [] }), null);
  assert.equal(tidiedText({ items: ['', '  '] }), null);
  assert.equal(tidiedText({ lines: ['🎮 Playing: Chess'] }), null);
  assert.equal(tidiedText(null), null);
});

test('the palette reads /now, /now login and nothing else as the command', () => {
  assert.deepEqual(readNowCommand('/now Visiting Yunnan ✈'), { words: 'Visiting Yunnan ✈' });
  assert.deepEqual(readNowCommand('  /NOW   Playing chess  '), { words: 'Playing chess' });
  assert.deepEqual(readNowCommand('/now'), { words: '' });
  assert.deepEqual(readNowCommand('/now login'), { login: true });
  assert.deepEqual(readNowCommand('/now Login'), { login: true });
  assert.deepEqual(readNowCommand('/now login to the castle'), { words: 'login to the castle' });
  assert.equal(readNowCommand('/nowhere'), null);
  assert.equal(readNowCommand('now playing'), null);
});

test("the editor's lines show as one line in the palette", () => {
  assert.equal(oneLine('- 🎮 Playing: Chess\n- ✈️ Visiting: Yunnan'), '🎮 Playing: Chess · ✈️ Visiting: Yunnan');
  assert.equal(oneLine('- Only one'), 'Only one');
});
