# CLAUDE.md: Jack's Space

Jack's personal site: a static Astro site at https://jacklee981229.github.io, built from the public repo `jacklee981229/jacklee981229.github.io` and served by GitHub Pages. These rules add to `C:\repos\Jack\CLAUDE.md`. Open plans are in `docs/plan/todo/`.

## Commands

Run these in this folder.

- `npm run dev`: the site with live reload at http://localhost:4321. Shows drafts; the palette finds no posts here.
- `npm run build`: builds into `dist/`, stops on a sitemap mismatch or a missing share picture, then builds the search index.
- `npm run preview`: serves `dist/` at http://localhost:4321, search included.
- `npm run check`: type check. `npm test`: the unit tests in `tests/`.
- `npm run new "Title" topic`: starts a draft post.

Package versions are pinned to ones that run on Node 20.18, including the `@astrojs/language-server` override in `package.json` that keeps `npm run check` working, and wrangler 4.86.0, the last for Node 20. Don't upgrade them, and ignore Astro's and wrangler's "new version available": they need Node 22.

## Where to look

Read the code for how a part works; this says where to start.

- Site-wide facts (name, job title, links, menu, tagline): `src/site.ts`. The page frame (head, header, footer, palette, night sky, visitor counter): `src/layouts/Base.astro`.
- The logo: `src/lib/logo.js`, one drawing for the tab icon (`src/pages/favicon.svg.ts`), the menu bar, Jack's picture, and the welcome and loading screen (`src/components/Splash.astro`).
- The rules and logic: `src/lib/`, each `.js` there tested in `tests/`. Every colour, font, size and spacing: `src/styles/tokens.css`.
- The home page: `src/pages/index.astro`, its picks in `src/lib/home.js`.
- Posts: `src/content/posts/<address>/index.md`; their fields in `src/content.config.ts`; topics in `src/lib/topics.js`.
- Words Jack edits by hand: `src/content/now.md`, `src/content/changelog.md`, `src/content/pages/about.md`, each collection's `index.yaml` ([the README](src/content/collections/README.md) says how) and `src/content/travel/visited.yaml`.
- The Lab: `src/lib/lab/tools.js` is the one list of tools, games, effects and little worlds, and `tests/lab-tools.test.js` checks that each has what it needs (page, file, picture, icon): to add one, start there and copy a sibling. Effects are `src/effects/<slug>.js` on `src/effects/stage.js`; the worlds `src/worlds/<slug>.js`, their logic in `src/lib/town/` and `src/lib/trains/`; the games `src/games/<name>/`.
- The guestbook: `src/pages/guestbook.astro` and the home page's Guestbook card, the notes' logic in `src/lib/guestbook.js` and their looks in `src/lib/guestbook-view.js`. The notes live in Jack's Cloudflare Worker and its D1 database, `workers/guestbook/` (its README: setting up, deploying, and Jack's SQL to show, hide, pin and reply).
- Collections: `src/pages/collections.astro`, the logic in `src/lib/shelves.js`. In the code a collection is a "shelf", because "collections" is Astro's word for content folders.
- Travel Map: `src/pages/travel.astro`, the logic in `src/lib/travel/`, the shapes from the `world-atlas` package.
- Command palette: `src/components/SearchDialog.astro`, its items in `src/lib/palette-items.ts`, matching in `src/lib/palette.js`. Icons: `src/lib/icons.js`, the site's one set.
- Share pictures: made at the end of the build (`astro.config.mjs`, `src/lib/share.js`, `src/lib/share-image.js`).
- Sitemaps and robots.txt: `publicPages()` in `src/lib/collections.ts`.
- A page's top: `src/components/PageTop.astro`. A two-way switch (Globe | Flat): `src/components/Switch.astro`.
- When Jack says "CSS" about the Lab, he means the Effects.

## Rules

- **Changelog:** a commit that changes something a visitor can see adds a line at the bottom of `src/content/changelog.md`, "- YYYY-MM-DD kind: text" (kind: new, improved, design or fix): casual, plain English, past tense, under about 70 characters, what a visitor would notice, no jargon. Changes nobody can see get none.
- **Starry Night's secret word** is in no file; the code keeps only its fingerprint. Never write the word or hint at it in the repo, the changelog included. Night is the dark theme plus `data-sky="night"`, never a third theme: much of the CSS checks `[data-theme='dark']`.
- **A new page** goes into `publicPages()` or is marked `noindex`, or the build stops. Every main page's top is `PageTop`, a card in its part's colours (`tone`); no page sets its own title size, top spacing or lead.
- **Looks:** colours, fonts, spacing and radii only from `tokens.css`, never raw values in components. Pages are cards on the plain ground, like the home page: no borders, `--radius-2xl` for big cards and `--radius-xl` for cards in a list; white text only on the colours in `tokens.css` deep enough for it. The one exception to tokens-only colours: each Collection card's colour, worked out from its cover (`cardColours`). A link that stands alone is `src/components/Go.astro` (no underline; a pill and an arrow on hover); a link inside a sentence keeps its underline. Different sections look different (a band, a border, a background); panels such as a leaderboard are cards.
- **Scripts and styles** go through Astro's build (imported from `src/`), never `public/`: files there keep their names, and GitHub Pages lets browsers keep a saved copy for 10 minutes, so visitors would get the new page with an old script. A page's own script and styles load only on that page. A page's `:global` rule for a component's insides must be stronger than the component's own rule, not equal: the order of the two in the built CSS decides a tie, and it changes with the page's imports.
- **Posts:** follow the `/new-post` skill ([.claude/skills/new-post/SKILL.md](.claude/skills/new-post/SKILL.md)). A post's folder name is its address: never rename a published one (old links and visit counts depend on it); if one must move, its old address forwards through `redirects` in `astro.config.mjs`. A new topic needs two colours in `tokens.css`: a deep one (`--topic-…`, its posts' top card and the light theme's lane) and a dark theme lane; each lane at least 4.5:1 against `--paper` and `--surface`, and white at least 4.5:1 on the deep one.
- **Collection pictures:** a movie's are TMDB's posters; a game's are official art from its own Steam posts and its store screenshots, each a clearly different picture, never one key art in many shapes.
- **Visitor counter:** GoatCounter only (its address in `src/site.ts`), counting since 1 Oct 2026; its setting "Allow adding visitor counts on your website" must stay on. It runs only on the live site; locally it shows a dash. The Lab's Most Popular is ranked from its counts at build time; the daily run in `deploy.yml` keeps it fresh.
- **Now** shows on the home page as lines that read on ("Playing Shape of Dreams"), so each label in `now.md` is a doing word (Playing, Building, Watching). Its date is the file's last commit, so any edit to it, even its comment, shows as an update; and the deploy fetches the whole history for it: don't make the checkout shallow.
- **Fonts** are self-hosted (`public/fonts/`, licences beside them). The share pictures use WOFF copies in `src/assets/share-fonts/`, because satori can't read WOFF2.
- **No third-party scripts** besides GoatCounter, and no full-page loaders besides the welcome and the loading screen (only when a page is slow).
- **Guestbook:** a visitor's words go into the page only as text, never as HTML. The Worker takes notes only from the site and previews on Jack's laptop (`allowedOrigin` in `notes.js`). It goes live with `npx wrangler deploy --config workers/guestbook/wrangler.toml`, not with the site's deploy. Its database is Jack's: tables and fixes as SQL he runs, and checks use a local copy (`--local`), never `--remote`. The word list that holds notes back is in the database, not the repo (a starter list in `docs/`).
- [docs/design-ideas.md](docs/design-ideas.md) is an idea bank: read it only when Jack asks for design ideas.

## Games

- Every game is as big as the window's height allows (`--game-width` in `tokens.css`), and the page glides to show the whole game when play starts (`bringIntoView` in `src/games/controls.js`). It fits the window while playing at every size under UI checks.
- Keys act whenever the game is on screen, whatever has focus, but never while typing in a field or with a dialog open; off screen, the arrows scroll the page. A mouse click must not take the keys (prevent default on mousedown); keyboard play starts after Tab. Accept the keys people naturally try (R to hold a piece).
- Simple and old-school over fancy (cell jumps, a faint grid), gentle difficulty, and ask before picking an animation style. Tap targets get `-webkit-tap-highlight-color: transparent`.
- Every game has two looks: its own colour card (the default) and the old Games green, which the New colours | Old green switch on its top card brings back for all of them (`data-game-look="old"` on the page, kept in this browser; `src/components/games/GameLook.astro`). A new game needs both. Its picture on the Lab's card is a photo of its board in the new look.
- Sound is made in the browser, with no sound files (Blocks' `src/games/blocks/sound.js`, after Key Jam's `src/effects/synth.js`). A game with sound stays silent until the first key or tap, has Sound and Music buttons (M for both, kept in this browser), and its sounds and music follow the game look.

## UI checks

In the sweep, after Jack confirms a feature, every UI change passes these:

- Window sizes: phone 375×812 (touch, no hover), 1280×900, short laptops 1440×760, 1366×657 and 1280×650, big 1920×960; in light, dark and the night sky. Jack tests on other people's devices, Macs with Safari too: mind Safari's viewport units, focus and fonts.
- Two states: on arrival, and in use after the first action. The main content starts on screen on arrival.
- Measure each element's edges, not only the page's sideways scroll: against the window on a desktop, but against the device's width (375) on a phone, where a page wider than the screen widens the window instead of scrolling.
- Siblings match: measure the same element (title, lead, buttons) across sibling pages.
- No row wraps by accident (a chip in a header, a long label), no needless line break, columns level; small secondary controls still on screen after a size change.
- Keyboard only: a visible focus on everything clickable, the tab order follows the page. Back links return to the section the visitor came from.
- Contrast at least 4.5:1 (3:1 for large text), measured. `prefers-reduced-motion` respected. Images have their size set.
- Help text is one short line with the same wording across siblings; one naming pattern across siblings ("Jack's …" for games); times show two decimals (mm:ss.cc).

## Testing habits

- My preview ports (`C:\repos\Jack\.claude\launch.json`): 4600 serves `dist/`, 4602 is dev (shows drafts), 4604 serves a build in a separate folder, 8790 is the guestbook's Worker with a local copy of its database. A preview's guestbook asks the real Worker: to test posting, answer those requests from 8790 instead (CDP `Fetch`). Jack's own preview is 4321: while it runs, never build into `dist/`; build with `--outDir` into another folder and serve that on my port. A build into a folder outside the project moves its `.astro/` folder into the output: finish with `npm run check` to bring it back.
- Probe with headless Chrome over CDP; Node 20 needs `node --experimental-websocket`. Probes stay in the scratchpad.
- `?loading` on any address shows the loading screen (the page pretends to take 3 s). The welcome plays on the home page once per tab: open a new tab to see it again.
- Jack's Exact Time checks the clock with the `X-Timer` header GitHub Pages' CDN adds to every answer. A local preview has none, so the page says it couldn't check: fake the header (CDP `Fetch`), or check on the live site.
- CDP: focus events need `Emulation.setFocusEmulationEnabled`; Enter on a button needs `text: '\r'`; scroll an element into view before clicking; measure after smooth scrolling ends (about a second); pin `Math.random` with `addScriptToEvaluateOnNewDocument`; click with `Input.dispatchMouseEvent`, since an event dispatched on an element skips hit-testing; reopening the same address with only a new `#…` fires no load event, so add a query string.
- To test a theme change, press the site's own theme button: emulating the colour scheme only applies on the next load.
- To prove a built file's fingerprint changes, make a real code change: the minifier drops comment-only edits.

## Publishing

- Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml) (tests, type check, build, publish), about two minutes; if a step fails, the previous version stays live.
- Commit and push through the checklist in `C:\repos\Jack\CLAUDE.md`. This site's steps in it:
  - The checks: `npm test`, `npm run check` and `npm run build`.
  - A changelog line for each change a visitor can see (Rules, above).
  - Work that stays local stays out of the commit. When a file holds both, stage only the work's lines.
  - After the push: the deploy goes green, then the changed page on the live site shows the change.
- The GitHub CLI is `%LOCALAPPDATA%\Programs\gh\bin\gh.exe` (not on PATH): `gh run list --limit 3` shows recent deploys, `gh run view <id> --log-failed` why one failed.
- This repo's Git identity and login live in `.git/config` only. Never change the global Git config: it belongs to Jack's work projects.
- `scratch/check-old-urls.mjs` checks that every address of the old Hexo site still works.
