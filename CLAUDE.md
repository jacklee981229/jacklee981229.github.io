# CLAUDE.md: Jack's Space

Jack's personal blog: a static Astro site on GitHub Pages that replaces the old Hexo site at https://jacklee981229.github.io. These rules add to `C:\repos\Jack\CLAUDE.md`. Scope, decisions and tasks live in [docs/PLAN.md](docs/PLAN.md).

## Commands

Run these in this folder.

- `npm install`: install packages (first time, or after `package.json` changes).
- `npm run dev`: local site with live reload at http://localhost:4321. Shows drafts; search doesn't work here.
- `npm run build`: build the site into `dist/`, then build the search index.
- `npm run preview`: serve the built `dist/` at http://localhost:4321, search included.
- `npm run check`: type-check the project.
- `npm test`: unit tests for the logic in `src/lib/`.
- `npm run new "Title" topic`: start a draft post.

Package versions are pinned to ones that run on Node 20.18 (D1 in the plan), including the `@astrojs/language-server` override in `package.json`, which keeps `npm run check` working. Don't upgrade them without asking, and ignore Astro's "new version available" message: the new versions need Node 22 or newer.

## Where things live

- `src/content/posts/<address>/index.md`: one folder per post, images beside it. `src/content/pages/about.md`: the About page's text under "About Me" (that part is the role and links from `src/site.ts`).
- `src/content.config.ts`: the post fields, each with what it does.
- `src/lib/`: the rules (which posts show where, dates, the timeline graph, summaries). The `.js` files there have unit tests in `tests/`.
- `src/styles/tokens.css`: every colour, font, size, spacing and radius value, including the Lab's own dark theme (deep green instead of deep blue), used where a page passes `area="lab"` to `Base.astro`. `src/styles/prose.css`: post text and code blocks.
- `src/site.ts`: site-wide facts (name, author, job title, Jack's links, menu, posts per page). The links show as tiles (`src/components/ProfileLinks.astro`): with their names on the About page, icons only in the home profile card.
- `src/layouts/Base.astro`: the page frame (head, link previews, header, footer, search, the visitor counters). Two counters, both only on the live site: busuanzi for the numbers the site shows, and GoatCounter (its address is in `src/site.ts`) for page views. The Lab home's Most Popular is ranked from GoatCounter's public counts while the site is built (`src/lib/lab/popular.js`, `popularLabItems` in `src/lib/collections.ts`); the daily timer in `.github/workflows/deploy.yml` keeps it fresh. A build without a ranking (no network, fewer than four visited items) just leaves the section out.
- The Lab ([docs/lab-brief.md](docs/lab-brief.md), and its section in the plan): `src/lib/lab/tools.js` is the one list of tools (address, name, description, group, icon, `ready` or `soon`, the card's example), experiments (the games) and effects, read by the Lab home, the tool pages and the sitemap. Pages are in `src/pages/lab/`; tool pages share `src/components/ToolShell.astro` and `src/styles/lab.css`. Every Lab page (tools, games and effects) starts with `src/components/LabHeader.astro` and ends with "Check these too!" (`src/components/LabMore.astro`; which items: `moreLabItems` in `tools.js`), in `src/components/MoreBand.astro`, the full-width band that also closes posts; it goes after the page's `.wrap`, not inside it. A Lab item's card is `src/components/LabItemCard.astro`, around `LabCard.astro`. The text tools also share `src/components/TextConverter.astro` (their choices, your text, the result, Clear, Copy and Swap), brought to life by `src/lib/lab/page.ts`, which also runs every Copy button. The Preview tools share `src/components/PreviewTool.astro` (what you type beside what it makes, filling the window like the games; `setupPreview` in `page.ts` runs it and glides the page to the boxes when you go to type). Markdown Preview reads Markdown with micromark and its GitHub add-on (`src/lib/lab/markdown.js`; typed HTML comes out as text, so its output is safe to show). JSON Preview has its own reader (`src/lib/lab/json.js`), not the browser's, for the same plain errors with line and column everywhere and for numbers and name order exactly as written; it shows the JSON as a tree that folds or, with the switch at the preview's top right (the frame's `switch` slot), compact on one line, and draws big files a piece at a time either way. To add a tool: list it as `soon`, put its rules in `src/lib/lab/` with tests in `tests/lab-*.test.js`, build `src/pages/lab/<address>.astro` inside `ToolShell`, then mark it `ready` (a test checks that ready tools have a page and soon ones don't).
- Effects (a section of the Lab home, each at `/lab/effect/<slug>/` from `src/pages/lab/effect/[slug].astro`): things with no use that follow the pointer. `EFFECTS` in `src/lib/lab/tools.js` is the list. Each effect is one file, `src/effects/<slug>.js`, that draws a frame; `src/effects/stage.js` gives them all the same stage (the canvas, the pointer or a finger, a slow drift when nobody moves it, the theme's colours, Pause and Play, a still picture under reduced motion, and no work while off screen). `src/components/EffectStage.astro` is the stage on the page and fetches only that page's effect; `src/components/EffectCover.astro` draws each card's picture. To add one: add it to `EFFECTS`, write `src/effects/<slug>.js`, and give it a picture in `EffectCover.astro` (a test checks all three).
- Random (`src/pages/random.astro`, and a dashed box on the Lab home) only says it's coming. When built, it's one click that opens anything on the site: a post, a tool, a game or an effect.
- `src/components/Welcome.astro`: the welcome screen. A script in Base.astro's head decides whether it plays; the home title's typing waits for it (`--type-start` in `src/pages/index.astro`).
- `public/fonts/` and `src/styles/fonts.css`: the self-hosted fonts and their licences.
- `src/games/`: our own 2048, Catch the Cat, Snake and Blocks, one folder each. In each, `rules.js` is the game's rules (tested by `tests/game-2048.test.js`, `tests/catch-the-cat.test.js`, `tests/snake.test.js` and `tests/blocks.test.js`), `game.js` draws the board and handles input, and the `.css` styles it in the Games colour. `src/games/controls.js` is the input the games share: keys that work wherever the page was clicked, swipes, and bringing a board into view. `src/games/leaderboard.js` and `.css` are the leaderboard any game can use (2048, Snake and Blocks so far): kept in the visitor's browser, one name for every game, each name keeping its best game; a game can keep more than one board (Snake keeps one per wall mode); its rules are tested by `tests/leaderboard.test.js`. Each game has a component in `src/components/games/` that draws its container and brings its script and styles, only to its own page. A game's post (one of the Lab's experiments) is played at `/lab/game/<post folder>/`, from `src/pages/lab/game/[slug].astro`, whose `GAMES` says which post shows which game. It's laid out like a Lab tool: no date, tags or banner, so the game starts on screen on arrival. Every game is as big as the screen's height allows (`--game-width` in `src/styles/tokens.css`), and the page glides to show the whole game when play starts (`bringIntoView` in `controls.js`). Other posts (`src/pages/[slug].astro`) end with "Check these too!" post cards (`checkThese` in `src/lib/posts.js`) and the author card.
- `scratch/migrate-hexo.mjs` and `scratch/check-old-urls.mjs`: the one-off move from the old Hexo site, and the check that every old address still works.

## UI checks

Every task that changes the UI passes these in the sweep: after Jack confirms the feature and before it's committed (`C:\repos\Jack\CLAUDE.md`, "Verify before you report"):

- It works at 375 px and 1280 px wide, in both light and dark mode.
- Keyboard only: everything clickable shows a visible focus, and the tab order follows the page.
- Text contrast is at least 4.5:1 (3:1 for large text), measured rather than guessed.
- `prefers-reduced-motion` is respected, and nothing scrolls sideways.
- Images have their size set, so nothing jumps while the page loads.

## Design rules

- Colours, fonts, spacing and radii come only from the design tokens. Components contain no raw colour values.
- No full-page loaders, except the welcome screen as the plan's feature table describes it. No third-party scripts except the ones the plan names.
- Scripts and styles go through Astro's build (import them from `src/`), never `public/`. Built files get a fingerprint in their names that changes when they do; files in `public/` keep their names, and GitHub Pages lets browsers reuse a saved copy for up to 10 minutes, so right after a deploy a visitor would get the new page with the old script until a hard refresh.

## Writing posts with Jack

- Follow the `/new-post` skill in [.claude/skills/new-post/SKILL.md](.claude/skills/new-post/SKILL.md) whenever Jack wants to write, edit or publish a post.
- A post's folder name is its web address (`/<folder>/`, or `/lab/game/<folder>/` for a Lab game). Never rename a published post's folder: old links and visitor counts depend on it. If one ever has to move, its old address forwards to the new one through `redirects` in `astro.config.mjs`.
- New topic: add it to `src/lib/topics.js` and give it a light and a dark lane colour in `src/styles/tokens.css`, each at least 4.5:1 against `--paper` and `--surface` in its theme.
- The repo is public: anything committed, drafts included, can be read on GitHub.

## Publishing

- The live site is https://jacklee981229.github.io, built from the public GitHub repo `jacklee981229/jacklee981229.github.io`.
- Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): install, tests, type check, build, publish. It takes about two minutes. If a step fails, nothing is published and the previous version stays live.
- Commit and push only when Jack says so (Git rules in `C:\repos\Jack\CLAUDE.md`). Run `npm test`, `npm run check` and `npm run build` first.
- The GitHub CLI is `%LOCALAPPDATA%\Programs\gh\bin\gh.exe` (not on PATH). `gh run list --limit 3` shows recent deploys; `gh run view <id> --log-failed` shows why one failed.
- This repo's Git identity and github.com login live in `.git/config` only. Never change the global Git config: it belongs to Jack's work projects.
