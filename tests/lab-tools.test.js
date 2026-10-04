import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { EFFECTS, effectBySlug, effectUrl, EXPERIMENTS, GROUPS, moreLabItems, TOOLS, toolBySlug, toolUrl } from '../src/lib/lab/tools.js';
import { RESERVED_SLUGS } from '../src/lib/posts.js';

const ROOT = new URL('../', import.meta.url);
const icons = readFileSync(new URL('src/lib/icons.js', ROOT), 'utf8');

test('every tool has a unique, web-safe address and a unique name', () => {
  assert.equal(new Set(TOOLS.map((t) => t.slug)).size, TOOLS.length);
  assert.equal(new Set(TOOLS.map((t) => t.name)).size, TOOLS.length);
  TOOLS.forEach((t) => assert.match(t.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, t.slug));
  assert.equal(toolUrl('count-words'), '/lab/count-words/');
});

test('every tool has a known group, status, icon and a two-line example', () => {
  const groups = GROUPS.map((g) => g.id);
  for (const t of TOOLS) {
    assert.ok(groups.includes(t.group), `${t.slug}: group ${t.group}`);
    assert.ok(['ready', 'soon'].includes(t.status), `${t.slug}: status ${t.status}`);
    assert.match(icons, new RegExp(`^\\s+'?${t.icon}'?: '`, 'm'), `${t.slug}: icon "${t.icon}" is missing from src/lib/icons.js`);
    assert.equal(t.example.length, 2, t.slug);
    assert.ok(t.description.length <= 70, `${t.slug}: keep the description to one short line`);
  }
});

test('a ready tool has its page, and a tool still to come has none yet', () => {
  for (const t of TOOLS) {
    const page = existsSync(new URL(`src/pages/lab/${t.slug}.astro`, ROOT));
    assert.equal(page, t.status === 'ready', `${t.slug} is ${t.status} but its page ${page ? 'exists' : 'is missing'}`);
  }
});

test('experiments are existing posts that stay hidden elsewhere', () => {
  for (const id of EXPERIMENTS) {
    const file = new URL(`src/content/posts/${id}/index.md`, ROOT);
    assert.ok(existsSync(file), `${id} is missing`);
    assert.match(readFileSync(file, 'utf8'), /^hidden: true$/m, `${id} should stay hidden outside the Lab`);
  }
});

test('"check these too" under a Lab page: same kind first, ready tools only, never the page itself, at most 4', () => {
  const ready = TOOLS.filter((t) => t.status === 'ready').map((t) => t.slug);
  const underTool = moreLabItems(ready[0]);
  assert.ok(underTool.length <= 4 && underTool.length > 0);
  assert.ok(underTool.every((i) => i.id !== ready[0] && (i.kind === 'experiment' || ready.includes(i.id))));
  assert.equal(underTool[0].kind, 'tool');
  const underGame = moreLabItems(EXPERIMENTS[0]);
  assert.deepEqual(underGame[0], { kind: 'experiment', id: EXPERIMENTS[1] });
  assert.ok(underGame.every((i) => i.id !== EXPERIMENTS[0]));
  assert.equal(new Set(underGame.map((i) => i.id)).size, underGame.length);
});

test('the Lab addresses are kept from posts', () => {
  assert.ok(RESERVED_SLUGS.includes('lab') && RESERVED_SLUGS.includes('random'));
  assert.throws(() => toolBySlug('no-such-tool'), /No Lab tool "no-such-tool"/);
});

test('every effect has its code, its card picture, its icon and a web-safe address no other Lab item uses', () => {
  const cover = readFileSync(new URL('src/components/EffectCover.astro', ROOT), 'utf8');
  const taken = [...TOOLS.map((t) => t.slug), ...EXPERIMENTS];
  assert.equal(new Set(EFFECTS.map((e) => e.slug)).size, EFFECTS.length);
  assert.equal(new Set(EFFECTS.map((e) => e.name)).size, EFFECTS.length);
  for (const e of EFFECTS) {
    assert.match(e.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, e.slug);
    assert.ok(!taken.includes(e.slug), `${e.slug} is also a tool or a game`);
    assert.ok(existsSync(new URL(`src/effects/${e.slug}.js`, ROOT)), `${e.slug}: src/effects/${e.slug}.js is missing`);
    assert.ok(cover.includes(`slug === '${e.slug}'`), `${e.slug}: no picture in EffectCover.astro`);
    assert.ok(e.description.length <= 70 && e.hint.length <= 70, `${e.slug}: keep the description and the hint short`);
  }
  assert.match(icons, /^\s+pointer: '/m, 'the "pointer" icon is missing from src/lib/icons.js');
  assert.equal(effectUrl('dot-grid'), '/lab/effect/dot-grid/');
  assert.equal(effectBySlug('dot-grid').name, 'Dot Grid');
  assert.throws(() => effectBySlug('no-such-thing'), /No effect "no-such-thing"/);
});

test('no tool takes the address the games or the effects live under', () => {
  TOOLS.forEach((t) => assert.ok(!['game', 'effect'].includes(t.slug), t.slug));
});

test('"check these too" under an effect: other effects first, never itself', () => {
  const under = moreLabItems(EFFECTS[0].slug);
  assert.equal(under.length, 4);
  assert.ok(under.every((i) => i.kind === 'effect' && i.id !== EFFECTS[0].slug));
  // A game's and a tool's own kind still come first; effects only fill what's left.
  assert.equal(moreLabItems(EXPERIMENTS[0])[0].kind, 'experiment');
  assert.equal(moreLabItems(TOOLS.find((t) => t.status === 'ready').slug)[0].kind, 'tool');
});
