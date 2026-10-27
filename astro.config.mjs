import { defineConfig } from 'astro/config';
import { codeTitleFromMeta, rehypeCodeFrame } from './src/lib/code-frame.js';
import { rehypeExternalLinks } from './src/lib/links.js';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, sep } from 'node:path';
import { compareSitemap, sitemapProblem } from './src/lib/sitemap-check.js';
import { missingPictures, picturesToMake } from './src/lib/share.js';
import { sharePicture } from './src/lib/share-image.js';
import { EFFECTS, effectUrl } from './src/lib/lab/tools.js';

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

/**
 * Travel posts' photos are the media repo's own site (SITE.media, /media/). The local preview serves them from that
 * repo's folder beside this one, so a trip can be read before its photos are published.
 */
const localMedia = {
  name: 'local-media',
  /** @param {import('vite').ViteDevServer} server */
  configureServer(server) {
    const root = resolve(process.cwd(), '..', 'media');
    server.middlewares.use('/media', (req, res, next) => {
      const file = resolve(root, `.${decodeURIComponent((req.url ?? '').split('?')[0])}`);
      if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) return next();
      res.setHeader('Content-Type', file.endsWith('.webp') ? 'image/webp' : file.endsWith('.mp4') ? 'video/mp4' : file.endsWith('.mp3') ? 'audio/mpeg' : file.endsWith('.m4a') ? 'audio/mp4' : 'application/octet-stream');
      // Read whole, not streamed: a stream left open by a cancelled request keeps the file locked on Windows, and Media
      // Studio can't replace it on the next publish.
      const data = readFileSync(file);
      // A part of the file when asked for one, as GitHub Pages answers: without it a browser can't start a song or a
      // video partway through (the music player picking up on the next page, a seek).
      res.setHeader('Accept-Ranges', 'bytes');
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(0, data.length - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
        if (start > end) {
          res.statusCode = 416;
          res.setHeader('Content-Range', `bytes */${data.length}`);
          return res.end();
        }
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${data.length}`);
        return res.end(data.subarray(start, end + 1));
      }
      res.end(data);
    });
  },
};

export default defineConfig({
  site,
  // Old Hexo links all end in a slash (/11/, /archives/), so every page URL does.
  trailingSlash: 'always',
  integrations: [siteChecks],
  build: { format: 'directory' },
  vite: {
    plugins: [localMedia],
    resolve: {
      // Image to Text's reader (PaddleOCR.js) asks for ONNX Runtime's default build, which carries the graphics
      // card's code too: twice the download. It runs on the processor only, so it gets that build instead.
      alias: [{ find: /^onnxruntime-web$/, replacement: 'onnxruntime-web/wasm' }],
    },
  },
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
    // Change Case and Clean Text left the Lab (9 Oct 2026); their old addresses lead to its other tools.
    '/lab/change-case': '/lab/#tools',
    '/lab/clean-text': '/lab/#tools',
    // Each effect had its own page until they all moved onto the Effects page (9 Oct 2026); an old address opens it on
    // that effect.
    ...Object.fromEntries(EFFECTS.map((e) => [`/lab/effect/${e.slug}`, effectUrl(e.slug)])),
    // Build Log moved into the Lab (10 Oct 2026), the day it went up.
    '/build-log': '/lab/build-log/',
    // Speed Check was renamed Speed Test (24 Oct 2026).
    '/lab/speed-check': '/lab/speed-test/',
  },
});
