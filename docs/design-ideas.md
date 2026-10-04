# Design Idea Bank (UI/UX)

This file collects UI/UX patterns from two reference blogs, for use when designing this site's interface.

- **ImQi1**: https://imqi1.com
- **张洪Heo** ("Heo"): https://blog.zhheo.com
- Reviewed on 2026-10-04. Pages read: both homepages, one article page on each site, both About pages, and two ImQi1 posts about his own design choices. Some visual details were inferred from page content, and both sites change often, so check the live site before copying anything exactly.

## How to use this file

1. Before designing a page or feature, read **Principles** (section 2) and **Avoid** (section 4).
2. Pick ideas from the **Catalog** (section 3) and refer to them by ID, e.g. "add C4 unread markers".
3. Record what was adopted or rejected in **Decisions** (section 6), so later sessions don't start from scratch.
4. AI assistants working in this repo should check sections 2 and 4 before proposing any UI, suggest ideas by ID, and not implement anything from section 4 unless explicitly asked.

**Legend**
- **Hosting**
  - `static`: works on a purely static host. Build-time scripts and scheduled rebuilds are fine.
  - `backend`: needs a server or a database.
  - `3rd-party`: needs an external service (LLM, TTS, comments, analytics).
- **Effort (rough):** `S` = hours, `M` = a day or two, `L` = several days.
- ★ = part of the suggested starting set (section 5).

---

## 1. The two reference styles

|  | ImQi1 | Heo |
|---|---|---|
| Feel | Quiet, serif, text-first, restrained | Feature-packed and app-like; the blog works like an operating system |
| Best at | Readability, clear content types, visible craft | Discovery, power-user tools, community features |
| Main risk | Hides content behind a loader or its own colophon | UI chrome competes with the writing |
| Built with | Nuxt 4, Prisma, TypeScript, Tailwind ([open-source CMS](https://github.com/imqi1-github/imqi1-cms)) | Hexo with a heavily customized theme |

Pick one as the base direction and borrow selectively from the other. Mixing both evenly leads to clutter.

---

## 2. Principles

1. **Content first.** Every element has to earn its place next to the writing.
2. **Restraint over spectacle.** No full-screen effects such as particles. ImQi1 compares a first visit to a first meeting: you wouldn't show up in a gold chain and SpongeBob shorts. ([his design-tips post](https://imqi1.com/content/tech/821))
3. **Legibility beats backgrounds.** Never make cards so transparent that the text gets hard to read.
4. **One accent color, used consistently.** All-greyscale feels dated, and many colors feel noisy. ImQi1 chose blue because links are already blue.
5. **Type matches layout.** Use serif fonts for text-led layouts with plenty of whitespace. Use sans-serif for layouts with lots of cards and animation.
6. **Spend boldness in one place.** Keep personality to one or two contained spots, such as an animated avatar or a typographic touch, and keep the rest quiet. Prefer one ambient animation per page over several.
7. **Progressive disclosure.** Keep the main layout calm, and put secondary navigation and tools behind one panel that opens on demand (C1).
8. **Never hijack the browser.** Don't override native shortcuts like ⌘/Ctrl+F, or the native right-click menu, without an escape hatch.
9. **Show content immediately.** No splash loaders on static or server-rendered pages. When something really is loading, use a skeleton shaped like the real content.
10. **Make it feel alive.** A visible changelog, update prompts and progress signals reward returning visitors.
11. **Accessibility basics.** Always include:
    - a skip-to-content link
    - visible keyboard focus
    - support for `prefers-reduced-motion`
    - contrast checks on any derived colors
    - an off switch for single-key shortcuts (WCAG 2.1.4)
12. **Privacy by default.** Show visitor data only in aggregate, at city level or coarser, and never show individual visitors.

---

## 3. Idea catalog

### Quick reference

| ID | Idea | Source | Hosting | Effort |
|---|---|---|---|---|
| A1 ★ | First-character placeholders | ImQi1 | static | S |
| A2 | Slash-path nav labels | ImQi1 | static | S |
| A3 | Per-article accent color | Heo | static | S–M |
| A4 | Personality in one contained spot | Heo | static | M |
| B1 | AI summary you can ask questions | Heo | static + 3rd-party | M–L |
| B2 | Listen instead of read | Heo | static + 3rd-party | M |
| B3 | Reading progress in back-to-top button | Heo | static | S |
| B4 | Quote into comment + jump to comments | Heo | 3rd-party | S–M |
| B5 | Feedback link prefilled with the post | Heo | static | S |
| B6 | Continue on your phone | ImQi1 | static | S |
| B7 | Small craft details | ImQi1 | static | S |
| C1 ★ | Pop-up console | Heo | static | M |
| C2 | Keyboard shortcuts with an off switch | Heo | static | S–M |
| C3 ★ | Curated entry points + Must-read page | Heo | static | S |
| C4 ★ | Unread markers | Heo | static | S |
| C5 | Search with scopes | Heo | static | M |
| C6 | Clear content types | ImQi1 | static | M |
| C7 | Random post + webrings | Both | static | S |
| D1 ★ | Labelled public changelog | ImQi1 | static | S |
| D2 | "New version" prompt | Heo | static | M |
| D3 | Publishing heatmap | ImQi1 | static | M |
| D4 | Ten-year pledge progress bar | ImQi1 | static | S |
| D5 | Live behind-the-scenes info | Both | static + 3rd-party | S |
| E1 | Friends' posts on the homepage | ImQi1 | static | M |
| E2 | Map with three views | ImQi1 | static + backend | M–L |
| E3 | Shuffled friend links | Heo | static | S |
| E4 | Sponsors on display | Heo | static | S |
| E5 | Commenter profiles | Heo | backend | L |
| F1 | Chaptered / bento About page | Both | static | M |

### A. Personality & visual identity

#### A1 ★ First-character placeholders (ImQi1)
- **What:** A post with no cover image shows the first character of its title as a large glyph (原, 抖, 找…), instead of a grey box or a stock photo.
- **Why:** Text-only posts look deliberate next to photo posts, with no fake imagery.
- **How:**
  - In the card template, fall back to the title's first character on a tinted accent background.
  - For English titles, use the first letter, drop-cap style.
  - Strip leading quotes, emoji and punctuation first.
  - Use `Intl.Segmenter` (or `Array.from`) so a multi-byte character doesn't get cut in half.

#### A2 Slash-path nav labels (ImQi1)
- **What:** Utility links are labelled with their own paths: `/search`, `/messages`, `/links`, `/about`.
- **Why:** It's a cheap, memorable identity touch, and it shows visitors how the site's URLs are organized.
- **How:** Give each link a plain-word `aria-label` ("Search") so screen readers don't read out the slash.

#### A3 Per-article accent color (Heo)
- **What:** Each post stores a cover color in its metadata. The page accent and the browser's `theme-color` follow it.
- **Why:** Every article feels like its own room while the layout stays the same.
- **How:**
  - Add an `accent` field to the front matter, or extract the cover's dominant color at build time.
  - Set a `--accent` CSS variable on the article root and on the `<meta name="theme-color">` tag.
  - Clamp the lightness so text and buttons still pass contrast in both light and dark mode.

#### A4 Personality in one contained spot (Heo)
- **What:** Heo's author card and footer logo are small Lottie animations. The playfulness lives there instead of across the whole page.
- **Why:** Personality without visual noise (principle 6).
- **How:** Use one or two small animations (Lottie, SVG or CSS). Pause them when they're offscreen, and respect `prefers-reduced-motion`.

### B. Article page

#### B1 AI summary you can ask questions (Heo)
- **What:** Each post opens with an AI-written summary and an input box for follow-up questions about that article. Selecting text adds an "explain this" action (这是什么意思？) to the right-click menu.
- **Why:** Readers can size up a long post quickly and get unstuck on jargon.
- **How:**
  - Generate summaries at publish time and store them as static text, so they cost nothing at runtime.
  - The Q&A box needs a serverless function that calls an LLM API with the article as context.
  - Rate-limit the Q&A box and label AI output clearly.

#### B2 Listen instead of read (Heo)
- **What:** Every post has a read-aloud (TTS) version and a separate AI "podcast" version (播客陪读), both with playback-speed control. Heo maps them to the `T` and `P` keys.
- **Why:** People can listen while commuting, and it helps readers who prefer audio.
- **How:** Generate the MP3s at publish time and serve them as static files. Put a content hash in the URL (Heo uses `?v=<hash>`) so the audio refreshes when a post changes.

#### B3 Reading progress in the back-to-top button (Heo)
- **What:** The back-to-top button shows how far down the page you are, as a percentage.
- **Why:** One element does two jobs, with less chrome than a separate progress bar.
- **How:**
  - Calculate `Math.round(scrollY / (scrollHeight - innerHeight) * 100)` and update it inside `requestAnimationFrame`.
  - Keep the button's accessible name as "Back to top", and hide the number from screen readers.

#### B4 Quote into comment + jump to comments (Heo)
- **What:** Selecting a passage offers "quote into comment" (引用到评论), which drops the passage into the comment box as a quote. A floating button jumps straight to the comments.
- **Why:** Thoughtful replies take less effort.
- **How:** Read the selection with the Selection API, insert `> quoted text` into the comment field and focus it. This needs a comment system whose input box you can fill from a script.

#### B5 Feedback link prefilled with the post (Heo)
- **What:** The feedback link at the end of each post carries that post's URL and title.
- **Why:** Nobody has to explain which article they mean.
- **How:**
  - With a public GitHub repo, link to `https://github.com/<user>/<repo>/issues/new?title=<post title>&body=<post URL>`.
  - Otherwise, use a `mailto:` link with the subject and body filled in.
  - URL-encode both values either way.

#### B6 Continue on your phone (ImQi1)
- **What:** Each post ends with an offer to keep reading on a phone, via a QR code. ImQi1 also offers a WeChat mini-program.
- **Why:** It makes the handoff from desktop to phone smooth for long reads.
- **How:** Render a QR code for the canonical URL, either at build time as an SVG or with a small client-side library. Hide it on mobile.

#### B7 Small craft details (ImQi1)
- **What:**
  - Code blocks labelled with their filename.
  - A skip-to-content link.
  - Live Photos that play inside the zoomed image viewer. He added this one because a commenter asked for it.
- **Why:** Small details signal care, and acting on reader requests builds loyalty.
- **How:**
  - Support a code fence like ```` ```js main.js ```` (ImQi1 uses `js+main.js`) and render the filename as a header.
  - Make `<a class="skip-link" href="#main">` the first focusable element on the page.

### C. Navigation & discovery

#### C1 ★ Pop-up console (Heo)
- **What:** The avatar button (or `Shift+A`) opens one panel. It holds recent posts, must-reads, recent comments, tags, stats, the dark-mode switch, the shortcut list, and a grid linking the owner's other projects.
- **Why:** This is progressive disclosure: secondary navigation lives in one place, so the main layout stays calm. It's the strongest idea on Heo's site.
- **How:**
  - Use a native `<dialog>`, which handles focus and closes on Esc. Open it with a button and the shortcut.
  - Build its contents at build time from a JSON index.
  - "Recent comments" needs the comment system's API.

#### C2 Keyboard shortcuts with an off switch (Heo)
- **What:** Heo's shortcuts are `Shift+D` for dark mode, `Shift+M` for music, `Shift+H` for home, and `T`/`P` for audio. `Shift+K` turns them all off. The cheat sheet lives in the console.
- **Why:** Power users love shortcuts. The off switch matters because single-key shortcuts misfire for speech-input users, and WCAG 2.1.4 requires a way to turn them off or remap them.
- **How:**
  - Ignore key events while focus is in an input, a textarea or a contenteditable element.
  - Save the on/off setting in `localStorage`.
  - Never bind ⌘/Ctrl+F (see section 4).

#### C3 ★ Curated entry points + Must-read page (Heo)
- **What:** The category bar starts with Featured, Hot and Must-read before the normal categories. Must-read also has its own page.
- **Why:** Newcomers want your best post, not your newest. A Must-read page is one of the best ways to welcome first-time visitors.
- **How:** Add front-matter flags (`featured: true`, `mustRead: true`) and generate the pages from them. "Hot" needs analytics data, so skip it on a purely static site.

#### C4 ★ Unread markers (Heo)
- **What:** Post cards show an "unread" badge (未读) until the visitor has read that post.
- **Why:** Returning visitors see straight away what's new to them.
- **How:**
  - When a visitor reads past about 50% of a post, add its slug to a set in `localStorage`. Cards check that set.
  - Add a "mark all as read" option.
  - Skip the badges on a visitor's first visit, when every post would be unread.

#### C5 Search with scopes (Heo)
- **What:** The search window has tabs for everything, posts, friend links, Heo's blog aggregator and comments. Article pages add a "current page" tab.
- **Why:** A small blog doesn't have enough posts for search to be very useful. Searching friends' sites and comments widens the pool.
- **How:**
  - Build a static index for posts (for example Pagefind, or a JSON index with Fuse.js) and use the scope tabs as filters.
  - External scopes like friends' posts need a scheduled build job that indexes their feeds.
  - Open search with `/` or ⌘K/Ctrl+K.

#### C6 Clear content types (ImQi1)
- **What:** Four content types: Notes, Photos, Tech and Discussion. Each has a one-line description and its own homepage section. Photos get a captioned photo strip where each image links back to its post.
- **Why:** Visitors understand right away what kinds of writing live here and where to find them.
- **How:** Add a `type` field to the front matter. Give each type its own section and card style. Build the photo strip from images across all posts.

#### C7 Random post + webrings (both)
- **What:** Heo has a random-post button (随便逛逛). Both sites have webring buttons that send you to a random independent blog: 开往 (Travellings) on both, and 虫洞 on ImQi1.
- **Why:** Serendipity, plus a connection to a wider blog community.
- **How:** Pick a random URL from a list of posts generated at build time. For a webring, link to the ring's "go" URL.

### D. Signs the site is maintained

#### D1 ★ Labelled public changelog (ImQi1)
- **What:** The changelog sits on the homepage. Each entry is tagged as added, improved, design or fixed.
- **Why:** Returning visitors see what's new, and it shows ongoing care.
- **How:** Keep a `changelog.md` or JSON file. Show the latest 3–5 entries on the homepage and the full list on `/changelog`. The entries can be generated from conventional-commit messages.

#### D2 "New version" prompt (Heo)
- **What:** When the site has been updated, a small button (新更新) appears offering to refresh.
- **Why:** Visitors don't end up silently looking at a stale cached copy, and nobody gets forced into a reload.
- **How:** This only applies if you use a service worker.
  1. Detect a waiting worker (`registration.waiting`) and show a toast.
  2. On click, send the worker a `SKIP_WAITING` message. The worker then calls `self.skipWaiting()`.
  3. Reload the page when `controllerchange` fires.

#### D3 Publishing heatmap (ImQi1)
- **What:** A GitHub-style grid on the About page shows when posts were published. It can be filtered by category and tag.
- **Why:** It shows consistency and history at a glance.
- **How:** Build a JSON file of post dates and render a 53×7 grid with CSS grid or SVG. The filters re-render from the same data.

#### D4 Ten-year pledge progress bar (ImQi1)
- **What:** ImQi1 joined 十年之约, a pledge to keep a blog running for ten years. He shows a progress bar of days kept out of 3,652, from 2024 to 2034.
- **Why:** A public commitment builds trust.
- **How:** Compute the progress client-side from the start and end dates.

#### D5 Live behind-the-scenes info (both)
- **What:** Heo's footer shows the live status of his projects and links to a status page. ImQi1 shows the current build hash and a live GitHub repo card on his About page.
- **Why:** It signals that the site is real, maintained and open about how it works.
- **How:**
  - Inject the commit SHA at build time (`GITHUB_SHA` in GitHub Actions).
  - Fetch repo stats from the GitHub API and cache them, because the unauthenticated rate limit is low.
  - Use an uptime service's badge for the status.

### E. Community

#### E1 Friends' posts on the homepage (ImQi1)
- **What:** A built-in feed reader shows the latest posts from blogs ImQi1 follows, along with a map of where those blogs are.
- **Why:** Generosity builds a network, and it gives visitors somewhere to go next.
- **How:** Use a scheduled build job (for example a GitHub Actions cron) to fetch friends' RSS/Atom feeds into JSON at build time. Fetching other sites' feeds from the browser usually fails because of CORS.

#### E2 Map with three views (ImQi1)
- **What:** One map has three views: places the owner has travelled, where commenters are (rounded to city level), and where the server is.
- **Why:** It's personal, visual and fun to explore.
- **How:**
  - Use Leaflet or MapLibre, with a static GeoJSON file for the travel view.
  - The commenter view needs a server-side IP lookup from the comment system.
  - Keep the commenter view at city level or coarser, and show only aggregates, never individual points.

#### E3 Shuffled friend links (Heo)
- **What:** The footer shows a few friend links with a shuffle button (换一批).
- **Why:** Every friend gets some exposure, instead of the same few forever.
- **How:** Pick a random subset of the full list client-side, and pick again on each click.

#### E4 Sponsors on display (Heo)
- **What:** A sponsor wall invites visitors to sponsor and appear on it. The About page has a public thank-you list with names, amounts, dates and a running total.
- **Why:** It's social proof, and it shows gratitude publicly.
- **How:** Maintain a JSON file by hand, or pull from the sponsor platform's API.

#### E5 Commenter profiles (Heo)
- **What:** The console shows each visitor their own comment level, comment count, first-comment count and high-quality comment count. Heo's visitor ID (HeoID) can even be added to Apple Wallet.
- **Why:** It rewards good commenting and builds a recognizable community.
- **How:** This needs your own comment backend with user identity. It's the heaviest idea in this file, so leave it for last.

### F. About page

#### F1 Chaptered / bento About page (both)
- **What:** Neither site uses a single block of text for the bio. Both split it into cards or chapters.
  - **ImQi1:** numbered chapters (hometown, skills, interests, personality, stats, contact), skills in tabs with a written description for each area, and an MBTI card with animated bars.
  - **Heo:** a headline with a rotating word, a constantly scrolling strip of tool icons, a career timeline, cards for location, games and music, a "why I built this" section, and a thank-you list.
- **Why:** It's easier to scan, and it shows more personality than a paragraph bio.
- **Lesson:** Heo's scrolling icons look nicer, but ImQi1's written descriptions tell visitors far more about what he can actually do. Lead with substance and decorate second.
- **How:**
  - Use CSS grid for the bento layout.
  - Only number chapters if they really are a sequence.
  - Use at most one ambient animation: the scrolling strip *or* the rotating word, not both.
  - Mark the duplicate copy that makes the strip loop as `aria-hidden`.

---

## 4. Avoid

| Pattern | Seen on | Why | Do instead |
|---|---|---|---|
| Taking over ⌘/Ctrl+F for site search | Heo | Breaks muscle memory and the browser's own find. A "current page" search tab softens it but doesn't fix it | Open search with `/` or ⌘K/Ctrl+K |
| Replacing the native right-click menu | Heo | Loses browser items such as Inspect, Save As, Translate and extension entries | Leave it alone, or offer Shift+right-click for the native menu and never take over text inputs |
| Full-screen loading screens | ImQi1 (skippable with click/Esc) | Static or server-rendered content is already there, and the loader hides it | Show content immediately; use skeletons only for parts that really load later |
| Feature overload | Heo | Console, sidebar, app grid, AI button, music, read-aloud, podcast, radio mode and a Simplified/Traditional Chinese switch all compete with the writing. Heo's own recent rebuild post mentions removing many animations and redundant code | Copy the console idea, not the number of features |
| Homepage that opens with a tech write-up | ImQi1 | Works there because his CMS is open source and the homepage doubles as its landing page. On a normal blog it buries the writing | Put "why I built this", the stack and any component demos on a `/colophon` page |

---

## 5. Suggested starting set

These five give the best payoff for the effort, in this order:

1. **C3** Must-read page
2. **C4** Unread markers
3. **C1** Pop-up console
4. **A1** First-character placeholders
5. **D1** Labelled changelog

All five work on a fully static site such as GitHub Pages. They need only templates, front matter and `localStorage`.

These need a backend or an external service: **B1** (the Q&A part), **E2** (the commenter view) and **E5**.

---

## 6. Decisions

Fill this in as choices are made, so later design sessions know what's settled.

- **Base direction:** _undecided_. Choose between ImQi1-style (quiet, text-first) and Heo-style (app-like, feature-packed), based on what the site is mainly for and who reads it.
- **Accent color:** _undecided_
- **Typefaces:** _undecided_
- **Adopted:** _(ID, date, note)_
  - D1, 4 Oct 2026: the Changelog (`/changelog/` and the fold at the bottom of the home page), each change labelled New, Improved, Design or Fix (D50 in PLAN.md).
  - C7 (the random part), 4 Oct 2026: Random and the palette's Surprise me (D45).
  - Close to C5, 4 Oct 2026: the Ctrl/⌘+K or `/` command palette finds pages, Lab tools, games, effects and posts (D43). No scope tabs.
  - B7 (already there before this file): code blocks can carry a file name, and every page has a skip-to-content link.
- **Note:** the home page's welcome screen is a full-screen first-visit greeting, the kind of thing section 4 warns against. It was a deliberate choice; weigh it if this comes up.
- **Rejected:** _(ID, reason)_

---

## Sources

- **ImQi1:**
  - [homepage](https://imqi1.com/)
  - [About](https://imqi1.com/about)
  - [site features post](https://imqi1.com/content/note/1020)
  - [design-tips post](https://imqi1.com/content/tech/821)
  - [CMS source code](https://github.com/imqi1-github/imqi1-cms)
- **Heo:**
  - [homepage](https://blog.zhheo.com/)
  - [About](https://blog.zhheo.com/about/)
  - [example article page (his post on the new search)](https://blog.zhheo.com/p/mgii3qy1.html)
  - [Must-read list](https://blog.zhheo.com/must-read/)
