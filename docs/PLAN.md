# Jack's Space v2: plan

**Status: approved 26 Sep 2026.** Tasks 1 to 6, 8 and 9 done: the new site went live on 26 Sep 2026. Then UI tweaks 1 (26 Sep): the Tags page removed, a theme fade and a new hover for the sidebar tags. UI tweaks 2 (26 Sep): a 0.3 s fade, the typing title, menu and card hover, and the welcome screen. Task 9's last check passed on 27 Sep: the UI tweaks push redeployed the site by itself. Site info fixes (27 Sep): the comma in the running days, and "live site only" in place of the counter on local previews. About and profile links (29 Sep). A soft card shadow in the light theme (29 Sep). Links to other sites open in a new tab: profile links, links inside posts and the licence link (29 Sep). Lab V1 approved (29 Sep): L1 done (the Lab home, Count Words, /random/). L2 done (30 Sep): Change Case, Encode URL, Clean Text and Convert Timestamp; next L3. 2048 rebuilt as our own game (30 Sep): play2048.co stopped allowing other sites to embed it. Catch the Cat rebuilt as our own game too (30 Sep), in the same style, replacing the old 960 KB Phaser version. Its cat animated (30 Sep): it hops from dot to dot, gallops off when it escapes and hangs its head when trapped. 2048 got a running clock and a leaderboard (30 Sep); the leaderboard is kept in each visitor's browser for now, and is a module any game can use. Then its keys work wherever you click, game posts drop the banner so the game is in view on arrival, and reaching 2048 saves the score. Then (30 Sep) game pages are laid out like the Lab's tools, with 2048's leaderboard beside the board; "Check these too!" cards sit under posts, tools and games, in a full-width band of their own; the description line is wider; Count Words and Change Case are tidied. Also (30 Sep): the Lab turns deep green in the dark theme; two new games, Snake (贪吃蛇) and Blocks (falling blocks), both on the shared leaderboard; the games share their keys and swipes. The games moved from `public/` into Astro's build, so their files get fingerprinted names and a deploy never pairs a new page with an old saved game (it did once: 2048 showed no leaderboard until a hard refresh). Then (30 Sep) Experiments became Mini Games!, every game's name starts with "Jack's", Blocks can hold a piece for later, and the games moved to `/lab/game/<name>/` (D14). Snake then went old-school (the snake jumps from cell to cell over a faint grid), speeds up more gently (3 ms a step per food, not 4), and got a "No walls" switch beside New game, changeable only between games, with its own Best and leaderboard. The games' help lines got shorter, Catch the Cat's keys work only once the board is reached with Tab (clicks leave the arrow keys to the page), Blocks also holds with R, "‹ Lab" on a game goes back to Mini Games, and the leaderboard sits in the same place on every game. After feedback from a MacBook Air (the games were tiny under the page title), every game now grows to the screen's height, and the page glides to show the whole game when play starts. Then (1 Oct) GoatCounter went in and the Lab home's Most Popular was built (D13); it shows once four Lab items have been visited. Lab phase 2 was approved the same day and all of it was built in one go at Jack's word: Markdown Preview (P1), JSON Preview (P2), and six visual experiments under "Random" (R1 onward). After Jack's test (2 Oct): the experiments became Effects, a Lab section of their own at `/lab/effect/<name>/`, with two more (Ripples and Compass); Random went back to "coming soon", because Random means one click to anything on the site and isn't built yet; and JSON Preview got a Tidy | Compact switch with one Copy button. Then 2048 got Undo (the last move can be taken back, once, with the button or Z), and its clock now waits while "You made 2048!" is up, until Keep going. Then (2 Oct) Jack found some of the eight effects too alike, so eleven more were built for him to choose from: Spotlight, Sand, Kaleidoscope, Starfield, Strings, Stained Glass, Flock, Orbits, Moiré, Garden, and Key Jam, where every letter key plays a sound (made in the browser, no recordings) and a short animation. All nineteen are in the Lab for now, committed but not published; which stay is Jack's to decide, and the wide checks and the testing steps wait for that. Task 10, our first new post, is still open.

Rebuild https://jacklee981229.github.io from scratch with a modern UI. The new site keeps what the current Hexo site does, lets us write and publish posts together, and goes live on GitHub Pages.

**Purpose:** a programming journal that also shows what you build.

## Decisions

- **D1. Node and Astro: stay on Node 20.18 and use Astro 5.18**, the last Astro version that runs on it. Node is installed once for the whole PC, so upgrading would also change your work projects and put you on a different version from your colleague. We upgrade the blog when your work projects move to a newer Node.
- **D2. Going live: same URL, fresh repo.** I back up the whole old repo to your PC (Task 5). At go-live you delete the old repo on GitHub, and I create a new one with the same name and do the rest through the GitHub CLI (Task 9). Deleting stays with you because it's permanent. Until then, the old `butterfly` and `src` branches still show `arsenal.md` with its password; deleting those two branches sooner stops that.
- **D3. Old posts: copy them** from the old repo's original Markdown: 14 posts, About and the two game pages. The Arsenal page and the "My Personal Arsenal" post are dropped (26 Sep). Tags are lowercase now, which merges "Hexo" with "hexo", "ChatGPT" with "chatgpt" and makes "AI" "ai" (12 tags become 10): Windows can't hold two folders whose names differ only in capitals, so the old site's pages for those pairs overwrote each other. Old capital-letter tag links still land on the right page.
- **D4. Writing: together in Claude Code** with a `/new-post` skill, plus `npm run new "Title"` for writing alone. A browser editor can come later.
- **D5. Features: as in the table below.**
- **D6. Design: A. Commit graph** (picked 26 Sep; B. Code editor set aside). Every post is a rounded card, cover on the side, on its topic's coloured lane. The graph also shows the year, the month and long breaks between posts. Font: Schibsted Grotesk throughout, IBM Plex Mono for code.
- **D7. Password-protected posts: dropped** (26 Sep). "My Personal Arsenal" was the only one. Task 7 is removed; the feature can be added later if you ever need a private post.
- **D8. Astro 5's known security issues: accepted for now** (26 Sep). `npm audit` lists 10 Astro 5.18 advisories (one critical) plus two in its build tools; the fixes need Astro 6 or 7 and Node 22 or newer. Most need a server-rendered site or visitor input, so the practical risk for a static blog built from your own posts is low. We upgrade when your system Node moves on.
- **D9. Visitor counter: keep busuanzi** (27 Sep). A counter of our own (a free Cloudflare Worker with a database, deployed with Wrangler 4.86, the last version for Node 20) was considered. Busuanzi already counts on the live site at no cost and with no upkeep, so it stays. Worth revisiting if busuanzi goes down or you want to own the numbers.

## Features: current site → new site

| Current site | New site |
|---|---|
| **Pages** | |
| Home: post list, 10 per page | Keep |
| Archives; Tags, with a page per tag | Keep Archives and the page per tag. The Tags page itself is dropped (26 Sep): the home page's sidebar lists every tag, and /tags/ opens the home page |
| Writing: posts grouped by topic, kept up to date by hand (today the Flutter and game posts are listed under Hexo) | Keep, but built from each post's topic so it's always right |
| About | Keep. Since 29 Sep: "About Me" is just your current job title, with the same links (Resume, LinkedIn, GitHub, Email) as the home profile card, which shows them as icons only |
| Arsenal (your tools list) and the "My Personal Arsenal" post | Drop. You no longer need them |
| Games: 2048, Catch the Cat | Keep |
| Hidden posts (not listed anywhere) | Keep |
| 404 page | Keep |
| Test page (/test/) | Drop |
| **Post page** | |
| Table of contents; created and updated dates; tags | Keep |
| Code: highlighting, language label, line numbers, copy button, long blocks folded | Keep |
| Images: click to enlarge, lazy loading | Keep, plus automatic resizing |
| Copyright notice (CC BY-NC-SA 4.0); previous/next; related posts | Keep |
| Share buttons (empty today) | Replace with a "Copy link" button |
| Password-protected posts | Drop (D7) |
| Post links (/1/, /g1/ …) | Keep the same links. New posts get readable links such as /flutter-get-started/ |
| **Across the site** | |
| Search | Keep |
| Dark/light switch | Keep |
| Sidebar: profile card, recent posts, tag cloud, site info (post count, run time, last update) | Keep |
| Visitor counts (busuanzi: site UV/PV, views per post) | Keep. It's the same service with the same links, so your counts continue |
| Back-to-top button | Keep |
| RSS feed, sitemap, Google Search Console tag | Keep |
| Link previews when a page is shared (Open Graph tags; missed in the first list) | Keep |
| Pinned posts (supported, not used today) | Keep |
| Full-page loading screen | Replaced (26 Sep) by a 3 s "Welcome to Jack's Space" screen, shown only when a visit starts on the home page: once per visit, skippable with a click or any key, never with reduce motion. Style B, "Curtain" (picked 26 Sep from the preview in `scratch/mockups/intro/`) |
| Random wallpaper banners (Bing, demolab) | Replace with post covers: the post's chosen image, else its first image, else a generated cover in its topic colour |
| Hide-sidebar and settings buttons | Drop. Post pages get a focused reading layout instead |

**My additions** (not on the current site): drafts that show only in local preview, the Copy link button, and automatic image resizing.

**Out of scope** (can be added later): comments (none today), a browser editor, a custom domain, analytics beyond busuanzi, click effects (heart.js appears only in tutorial posts and isn't active on the site), and other languages.

**Later, not now:** a Projects page showing what you've built (you liked the idea on 26 Sep). The other ideas from that day are on hold.

## Stack (defaults)

- **Astro 5.18** turns the posts into plain HTML, CSS and a little JavaScript. Posts are Markdown files in the repo.
- **Plain CSS** with design tokens. No Tailwind and no UI framework. Fonts are stored with the site, so pages make no calls to Google.
- **Packages:** `astro@5` and `pagefind` (search), plus `@astrojs/check` and `typescript` for type checks. The feed and the sitemap are small pages written in the project instead of `@astrojs/rss` and `@astrojs/sitemap`, so they keep the old addresses and format (`/atom.xml`, `/sitemap.xml`). The Catch the Cat game's scripts load only on its page.
- **Unit tests** use Node's built-in test runner (no package). They cover logic that can silently go wrong: dates, post order and paging, hiding drafts and hidden posts, the timeline graph, excerpts and the feed's text escaping. Node 20 can't run TypeScript directly, so the tested logic lives in plain JavaScript files.
- **Hosting:** GitHub Pages. GitHub Actions builds and deploys the site on every push to `main`.
- **GitHub access:** the GitHub CLI 2.101.0 in `%LOCALAPPDATA%\Programs\gh` (not on PATH; installed 26 Sep with your OK). You sign in once in your browser; I never see your password or token. This repo has its own Git identity (Jack Lee, jackjiunyihlee@gmail.com) and uses the CLI's login for github.com, both set in the repo only, because your global Git setup (work email, saved GitHub login) belongs to your work projects and stays untouched.

## Tasks

We do one task at a time. Each task ends with a report and adds its own section to `TESTING.md`. Every UI task gets the UI checks in [CLAUDE.md](../CLAUDE.md).

1. **Design mockups.** Two static mockups of the home and post pages in `scratch/mockups/`, using your real posts. *Done when:* you've picked one, or a mix.
2. **Skeleton.** The Astro project, base layout (header, nav, footer), dark/light switch and design tokens. *Done when:* `npm run build` and `npm run check` pass, and every page shell passes the UI checks.
3. **Post page.** The post fields (title, dates, tags, topic, description, cover, draft, hidden, pinned) and the full post page from the table. *Done when:* a sample post shows every element, and a post with a bad field fails the build with a clear message.
4. **Lists and sidebar.** Home (pinned first, 10 per page), Archives, Tags, Writing and the sidebar. *Done when:* unit tests prove the counts, order and paging, and no draft or hidden post appears anywhere in the built site.
5. **Move old content.** First a full backup of the old repo on your PC. Then the posts, About and the game pages are copied from it, with images and your avatar. Hexo-only tags are converted to plain Markdown. *Done when:* a script opens every old URL on the local build and gets the right page (the dropped Arsenal links, /arsenal/ and /0/, show the 404 page), and I've compared each post with the live one.
6. **Search, feeds and counters.** Search, RSS, sitemap, the Search Console tag, link-preview tags and busuanzi counts. *Done when:* search finds a word from inside a post, and the feed and sitemap list exactly the public posts.
7. ~~Password-protected posts~~ Dropped (D7).
8. **Writing workflow.** The `/new-post` skill (it works when Claude Code is opened in this project's folder), `npm run new` and drafts. *Done when:* we've written a test post from start to preview, then deleted it.
9. **Go live.** I install the GitHub CLI (asking first) and you sign in once. You delete the old repo; I create the new one, add the deploy workflow, set GitHub Pages to "GitHub Actions" and push, only when you say. *Done when:* https://jacklee981229.github.io shows the new site, old links work, and a second push redeploys by itself.
10. **Our first new post.**

## Lab (V1)

Approved 29 Sep 2026. Your brief is [lab-brief.md](lab-brief.md): what the Lab is, its tools, and what V1 must not have. This section adds only how it fits this site, the decisions and the tasks.

**How it fits:** pages `/lab/` (the Lab home: Tools, Experiments and a Random teaser), `/lab/<tool>/` (one per tool) and `/random/` (coming soon). "Lab" joins the menu: Home, Writing, Archives, Lab, About. `/lab/` and `/random/` are reserved, so no post can take them. One tool list in `src/lib/tools.js` feeds the Lab home, each tool's heading and the sitemap. One shared tool frame (back link, name, description, "stays in your browser" note) plus only the shared pieces the tools use. Tool rules live in plain JavaScript with unit tests; canvas, clipboard and downloads are checked in headless Edge. Each page loads only its own script. Tools keep your text colour (colour means topic on this site) and use the names from the brief.

**Defaults:** tool addresses `/lab/count-words/`, `/lab/change-case/`, `/lab/encode-url/`, `/lab/convert-timestamp/`, `/lab/clean-text/`, `/lab/qr-code/`, `/lab/jpg-to-png/`, `/lab/resize-image/`, `/lab/compress-image/`, `/lab/compare-text/`. Experiments is a section on the Lab home. `/random/` says it's coming, with a "Back to the Lab" button, and stays out of the menu and the sitemap. Tools stay out of site search for now. A flask icon instead of the 🧪 emoji. Clean Text moves up to the other text tools. Tool input never goes into the page address.

**Differences from the brief:** fewer shared components than it lists (only what the tools use). Real iPhone Safari and Android phones can't be tested on this PC: I test with phone emulation, and TESTING.md lists phone steps for you. Very large iPhone photos can go over Safari's image-size limit (about 16 megapixels); the image tools say so.

- **D10. QR codes: the `qrcode-generator` package** (MIT, no dependencies), loaded only on the QR page.
- **D11. Experiments shows your two games**, Play 2048! and Play Catch the Cat!, which stay hidden everywhere else.
- **D12. One Lab task at a time**, L1 first, starting with a mockup.
- **D13. Most Popular counts come from GoatCounter** (approved 30 Sep): free for personal sites, no cookies. busuanzi can't give other pages' counts without adding a view to each. Jack made the account (1 Oct, `jacklee981229.goatcounter.com`, public counts switched on); its script loads only on the live site, like busuanzi, and counts every page. Changed on 1 Oct, with Jack's OK: the top 4 is worked out while the site is built, on every publish and once a day, not in each visitor's browser, so it shows at once, nothing jumps and ad-blockers can't hide it. It sits at the top of the Lab home, shows no numbers, and appears once four Lab items have been visited at all.
- **D14. Games live at `/lab/game/<name>/`** (approved 30 Sep): `/lab/game/2048/`, `/lab/game/catch-the-cat/`, `/lab/game/snake/` and `/lab/game/blocks/`. The old `/game_1/` and `/game_2/` forward to the new addresses. Posts stay at `/<folder>/`: moving them would restart every post's view count and turn every old link into a forwarding hop.

Tasks:

- **L1. Foundation, plus Count Words.** A mockup of the Lab home and a tool page for your OK, then the Lab home, the tool list, the shared frame, `/random/`, the Experiments section and the menu item, and the first tool, Count Words (characters, characters without spaces, words, lines, paragraphs and reading time, live as you type; Chinese counted properly). *Done when:* unit tests pass, the new pages pass the UI checks, and a post can't use `/lab/` or `/random/`.
- **L2. Text tools:** Change Case, Encode URL, Convert Timestamp, Clean Text. *Done when:* unit tests cover each rule (Unicode, broken % codes, seconds and milliseconds, local time and UTC, each cleaning option), copy, swap and reset work in headless Edge, and errors are plain words.
- **L3. Make a QR Code.** *Done when:* a link and a long message decode back correctly in the test, three sizes download as PNG, and text too long for a QR code gets a clear message.
- **L4. Image tools:** JPG to PNG, Resize Image, Compress Image, sharing the file drop area, preview, download and phone Share. *Done when:* a test photo converts at the same size, resize keeps proportions when locked, compression shows before and after sizes (and says so if the file grew), wrong files get a clear message, and the network log shows nothing uploaded.
- **L5. Compare Text.** *Done when:* unit tests cover added, removed and changed lines with word highlights, and very large inputs get a clear limit message instead of freezing.
- **L6. Finish.** A consistency and page-weight pass, and direct links checked on GitHub Pages; push when you say.

L3 to L6 are paused by phase 2 below; their "Soon" cards stay on the Lab home.

## Lab (phase 2)

Approved 1 Oct 2026. Your plan is [lab-phase-2.md](lab-phase-2.md): keep the tools there are, add Markdown Preview and JSON Preview, and start on visual experiments that follow the mouse. It changes two things in the V1 plan above, with your OK: a JSON tool comes in (the brief had left it for later); and QR code, the image tools and Compare Text wait. The experiments were first built as Random's content. On 2 Oct, after your test, they became **Effects**, a Lab section of their own, because Random is something else: one click that takes you to anything on the site (a post, a tool, a game). Random isn't built yet ("don't do Random first"), so it stays "coming soon" as in V1.

- **D15. Order:** Markdown Preview, JSON Preview, then Random. One task at a time, as before (D12).
- **D16. Markdown is read by micromark with its GitHub add-on** (both MIT): the engine Astro already installs, listed in `package.json` so the tool doesn't lean on Astro's own copy. No new download. HTML typed into the Markdown shows as text and never runs.
- **D17. JSON Preview reads JSON with its own small reader**, not the browser's, so every browser gives the same plain error with its line and column (Safari gives no position), and numbers and the order of keys show exactly as written.
- **D18. Effects is a section of the Lab home, one page per effect at `/lab/effect/<name>/`**, like the games: no gallery page, and "‹ Lab" goes back to the section. (Changed 2 Oct. They were first a gallery at `/random/` with pages at `/random/<name>/`; that was never published, so no old address needs forwarding.) The name is "Effects", not "CSS": they're drawn with JavaScript on a canvas.
- **D19. Effects follow the site's light and dark theme**, drawing with the topic colours. Canvas only, written from scratch, no packages, each loaded only on its own page. A finger works like the mouse; they drift gently when left alone; with "reduce motion" on, a still picture with a Play button.
- **D20. The first effect is the Interactive Dot Grid.** Then, one per task and each after your OK: Mouse Trail, Gravity Trail, Particles, Gooey Cursor, Distortion. (Built 1 Oct: Distortion is a net of lines bent in plain canvas like the rest, so the heavier graphics weren't needed.) Two more on 2 Oct, picked at your word from a web search for similar effects: Ripples (rings that spread where the pointer goes) and Compass (a field of needles that point at the pointer).
- **D21. JSON Preview shows the JSON one of two ways** (2 Oct): a "Tidy | Compact" switch at the preview's top right, Tidy at first, and one Copy button that copies what's showing. It replaced the two buttons, Copy tidy and Copy compact.

Tasks:

- **P1. Markdown Preview** (`/lab/markdown-preview/`), in a new "Preview" group on the Lab home. Type or paste Markdown and see it formatted beside it, live (under it on phones), looking like a Jack's Space post; tables, task lists and strikethrough work. Copy HTML and Clear. *Done when:* unit tests cover headings, lists, tables, links and typed HTML shown as text, and the page passes the window sizes in `check.md`.
- **P2. JSON Preview** (`/lab/json-preview/`). Paste JSON and see it tidy and coloured, with parts that fold. Broken JSON gets a plain message with line and column. A Tidy | Compact switch, Copy and Clear (D21). *Done when:* unit tests cover good and broken JSON, very large numbers, key order and deep nesting, and a 1 MB file doesn't freeze the page.
- **R1. Effects go live:** the Lab home's Effects section and the Dot Grid. *Done when:* it runs smoothly at every window size, touch works, both themes look right, and reduced motion is respected.
- **R2 onward. More effects**, one per task. Eight are built.
- **Random** (one click to anything on the site) waits for your word; `/random/` and the Lab home say it's coming.
