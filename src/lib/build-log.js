// Jack's Build Log (/build-log/): the site's own history in numbers, for its page to draw. Worked out while the site is
// built, from what build-log-file.js reads: the commits (git), the Changelog, the Lab's lists and the visit counter.
import { EXPERIMENTS } from './lab/tools.js';

/** The parts a change can belong to, the menu's (NAV in site.ts): Home is the home page and the frame every page shares. */
export const PARTS = ['home', 'writing', 'lab', 'collection', 'travel', 'about'];
const HOME = PARTS.indexOf('home');

/** Past this many changed files, one spike on the clock stands for several in a row, so the drawing stays quick. */
export const MAX_CELLS = 2400;

// Which part a changed file belongs to: the first rule its path matches. The games are posts too, so their folders go
// to the Lab before the rest of the posts go to Writing. src/lib/collections.ts reads the posts (Astro's "collections"),
// so it's no rule's: it belongs to the frame.
const RULES = [
  ['lab', new RegExp(`^src/content/posts/(${EXPERIMENTS.join('|')})/`)],
  ['lab', /^(src\/(pages\/lab|lib\/lab|lib\/town|lib\/trains|effects|games|worlds|assets\/worlds|components\/games)|public\/games)\//],
  ['lab', /^src\/(components\/(Lab|Effect|World|ToolShell|PreviewTool|TextConverter|HomeToy)[^/]*|styles\/lab\.css)$/],
  ['lab', /^tests\/(lab-|blocks|snake|catch-the-cat|game-2048|key-jam|town|trains|leaderboard|exact-time)/],
  ['writing', /^src\/(content\/posts|pages\/tags|pages\/page)\//],
  ['writing', /^src\/(pages\/(writing|tags|archives|\[slug\])\.astro|pages\/atom\.xml\.ts|lib\/(posts|topics)\.js|components\/(Post[^/]*|Toc|TopicLegend|TagCloud)\.astro|styles\/prose\.css)$/],
  ['writing', /^(scripts\/new-post|\.claude\/skills\/new-post\/|tests\/(posts|topics)\.)/],
  ['collection', /^(src\/(content\/collections\/|pages\/collections\.astro$|lib\/shel)|tests\/shelves\.)/],
  ['travel', /^(src\/(pages\/travel\.astro$|lib\/travel\/|content\/travel\/)|tests\/travel\.)/],
  ['about', /^src\/(pages\/about\.astro|content\/pages\/about\.md|components\/(Profile[^/]*|ChangelogMonth)\.astro)$/],
].map(([part, rule]) => /** @type {[number, RegExp]} */ ([PARTS.indexOf(/** @type {string} */ (part)), rule]));

/** The part a file belongs to, as its place in PARTS. @param {string} path from the repo's root, with forward slashes */
export const partOf = (path) => RULES.find(([, rule]) => rule.test(path))?.[0] ?? HOME;

/**
 * The commits, oldest first, from `git log --no-merges --no-renames --numstat --format=@%at%x09%h%x09%s`: each one's
 * time (Unix seconds), short hash and subject, and the files it changed, with their lines added and removed (none for a
 * picture or another binary file).
 * @param {string} text
 * @returns {{ at: number, hash: string, subject: string, files: { path: string, added: number, removed: number }[] }[]}
 */
export function readGitLog(text) {
  /** @type {{ at: number, hash: string, subject: string, files: { path: string, added: number, removed: number }[] }[]} */
  const commits = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('@')) {
      const [at, hash = '', ...subject] = line.slice(1).split('\t');
      commits.push({ at: Number(at), hash, subject: subject.join('\t'), files: [] });
    } else if (line.trim() && commits.length) {
      const [added, removed, ...path] = line.split('\t');
      commits[commits.length - 1].files.push({ path: path.join('\t'), added: Number(added) || 0, removed: Number(removed) || 0 });
    }
  }
  return commits.reverse();
}

/**
 * When a commit was made, in Malaysia, where Jack works: the build runs in UTC, and Malaysia has no summer time, so it's
 * always eight hours ahead.
 * @param {number} at Unix seconds
 */
export function malaysiaTime(at) {
  const local = new Date((at + 8 * 3600) * 1000);
  const hour = local.getUTCHours();
  const minute = local.getUTCMinutes();
  return { day: local.toISOString().slice(0, 10), hour, time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

/** Unix seconds at the start of a day in Malaysia. @param {string} day YYYY-MM-DD */
const dayStart = (day) => Date.parse(`${day}T00:00:00+08:00`) / 1000;

/** Where the biggest number is (the first, on a tie). @param {number[]} numbers */
const biggest = (numbers) => numbers.reduce((best, n, i) => (n > numbers[best] ? i : best), 0);

/**
 * The clock's spikes, in order: one for each changed file, in its part's colour, with its lines. Past `max` files, each
 * stands for `per` of them in a row, with all their lines and the colour most of them have. Each also says which
 * commit finished it.
 * @param {{ files: { part: number, lines: number }[] }[]} commits oldest first
 * @param {number} [max]
 */
export function cellsOf(commits, max = MAX_CELLS) {
  const changes = commits.flatMap((commit, index) => commit.files.map((file) => ({ ...file, commit: index })));
  const per = Math.max(1, Math.ceil(changes.length / max));
  /** @type {{ part: number, lines: number, commit: number }[]} */
  const cells = [];
  for (let i = 0; i < changes.length; i += per) {
    const group = changes.slice(i, i + per);
    const counts = PARTS.map(() => 0);
    for (const change of group) counts[change.part]++;
    cells.push({ part: biggest(counts), lines: group.reduce((sum, change) => sum + change.lines, 0), commit: group[group.length - 1].commit });
  }
  return { per, cells };
}

/**
 * The repo's folders, three levels deep, each as [path, its file changes, the part most of them were]: the flame along
 * the poster's foot. Files at the top of the repo count as "(root)".
 * @param {string[]} paths every file change's path
 * @returns {[string, number, number][]}
 */
export function foldersOf(paths) {
  /** @type {Map<string, number[]>} */
  const folders = new Map();
  for (const path of paths) {
    const segments = path.split('/').slice(0, -1);
    const keys = segments.length ? segments.slice(0, 3).map((_, i) => segments.slice(0, i + 1).join('/')) : ['(root)'];
    for (const key of keys) {
      const parts = folders.get(key) ?? PARTS.map(() => 0);
      parts[partOf(path)]++;
      folders.set(key, parts);
    }
  }
  return [...folders].map(([path, parts]) => [path, parts.reduce((a, b) => a + b, 0), biggest(parts)]);
}

/**
 * Everything the Build Log shows.
 * @param {{
 *   commits: { at: number, hash: string, subject: string, files: { path: string, added: number, removed: number }[] }[],
 *   changes: { day: string, kind: string, text: string }[],
 *   lab: { tools: number, games: number, effects: number, worlds: number },
 *   visits: number | null,
 *   today: string,
 *   started: string,
 *   rebuilt: string,
 *   maxCells?: number,
 * }} input `commits` oldest first, `changes` newest first (readChangelog), `today` the Malaysia day it's built
 */
export function buildLog({ commits, changes, lab, visits, today, started, rebuilt, maxCells = MAX_CELLS }) {
  const played = commits.map((commit) => {
    const files = commit.files.map((file) => ({ part: partOf(file.path), lines: file.added + file.removed }));
    const parts = PARTS.map((_, part) => files.filter((f) => f.part === part).length);
    // The part it touched most: one of the five with a colour of their own wins a tie with Home.
    const named = parts.map((n, part) => (part === HOME ? -1 : n));
    const top = biggest(named);
    return {
      at: commit.at,
      hash: commit.hash,
      subject: commit.subject,
      ...malaysiaTime(commit.at),
      files,
      main: named[top] > 0 && named[top] >= parts[HOME] ? top : HOME,
      added: commit.files.reduce((sum, file) => sum + file.added, 0),
      removed: commit.files.reduce((sum, file) => sum + file.removed, 0),
    };
  });
  const { per, cells } = cellsOf(played, maxCells);

  const hours = Array.from({ length: 24 }, () => 0);
  /** @type {Map<string, number>} */
  const days = new Map();
  for (const commit of played) {
    hours[commit.hour]++;
    days.set(commit.day, (days.get(commit.day) ?? 0) + 1);
  }
  const busiestDay = [...days].reduce((best, entry) => (entry[1] > best[1] ? entry : best), ['', 0]);
  const kinds = { new: 0, improved: 0, design: 0, fix: 0 };
  for (const change of changes) if (Object.hasOwn(kinds, change.kind)) kinds[/** @type {keyof typeof kinds} */ (change.kind)]++;

  return {
    updated: today,
    started,
    rebuilt,
    per,
    cells: cells.map((cell) => cell.part),
    sizes: cells.map((cell) => cell.lines),
    commits: played.map(({ files, ...commit }, index) => ({ ...commit, cells: cells.filter((cell) => cell.commit === index).length })),
    // The days the clock's rings stand for: from the start of the first commit's day to the end of the day it's built.
    span: played.length ? [dayStart(played[0].day), dayStart(today) + 86400] : [dayStart(today), dayStart(today) + 86400],
    files: PARTS.map((_, part) => played.reduce((sum, commit) => sum + commit.files.filter((f) => f.part === part).length, 0)),
    folders: foldersOf(commits.flatMap((commit) => commit.files.map((file) => file.path))),
    totals: {
      commits: played.length,
      changes: played.reduce((sum, commit) => sum + commit.files.length, 0),
      added: played.reduce((sum, commit) => sum + commit.added, 0),
      removed: played.reduce((sum, commit) => sum + commit.removed, 0),
      days: Math.round((dayStart(today) - dayStart(rebuilt)) / 86400) + 1,
      afterMidnight: played.filter((commit) => commit.hour < 4).length,
      busiestHour: biggest(hours),
      busiestDay: { day: busiestDay[0], commits: busiestDay[1] },
    },
    changelog: { lines: changes.length, kinds },
    lab,
    visits,
  };
}
