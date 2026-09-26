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

- `src/content/posts/<address>/index.md`: one folder per post, images beside it. `src/content/pages/about.md`: the About text.
- `src/content.config.ts`: the post fields, each with what it does.
- `src/lib/`: the rules (which posts show where, dates, the timeline graph, summaries). The `.js` files there have unit tests in `tests/`.
- `src/styles/tokens.css`: every colour, font, size, spacing and radius value. `src/styles/prose.css`: post text and code blocks.
- `src/site.ts`: site-wide facts (name, author, menu, posts per page).
- `src/layouts/Base.astro`: the page frame (head, link previews, header, footer, search, visitor counter).
- `public/fonts/` and `src/styles/fonts.css`: the self-hosted fonts and their licences. `public/games/`: Catch the Cat's scripts.
- `scratch/migrate-hexo.mjs` and `scratch/check-old-urls.mjs`: the one-off move from the old Hexo site, and the check that every old address still works.

## UI checks

Every task that changes the UI passes these before its report:

- It works at 375 px and 1280 px wide, in both light and dark mode.
- Keyboard only: everything clickable shows a visible focus, and the tab order follows the page.
- Text contrast is at least 4.5:1 (3:1 for large text), measured rather than guessed.
- `prefers-reduced-motion` is respected, and nothing scrolls sideways.
- Images have their size set, so nothing jumps while the page loads.

## Design rules

- Colours, fonts, spacing and radii come only from the design tokens. Components contain no raw colour values.
- No full-page loaders. No third-party scripts except the ones the plan names.

## Writing posts with Jack

- Follow the `/new-post` skill in [.claude/skills/new-post/SKILL.md](.claude/skills/new-post/SKILL.md) whenever Jack wants to write, edit or publish a post.
- A post's folder name is its web address. Never rename a published post's folder: old links and visitor counts depend on it.
- New topic: add it to `src/lib/topics.js` and give it a light and a dark lane colour in `src/styles/tokens.css`, each at least 4.5:1 against `--paper` and `--surface` in its theme.
- The repo is public: anything committed, drafts included, can be read on GitHub.

## Publishing

- The live site is https://jacklee981229.github.io, built from the public GitHub repo `jacklee981229/jacklee981229.github.io`.
- Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): install, tests, type check, build, publish. It takes about two minutes. If a step fails, nothing is published and the previous version stays live.
- Commit and push only when Jack says so (Git rules in `C:\repos\Jack\CLAUDE.md`). Run `npm test`, `npm run check` and `npm run build` first.
- The GitHub CLI is `%LOCALAPPDATA%\Programs\gh\bin\gh.exe` (not on PATH). `gh run list --limit 3` shows recent deploys; `gh run view <id> --log-failed` shows why one failed.
- This repo's Git identity and github.com login live in `.git/config` only. Never change the global Git config: it belongs to Jack's work projects.
