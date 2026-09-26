// Task 5 check: does every page address of the old site still work on the new build?
// Reads the old site's published files from the backup repo and looks for each page in dist/.
// Run from the project folder after `npm run build`: node scratch/check-old-urls.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const GIT_DIR = 'C:/repos/Jack/old-hexo-site-backup.git';

// Folders of the old theme's files (styles, scripts, fonts, images), not pages.
const ASSETS = /^(css|js|fonts|images|img|lib|javascript|styles)\//;
// Pages dropped on purpose (26 Sep): these now show the "Page not found" page.
const DROPPED = new Set(['/0/', '/arsenal/', '/test/']);
// Old files replaced by something else in the new site.
const REPLACED = { '/search.xml': 'the new search (Pagefind)', '/index copy.html': 'nothing (a stray copy of the old home page)' };

const files = execFileSync('git', [`--git-dir=${GIT_DIR}`, 'ls-tree', '-r', '--name-only', 'main'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const urls = files
  .filter((f) => !ASSETS.test(f) && (/(^|\/)index\.html$/.test(f) || /^[^/]+\.(xml|txt|html)$/.test(f)))
  .map((f) => `/${f.replace(/(^|\/)index\.html$/, '$1')}`);

// Exact letter case, segment by segment: Windows ignores case, GitHub Pages doesn't (/tags/AI/ is not /tags/ai/ there).
const inDist = (url) => {
  let dir = DIST;
  for (const part of decodeURIComponent(url.endsWith('/') ? `${url}index.html` : url).split('/').filter(Boolean)) {
    if (!existsSync(dir) || !readdirSync(dir).includes(part)) return false;
    dir = join(dir, part);
  }
  return true;
};
const isRedirect = (url) => url.endsWith('/') && inDist(url) && /http-equiv="refresh"/.test(readFileSync(join(DIST, decodeURIComponent(url), 'index.html'), 'utf8'));

let problems = 0;
for (const url of urls.sort()) {
  let status;
  if (DROPPED.has(url)) status = inDist(url) ? 'PROBLEM: dropped page still exists' : 'dropped on purpose (shows Page not found)';
  else if (REPLACED[url]) status = `replaced by ${REPLACED[url]}`;
  else if (inDist(url)) status = isRedirect(url) ? 'ok (redirects)' : 'ok';
  else if (url !== url.toLowerCase() && inDist(url.toLowerCase())) status = `ok (Page not found sends it to ${url.toLowerCase()})`;
  else status = 'PROBLEM: missing';
  if (status.startsWith('PROBLEM')) problems += 1;
  console.log(`${url.padEnd(28)} ${status}`);
}
console.log(`\n${urls.length} old addresses checked, ${problems} problem${problems === 1 ? '' : 's'}.`);
process.exitCode = problems ? 1 : 0;
