// The Now editor Worker's rules (workers/now/now-editor.js) and the palette's /now (src/lib/now-command.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_SECONDS, allowedOrigin, fromBase64, joinNow, makePass, rightPassword, signedIn, splitNow, tidied, toBase64 } from '../workers/now/now-editor.js';
import { bestMatch, isSteamPicture, picturesOf } from '../workers/now/pictures.js';
import { pictureFile } from '../src/lib/now.js';
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
  const lines = (...items) => ({ items: items.map((line) => ({ line, game: '' })) });
  const text = (answer) => tidied(answer)?.text ?? null;
  assert.equal(text(lines('🎮 Playing: Shape of Dreams', '- ✈️ Visiting: Yunnan')), '- 🎮 Playing: Shape of Dreams\n- ✈️ Visiting: Yunnan');
  assert.equal(text(lines('  🛠️ Building:   a  tool ')), '- 🛠️ Building: a tool');
  assert.equal(text(lines('🛠️ Building: Media Studio — An app for my photos. Videos too')), '- 🛠️ Building: Media Studio — An app for my photos. Videos too');
  assert.equal(text({ items: [] }), null);
  assert.equal(text(lines('', '  ')), null);
  assert.equal(text({ items: ['🎮 Playing: Chess'] }), null);
  assert.equal(text({ lines: ['🎮 Playing: Chess'] }), null);
  assert.equal(text(null), null);
});

test('the first item that names a game is the one offered pictures, counted after empty lines are dropped', () => {
  const answer = { items: [{ line: '', game: '' }, { line: '😌 Chilling and resting', game: '' }, { line: '🎮 Playing: [Phantom Blade Zero](https://example.com) — Slow going', game: ' Phantom  Blade Zero ' }, { line: '🎮 Playing: Dota 2', game: 'Dota 2' }] };
  assert.deepEqual(tidied(answer), {
    text: '- 😌 Chilling and resting\n- 🎮 Playing: [Phantom Blade Zero](https://example.com) — Slow going\n- 🎮 Playing: Dota 2',
    game: { line: 1, name: 'Phantom Blade Zero', value: 'Phantom Blade Zero' },
  });
  assert.equal(tidied({ items: [{ line: '😌 Chilling', game: '' }] })?.game, null);
  assert.equal(tidied({ items: [{ line: '😌 Chilling' }] })?.game, null);
});

test("a picture is named after the thing it's for, the same however it's written", () => {
  assert.equal(pictureFile('Phantom Blade Zero'), 'phantom-blade-zero.jpg');
  assert.equal(pictureFile('[Black Myth: Wukong](https://example.com)'), 'black-myth-wukong.jpg');
  assert.equal(pictureFile('  ELDEN RING™ '), 'elden-ring.jpg');
  assert.equal(pictureFile('黑神话：悟空'), '黑神话-悟空.jpg');
  assert.equal(pictureFile('!!'), '');
});

test("Steam's search answer gives the game itself, before its soundtrack and add-ons", () => {
  const items = [
    { type: 'app', name: 'Phantom Blade Zero Deluxe Edition Upgrade', id: 5041150 },
    { type: 'app', name: 'Phantom Blade Zero', id: 4115450 },
  ];
  assert.equal(bestMatch(items, 'phantom blade zero')?.id, 4115450);
  assert.equal(bestMatch(items, 'Phantom Blade')?.id, 5041150);
  assert.equal(bestMatch([{ type: 'sub', name: 'A', id: 1 }], 'A'), null);
  assert.equal(bestMatch(undefined, 'A'), null);
});

test("a store item's pictures are its poster, its tall art and a small copy of its first screenshot", () => {
  const item = {
    assets: { asset_url_format: 'steam/apps/1/${FILENAME}?t=9', library_capsule: 'ab/library_capsule.jpg', hero_capsule: 'cd/hero_capsule.jpg' },
    screenshots: { all_ages_screenshots: [{ filename: 'steam/apps/1/ef/ss_ef.jpg?t=9' }] },
  };
  const base = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1/';
  assert.deepEqual(picturesOf(item), [`${base}ab/library_capsule.jpg?t=9`, `${base}cd/hero_capsule.jpg?t=9`, `${base}ef/ss_ef.600x338.jpg?t=9`]);
  assert.deepEqual(picturesOf({ assets: { asset_url_format: 'steam/apps/1/${FILENAME}', hero_capsule: 'h.jpg' } }), [`${base}h.jpg`]);
  assert.deepEqual(picturesOf({}), []);
  for (const address of picturesOf(item)) assert.ok(isSteamPicture(address));
});

test('a save takes pictures only from Steam', () => {
  assert.ok(isSteamPicture('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/570/library_capsule.jpg?t=1'));
  assert.equal(isSteamPicture('http://shared.akamai.steamstatic.com/store_item_assets/steam/apps/570/library_capsule.jpg'), false);
  assert.equal(isSteamPicture('https://example.com/store_item_assets/steam/apps/570/a.jpg'), false);
  assert.equal(isSteamPicture('https://shared.akamai.steamstatic.com/other/a.jpg'), false);
  assert.equal(isSteamPicture('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/570/a.png'), false);
  assert.equal(isSteamPicture('not an address'), false);
  assert.equal(isSteamPicture(undefined), false);
});

test('the palette reads /now, /login, /logout and nothing else as a command', () => {
  assert.deepEqual(readNowCommand('/now Visiting Yunnan ✈'), { words: 'Visiting Yunnan ✈' });
  assert.deepEqual(readNowCommand('  /NOW   Playing chess  '), { words: 'Playing chess' });
  assert.deepEqual(readNowCommand('/now'), { words: '' });
  assert.deepEqual(readNowCommand('/login'), { login: true });
  assert.deepEqual(readNowCommand('  /Login '), { login: true });
  assert.deepEqual(readNowCommand('/logout'), { logout: true });
  assert.deepEqual(readNowCommand('/LOGOUT'), { logout: true });
  assert.deepEqual(readNowCommand('/now login'), { words: 'login' });
  assert.equal(readNowCommand('/log'), null);
  assert.equal(readNowCommand('/login now'), null);
  assert.equal(readNowCommand('/nowhere'), null);
  assert.equal(readNowCommand('now playing'), null);
});

test("the editor's lines show as one line in the palette", () => {
  assert.equal(oneLine('- 🎮 Playing: Chess\n- ✈️ Visiting: Yunnan'), '🎮 Playing: Chess · ✈️ Visiting: Yunnan');
  assert.equal(oneLine('- Only one'), 'Only one');
});
