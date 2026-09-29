import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { EXPERIMENTS, GROUPS, TOOLS, toolBySlug, toolUrl } from '../src/lib/lab/tools.js';
import { RESERVED_SLUGS } from '../src/lib/posts.js';

const ROOT = new URL('../', import.meta.url);
const icons = readFileSync(new URL('src/components/Icon.astro', ROOT), 'utf8');

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
    assert.match(icons, new RegExp(`^\\s+'?${t.icon}'?: '`, 'm'), `${t.slug}: icon "${t.icon}" is missing from Icon.astro`);
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

test('the Lab addresses are kept from posts', () => {
  assert.ok(RESERVED_SLUGS.includes('lab') && RESERVED_SLUGS.includes('random'));
  assert.throws(() => toolBySlug('no-such-tool'), /No Lab tool "no-such-tool"/);
});
