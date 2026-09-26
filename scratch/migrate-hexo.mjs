// One-off (Task 5): copy the old Hexo posts, About page, game scripts and avatar out of the backup repo.
// Safe to re-run: it rewrites only what it migrates. Run from the project folder: node scratch/migrate-hexo.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GIT_DIR = 'C:/repos/Jack/old-hexo-site-backup.git';
const BRANCH = 'butterfly';
const read = (path) => execFileSync('git', [`--git-dir=${GIT_DIR}`, 'show', `${BRANCH}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
const readText = (path) => read(path).toString('utf8').replace(/\r\n/g, '\n');

// Old post file -> its topic (and cover, where the first image isn't the best one).
// arsenal.md and test-css.md are not here: both were dropped.
const POSTS = {
  'Flutter-Get-Started.md': { topic: 'flutter', cover: 'flutter_first_app_showcase.png' },
  'Terraria.md': { topic: 'games' },
  'talk-about-hexo-admin.md': { topic: 'hexo' },
  'a-game-named-dont-starve.md': { topic: 'games' },
  'chatgpt-useful-prompts.md': { topic: 'chatgpt' },
  'theme-modification-1-loading-screen.md': { topic: 'hexo' },
  'chatgpt-extensions.md': { topic: 'chatgpt' },
  'why-i-switch-theme.md': { topic: 'hexo' },
  'git-commands.md': { topic: 'git' },
  'inject-scripts.md': { topic: 'hexo' },
  'click-effect-tutorial.md': { topic: 'hexo' },
  'heart-js.md': { topic: 'hexo' },
  'hexo-default-page-tutorial.md': { topic: 'hexo' },
  'hexo-documentation.md': { topic: 'hexo' },
  '2048.md': { topic: 'games' },
  'catch-cat.md': { topic: 'games' },
};

// Hand fixes where Hexo's lenient Markdown and standard Markdown disagree, found by comparing each post with the live site.
const FIXES = {
  // Hexo put these 2-space-indented code blocks inside their list items; standard Markdown needs them indented to the item's text.
  2: [
    ["  ```yml\n    index_generator:\n      path: ''\n      per_page: 10\n      order_by: -date\n  ```",
      "  ```yml\n  index_generator:\n    path: ''\n    per_page: 10\n    order_by: -date\n  ```"],
    ["  - Go to file `_config.yml`, find these lines:\n  ```yml\n      index_generator:\n        path: ''\n        per_page: 10\n        order_by: -date\n  ```",
      "  - Go to file `_config.yml`, find these lines:\n    ```yml\n    index_generator:\n      path: ''\n      per_page: 10\n      order_by: -date\n    ```"],
    ["  - Edit value in `path`, for example I change to follow:\n  ```yml\n      index_generator:\n        path: 'blog'\n        per_page: 10\n        order_by: -date\n  ```",
      "  - Edit value in `path`, for example I change to follow:\n    ```yml\n    index_generator:\n      path: 'blog'\n      per_page: 10\n      order_by: -date\n    ```"],
  ],
  // The game is 570px wide: on phones its own box scrolls sideways instead of the whole page.
  game_2: [['<div style="text-align: center; width: 100%;" >', '<div style="text-align: center; width: 100%; overflow-x: auto;">']],
};

function applyFixes(id, body) {
  let out = body;
  for (const [from, to] of FIXES[id] ?? []) {
    if (!out.includes(from)) throw new Error(`${id}: fix no longer matches the source, check it by hand`);
    out = out.replace(from, to);
  }
  return out;
}

// Hexo allows front matter without the opening ---.
function splitFrontMatter(text) {
  const body = text.startsWith('---\n') ? text.slice(4) : text;
  const end = body.indexOf('\n---\n');
  if (end < 0) throw new Error('no front matter end');
  // CORE_SCHEMA keeps dates as text: Hexo wrote them in local (Malaysia) time without an offset.
  return { data: yaml.load(body.slice(0, end), { schema: yaml.CORE_SCHEMA }) ?? {}, body: body.slice(end + 5) };
}

const toIso = (hexoDate) => {
  const m = String(hexoDate).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/);
  if (!m) throw new Error(`unexpected date ${hexoDate}`);
  return `${m[1]}T${m[2].length === 5 ? `${m[2]}:00` : m[2]}+08:00`;
};

const tagsOf = (tags) => [...new Set((Array.isArray(tags) ? tags : tags ? [tags] : []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))];

const FENCE = /(^```[\s\S]*?^```[ \t]*$)/m;
// Apply fn to the text outside fenced code blocks only.
const outsideFences = (body, fn) => body.split(FENCE).map((part, i) => (i % 2 ? part : fn(part))).join('');

function convertBody(body, postDir, report) {
  // A lone <br> line was only spacing in Hexo; in standard Markdown it swallows the next line as raw text.
  let out = body.replace(/^<!--\s*more\s*-->\n?/gm, '').replace(/^<br\s*\/?>[ \t]*$/gm, '');

  // Images: /images/... (or images/...) -> copied beside the post, linked as ./file so Astro can resize them.
  out = out.replace(/!\[([^\]]*)\]\(\/?images\/([^)\s]+)\)/g, (_, alt, path) => {
    const file = decodeURI(path);
    writeFileSync(join(postDir, basename(file)), read(`source/images/${file}`));
    report.images.push(basename(file));
    return `![${alt}](./${basename(file)})`;
  });

  // Hexo code titles (```js Heart.js) -> ```js title="Heart.js", which the code frame shows.
  out = out.replace(/^```(\S+)[ \t]+([^\n=]+?)[ \t]*$/gm, (_, lang, title) => {
    report.titles.push(title);
    return `\`\`\`${lang} title="${title}"`;
  });

  // Butterfly note boxes -> plain quote blocks (whole text: a note may hold a code block).
  out = out.replace(/\{%\s*note[^%]*%\}\n?([\s\S]*?)\{%\s*endnote\s*%\}/g, (_, inner) => {
    report.notes += 1;
    return inner.trim().split('\n').map((line) => (line.trim() ? `> ${line}` : '>')).join('\n');
  });

  // The page title is the only h1, so a post that used # headings moves every heading down one level.
  report.shifted = /^# /m.test(out.split(FENCE).filter((_, i) => i % 2 === 0).join('\n'));

  out = outsideFences(out, (text) => {
    let t = text;
    if (report.shifted) t = t.replace(/^(#{1,5}) /gm, '#$1 ');
    // <iframe .../> is not self-closing in HTML: everything after it vanished inside the frame on the old site.
    t = t.replace(/<iframe([^>]*?)\s*\/>/g, (_, attrs) => {
      const clean = attrs.replace(/\s+style="[^"]*"/, '');
      return `<iframe${clean}${/\stitle=/.test(clean) ? '' : ' title="2048 game"'}></iframe>`;
    });
    return t.replace(/\/javascript\/catch-cat\//g, '/games/catch-the-cat/');
  });

  const leftover = out.match(/\{%[^%]*%\}/g);
  if (leftover) report.warnings.push(`unconverted Hexo tags: ${leftover.join(', ')}`);
  return `${out.trim()}\n`;
}

function frontMatter(f) {
  const lines = [`title: ${JSON.stringify(f.title)}`];
  if (f.date) lines.push(`date: ${f.date}`);
  if (f.topic) lines.push(`topic: ${f.topic}`);
  if (f.tags) lines.push(`tags: [${f.tags.map((t) => JSON.stringify(t)).join(', ')}]`);
  if (f.description) lines.push(`description: ${JSON.stringify(f.description)}`);
  if (f.cover) lines.push(`cover: ${f.cover}`);
  if (f.hidden) lines.push('hidden: true');
  if (f.license === false) lines.push('license: false');
  return `---\n${lines.join('\n')}\n---\n\n`;
}

let count = 0;
for (const [file, extra] of Object.entries(POSTS)) {
  const { data, body } = splitFrontMatter(readText(`source/_posts/${file}`));
  const id = String(data.id);
  const postDir = join(ROOT, 'src/content/posts', id);
  rmSync(postDir, { recursive: true, force: true });
  mkdirSync(postDir, { recursive: true });
  const report = { images: [], titles: [], notes: 0, shifted: false, warnings: [] };
  const content = applyFixes(id, convertBody(body, postDir, report));
  if (extra.cover && !report.images.includes(extra.cover)) throw new Error(`${id}: cover ${extra.cover} is not one of its images`);
  const fields = {
    title: String(data.title),
    date: toIso(data.date),
    topic: extra.topic,
    tags: tagsOf(data.tags),
    description: typeof data.description === 'string' && data.description.trim() ? data.description.trim() : undefined,
    cover: extra.cover ? `./${extra.cover}` : undefined,
    hidden: data.hidden === true ? true : undefined,
    license: data.copyright === false ? false : undefined,
  };
  writeFileSync(join(postDir, 'index.md'), frontMatter(fields) + content);
  count += 1;
  console.log(`${id.padEnd(7)} ${file.padEnd(40)} images:${report.images.length} titles:${report.titles.length} notes:${report.notes}${report.shifted ? ' headings-shifted' : ''}${report.warnings.length ? ` WARN ${report.warnings.join('; ')}` : ''}`);
}

// About page.
const about = splitFrontMatter(readText('source/about/index.md'));
mkdirSync(join(ROOT, 'src/content/pages'), { recursive: true });
writeFileSync(join(ROOT, 'src/content/pages/about.md'), `${frontMatter({ title: 'About' })}${about.body.trim()}\n`);

// Catch the Cat's scripts, loaded only by its page.
const gameDir = join(ROOT, 'public/games/catch-the-cat');
mkdirSync(gameDir, { recursive: true });
for (const f of ['phaser.min.js', 'catch-the-cat.js']) writeFileSync(join(gameDir, f), read(`source/javascript/catch-cat/${f}`));

// Avatar.
mkdirSync(join(ROOT, 'src/assets'), { recursive: true });
writeFileSync(join(ROOT, 'src/assets/avatar.png'), read('source/images/avatar.png'));

console.log(`\nMigrated ${count} posts, the About page, Catch the Cat's scripts and the avatar.`);
