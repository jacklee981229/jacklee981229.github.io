import { defineConfig } from 'astro/config';
import { codeTitleFromMeta, rehypeCodeFrame } from './src/lib/code-frame.js';
import { rehypeExternalLinks } from './src/lib/links.js';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { compareSitemap, sitemapProblem } from './src/lib/sitemap-check.js';
import { missingPictures, picturesToMake } from './src/lib/share.js';
import { sharePicture } from './src/lib/share-image.js';

const site = 'https://jacklee981229.github.io';

/**
 * When the build is done: stop it if the built pages and sitemap.xml disagree (src/lib/sitemap-check.js); make the
 * share pictures pages ask for (src/lib/share.js, share-image.js); and stop it if any page's share picture isn't
 * there. Stopping the build stops the deploy too.
 */
const siteChecks = {
  name: 'site-checks',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      const root = fileURLToPath(dir);
      const pages = readdirSync(root, { recursive: true })
        .map(String)
        .filter((file) => file.endsWith('.html'))
        .map((file) => ({ file, html: readFileSync(`${root}/${file}`, 'utf8') }));
      const problem = sitemapProblem(compareSitemap(pages, readFileSync(`${root}/sitemap.xml`, 'utf8'), site));
      if (problem) throw new Error(problem);
      const css = readFileSync('src/styles/tokens.css', 'utf8');
      for (const picture of picturesToMake(pages, site)) {
        const out = `${root}${picture.path}`;
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, await sharePicture(picture, css, new URL(site).host));
      }
      const missing = missingPictures(pages, site, (path) => existsSync(`${root}${path}`));
      if (missing.length) throw new Error(`Share pictures missing for: ${missing.join(', ')}`);
    },
  },
};

export default defineConfig({
  site,
  // Old Hexo links all end in a slash (/11/, /archives/), so every page URL does.
  trailingSlash: 'always',
  integrations: [siteChecks],
  build: { format: 'directory' },
  markdown: {
    shikiConfig: {
      // These two keep code comments readable: at least 4.5:1 against the site's code background in both themes.
      themes: { light: 'github-light-default', dark: 'github-dark-default' },
      transformers: [codeTitleFromMeta],
    },
    rehypePlugins: [rehypeCodeFrame, [rehypeExternalLinks, { site }]],
  },
  redirects: {
    // Archives was folded into Writing (4 Oct 2026), which lists every post; its old addresses (the old site had pages
    // per year and month too) lead there, so links from search results and other sites still work.
    '/archives': '/writing/',
    // The home page's older pages went when it became a grid of tiles (5 Oct 2026); Writing lists every post.
    '/page/2': '/writing/',
    '/archives/page/2': '/writing/',
    '/archives/2023': '/writing/',
    '/archives/2023/page/2': '/writing/',
    '/archives/2023/02': '/writing/',
    '/archives/2023/03': '/writing/',
    '/archives/2023/10': '/writing/',
    // The Tags page was dropped (26 Sep); the home page's sidebar lists every tag.
    '/tags': '/',
    // The two games from the old site moved into the Lab (30 Sep), where every game lives at /lab/game/<name>/.
    '/game_1': '/lab/game/2048/',
    '/game_2': '/lab/game/catch-the-cat/',
  },
});
