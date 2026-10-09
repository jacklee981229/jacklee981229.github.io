import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLog, cellsOf, foldersOf, malaysiaTime, partOf, PARTS, readGitLog } from '../src/lib/build-log.js';

const part = (path) => PARTS[partOf(path)];
/** Unix seconds for a UTC moment. */
const utc = (y, m, d, h, min = 0) => Date.UTC(y, m - 1, d, h, min) / 1000;

test('each changed file belongs to a part of the site, the rest to home', () => {
  assert.equal(part('src/content/posts/10/index.md'), 'writing');
  assert.equal(part('src/content/posts/10/terraria.png'), 'writing');
  assert.equal(part('src/pages/[slug].astro'), 'writing');
  assert.equal(part('src/components/PostCard.astro'), 'writing');
  // The games are posts, but they're the Lab's.
  assert.equal(part('src/content/posts/2048/index.md'), 'lab');
  assert.equal(part('src/content/posts/catch-the-cat/cover.png'), 'lab');
  assert.equal(part('src/games/blocks/game.js'), 'lab');
  assert.equal(part('public/games/2048/game.js'), 'lab');
  assert.equal(part('src/components/LabItemCard.astro'), 'lab');
  assert.equal(part('src/pages/lab/world/[slug].astro'), 'lab');
  assert.equal(part('tests/lab-tools.test.js'), 'lab');
  assert.equal(part('tests/blocks.test.js'), 'lab');
  assert.equal(part('src/content/collections/movies/index.yaml'), 'collection');
  assert.equal(part('src/lib/shelves.js'), 'collection');
  assert.equal(part('src/lib/travel/globe.js'), 'travel');
  assert.equal(part('src/content/travel/visited.yaml'), 'travel');
  assert.equal(part('src/pages/about.astro'), 'about');
  assert.equal(part('src/components/ProfileLinks.astro'), 'about');
  // Astro's "collections" are the posts, not the Collection page.
  assert.equal(part('src/lib/collections.ts'), 'home');
  assert.equal(part('src/styles/tokens.css'), 'home');
  assert.equal(part('src/pages/index.astro'), 'home');
  assert.equal(part('package.json'), 'home');
});

test("git's list of commits and files reads oldest first, with a picture's lines as none", () => {
  const log = ['@1791559684\t4ee59f3\tLab - rework on few items', '', '4\t0\tastro.config.mjs', '-\t-\tsrc/assets/worlds/pond.png', '@1791500000\t101d355\tLab - QR\tCode', '', '12\t3\tsrc/lib/home.js', ''].join('\n');
  assert.deepEqual(readGitLog(log), [
    { at: 1791500000, hash: '101d355', subject: 'Lab - QR\tCode', files: [{ path: 'src/lib/home.js', added: 12, removed: 3 }] },
    { at: 1791559684, hash: '4ee59f3', subject: 'Lab - rework on few items', files: [{ path: 'astro.config.mjs', added: 4, removed: 0 }, { path: 'src/assets/worlds/pond.png', added: 0, removed: 0 }] },
  ]);
  assert.deepEqual(readGitLog('@1\tabc\tFix\r\n\r\n1\t1\ta b.md\r\n'), [{ at: 1, hash: 'abc', subject: 'Fix', files: [{ path: 'a b.md', added: 1, removed: 1 }] }]);
  assert.deepEqual(readGitLog(''), []);
});

test('commit times are told in Malaysia, eight hours ahead of the UTC the site is built in', () => {
  // 17:12 UTC on 7 Oct is 01:12 on 8 Oct in Malaysia.
  assert.deepEqual(malaysiaTime(utc(2026, 10, 7, 17, 12)), { day: '2026-10-08', hour: 1, time: '01:12' });
  assert.deepEqual(malaysiaTime(utc(2026, 9, 27, 15, 59)), { day: '2026-09-27', hour: 23, time: '23:59' });
  assert.deepEqual(malaysiaTime(utc(2026, 9, 27, 16, 0)), { day: '2026-09-28', hour: 0, time: '00:00' });
});

test('one spike a file, until there are too many: then one stands for several, with all their lines, in the colour most of them have', () => {
  const file = (part, lines = 1) => ({ part, lines });
  const commits = [{ files: [file(1, 5), file(1), file(2)] }, { files: [] }, { files: [file(2), file(2), file(3), file(0), file(0), file(0), file(0, 9)] }];
  assert.deepEqual(cellsOf(commits, 100), { per: 1, cells: [[1, 5], [1, 1], [2, 1], [2, 1], [2, 1], [3, 1], [0, 1], [0, 1], [0, 1], [0, 9]].map(([p, lines], i) => ({ part: p, lines, commit: i < 3 ? 0 : 2 })) });
  const squeezed = cellsOf(commits, 4);
  assert.equal(squeezed.per, 3);
  assert.deepEqual(squeezed.cells, [{ part: 1, lines: 7, commit: 0 }, { part: 2, lines: 3, commit: 2 }, { part: 0, lines: 3, commit: 2 }, { part: 0, lines: 9, commit: 2 }]);
  assert.deepEqual(cellsOf([], 10), { per: 1, cells: [] });
});

test("the repo's folders, three levels down, with their changes and their main part", () => {
  const folders = foldersOf(['src/lib/lab/tools.js', 'src/lib/lab/qr.js', 'src/lib/home.js', 'src/lib/lab/deep/x.js', 'package.json', 'astro.config.mjs']);
  assert.deepEqual(new Map(folders.map(([path, n, main]) => [path, [n, PARTS[main]]])), new Map([
    ['src', [4, 'lab']],
    ['src/lib', [4, 'lab']],
    ['src/lib/lab', [3, 'lab']],
    ['(root)', [2, 'home']],
  ]));
});

test('the numbers the page shows', () => {
  const log = buildLog({
    commits: [
      { at: utc(2026, 9, 26, 14, 0), hash: 'a1', subject: 'Site - rebuilt', files: [{ path: 'src/pages/index.astro', added: 100, removed: 0 }, { path: 'src/content/posts/1/index.md', added: 20, removed: 0 }] },
      { at: utc(2026, 10, 7, 17, 12), hash: 'b2', subject: 'Lab - Snake', files: [{ path: 'src/games/snake/game.js', added: 30, removed: 5 }, { path: 'src/games/snake/rules.js', added: 10, removed: 2 }] },
      { at: utc(2026, 10, 7, 18, 30), hash: 'c3', subject: 'Travel - map', files: [{ path: 'src/lib/travel/map.js', added: 1, removed: 1 }] },
    ],
    changes: [
      { day: '2026-10-08', kind: 'new', text: 'Added [Snake](/lab/game/snake/)' },
      { day: '2026-09-26', kind: 'new', text: 'Rebuilt the site' },
      { day: '2026-09-26', kind: 'fix', text: 'Fixed a typo' },
    ],
    lab: { tools: 10, games: 4, effects: 18, worlds: 3 },
    visits: 73,
    today: '2026-10-10',
    started: '2023-02-23',
    rebuilt: '2026-09-26',
  });
  assert.deepEqual(log.cells.map((p) => PARTS[p]), ['home', 'writing', 'lab', 'lab', 'travel']);
  assert.deepEqual(log.sizes, [100, 20, 35, 12, 2]);
  assert.deepEqual(log.files, [1, 1, 2, 0, 1, 0]);
  // The first commit touched Home and Writing once each: Writing, which has a colour, wins.
  assert.deepEqual(log.commits.map((c) => [c.hash, c.subject, c.day, c.time, PARTS[c.main], c.cells, c.added, c.removed]), [
    ['a1', 'Site - rebuilt', '2026-09-26', '22:00', 'writing', 2, 120, 0],
    ['b2', 'Lab - Snake', '2026-10-08', '01:12', 'lab', 2, 40, 7],
    ['c3', 'Travel - map', '2026-10-08', '02:30', 'travel', 1, 1, 1],
  ]);
  assert.deepEqual(log.span, [Date.parse('2026-09-26T00:00:00+08:00') / 1000, Date.parse('2026-10-11T00:00:00+08:00') / 1000]);
  assert.deepEqual(log.totals, { commits: 3, changes: 5, added: 161, removed: 8, days: 15, afterMidnight: 2, busiestHour: 1, busiestDay: { day: '2026-10-08', commits: 2 } });
  assert.equal(log.folders.find(([path]) => path === 'src/games/snake')?.[1], 2);
  assert.deepEqual(log.changelog, { lines: 3, kinds: { new: 2, improved: 0, design: 0, fix: 1 } });
  assert.equal(log.visits, 73);
});
