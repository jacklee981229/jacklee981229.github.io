import { defineConfig } from 'astro/config';
import { codeTitleFromMeta, rehypeCodeFrame } from './src/lib/code-frame.js';
import { rehypeExternalLinks } from './src/lib/links.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compareSitemap, sitemapProblem } from './src/lib/sitemap-check.js';

const site = 'https://jacklee981229.github.io';

/** Stops the build when the built pages and sitemap.xml disagree (src/lib/sitemap-check.js), so the deploy stops too. */
const sitemapCheck = {
  name: 'sitemap-check',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const root = fileURLToPath(dir);
      const pages = readdirSync(root, { recursive: true })
        .map(String)
        .filter((file) => file.endsWith('.html'))
        .map((file) => ({ file, html: readFileSync(`${root}/${file}`, 'utf8') }));
      const problem = sitemapProblem(compareSitemap(pages, readFileSync(`${root}/sitemap.xml`, 'utf8'), site));
      if (problem) throw new Error(problem);
    },
  },
};

export default defineConfig({
  site,
  // Old Hexo links all end in a slash (/11/, /archives/), so every page URL does.
  trailingSlash: 'always',
  integrations: [sitemapCheck],
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
