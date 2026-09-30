import { defineConfig } from 'astro/config';
import { codeTitleFromMeta, rehypeCodeFrame } from './src/lib/code-frame.js';
import { rehypeExternalLinks } from './src/lib/links.js';

const site = 'https://jacklee981229.github.io';

export default defineConfig({
  site,
  // Old Hexo links all end in a slash (/11/, /archives/), so every page URL does.
  trailingSlash: 'always',
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
    // The old Archives had extra pages (page 2, per year, per month); the new one lists everything on one page.
    '/archives/page/2': '/archives/',
    '/archives/2023': '/archives/',
    '/archives/2023/page/2': '/archives/',
    '/archives/2023/02': '/archives/',
    '/archives/2023/03': '/archives/',
    '/archives/2023/10': '/archives/',
    // The Tags page was dropped (26 Sep); the home page's sidebar lists every tag.
    '/tags': '/',
    // The two games from the old site moved into the Lab (30 Sep), where every game lives at /lab/game/<name>/.
    '/game_1': '/lab/game/2048/',
    '/game_2': '/lab/game/catch-the-cat/',
  },
});
