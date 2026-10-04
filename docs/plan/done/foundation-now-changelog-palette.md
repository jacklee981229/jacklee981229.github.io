# Jack's Space — Foundation, Now, Changelog & Command Palette

Three tasks, in order: **1 → 2 → 3a → 3b → 3c**. Do one at a time and stop for my OK after each, as usual (CLAUDE.md). Each part gets its own commit, so any one of them can be reverted on its own.

For every part: record the decisions at the end of this file (the next one is D37), add test steps to TESTING.md, keep CLAUDE.md's "Where things live" up to date, and pass CLAUDE.md's UI checks. No new packages and no version changes without asking.

The findings below were checked against the repo at `5cbd2c8` (3 Oct 2026). Confirm them before changing code.

---

## Task 1 — Foundation check

Fix the real gaps, and make consistency part of the structure, so the new pages in Tasks 2 and 3 can't drift. No new features.

Collections' and the Travel Map's tops already match Writing and the Lab home (D34). Don't redo that.

### 1.1 Sitemap

`/sitemap.xml` and `/sitemap.txt` both come from `publicPages()` in `src/lib/collections.ts`. They already cover the home pages, Writing, Archives, tags, Collections, Travel, About, the Lab, ready tools, effects and listed posts, with trailing slashes and without drafts or hidden posts.

- **Bug: the four Lab games are missing** (`/lab/game/2048/`, `/lab/game/catch-the-cat/`, `/lab/game/snake/`, `/lab/game/blocks/`). They're `hidden: true` posts, so `listedPosts()` drops them, and the Lab part of `publicPages()` only adds tools and effects. Add them (`EXPERIMENTS`, `experimentPosts()`).
- **Add a check at the end of `npm run build`**, so a mismatch stops the deploy: every page in `dist/` must be in `sitemap.xml`, and every address in it must exist in `dist/`. Skip 404, the redirect pages and anything marked `noindex`. The comparison goes in `src/lib/` with a test, like the rest. From then on, a page missing from the sitemap fails the build, including `/now/` and `/changelog/` later in this plan.

### 1.2 robots.txt

There isn't one. Add it as a route beside the sitemaps, so the address comes from `site`: allow everything, and point to the sitemap.

### 1.3 One shared page top

Every main page hand-writes the same top: `h1.page-title`, `p.lede`, then its controls with its own `margin-top`. That's how pages drift.

- Make `src/components/PageTop.astro`: the big title, an optional lead, and an optional slot for what sits under them (the Collections tabs, the Travel switch, the Lab's buttons), with that spacing in one place. Allow an icon in the title (the Lab home has one).
- Use it on every page with this top: Writing, Archives, the Lab home, Collections, Travel, About, a tag's page, `/page/N/`, 404 and Random. Not on the home page, posts, or Lab tool, game and effect pages (they have `LabHeader`).
- It's a refactor: compare every page before and after at 375 px and 1280 px in both themes. Nothing visible should change.
- In CLAUDE.md, replace "A new page's top copies those" with: a new page starts with `PageTop`, and no page sets its own title size, top spacing or lead style.

### 1.4 Raw radii

CLAUDE.md says radii come only from tokens, but these have raw values: `SearchDialog.astro` (12px, 3px), `Cover.astro` (10px, 14px), `PostScripts.astro` (12px), `lab/json-preview.astro` (4px), `travel.astro` (3px), `global.css` (3px), `prose.css` (4px, 12px). Use a token where one matches (14px is `--radius-md`), or add one, whichever keeps the look.

**Done when:** the games are in the sitemap, the check runs in every build, robots.txt is live, those pages use `PageTop` and look unchanged, and no raw radius is left outside `tokens.css`.

---

## Task 2 — Now

A small card that says what I'm up to. I update it by editing one file, without asking you.

### The file

`src/content/now.md`. This is the whole file:

```md
<!-- One line per item, like "- 🎮 Playing: Shape of Dreams". Anything under the list shows only on /now/. -->
- 🎮 Playing: Shape of Dreams
- 💻 Building: Jack's Space
```

The rules (parser in `src/lib/now.js`, with tests):

- Each list item is one line, in file order.
- Text before the **first** colon is the label (the emoji is part of it); the rest is the value. Values may contain colons (`Monster Hunter: World`) and never need quotes. A line with no colon shows as a plain line.
- Values may contain Markdown links.
- Any text under the list is a note, shown only on `/now/`. Comments are ignored.
- No front matter, no date to write.
- Nothing in this file can break the build: it's the one I'll edit on my phone. An empty or missing file just means no card.

### The date

- Take it from git: the last commit that touched the file (`git log -1 --format=%cI -- src/content/now.md`). If git has no answer, leave the date out.
- Add `fetch-depth: 0` to the checkout in `deploy.yml`. The clone is shallow now, so every file looks changed in the newest commit and the date would be wrong.
- Show it as "Updated 3 days ago", worked out in the browser like Site info's "Running for", so it doesn't freeze at build time. Without JavaScript the plain date shows. The relative-date rule goes in `src/lib/` with tests.

### Where it shows

- **The home sidebar**, directly under the profile card: a `.block` like Tags and Site info, titled "Now", with up to three items, the date, and a link to `/now/`. On phones the sidebar comes after the posts; that's accepted.
- **`/now/`**: `PageTop` titled "Now", then every item, the note and the date. In the sitemap, not in the menu.
- **Collections link-up:** when a value matches an item's name in any collection (ignoring case), show that item's cover as a small thumbnail and link to its tab (`/collections/#games`). Shape of Dreams is already there. Use the Collections page's picture lookup (`pictureOf` in `src/lib/shelves.js`), with the size set.

**Done when:** I change only `now.md` (say, on github.com from my phone), commit, and both the card and `/now/` update with the right date.

---

## Task 3a — Changelog

A page listing what changed on the site, in plain words.

### The file

`src/content/changelog.md`, the same shape as `now.md`:

```md
<!-- One line per change, like "- 2026-09-26: Rebuilt Jack's Space from scratch with Astro". Any order; the page sorts them. -->
- 2026-09-26: Rebuilt Jack's Space from scratch with Astro
```

- The date (`YYYY-MM-DD`) before the first colon, the text after. Markdown links are allowed, e.g. to the page a change is about.
- A bad date stops the build with a message naming the line. Unlike Now, you'll write most of this file.
- Lines on the same date keep their file order.
- Share the list reading with `now.js` rather than writing it twice.

### How the lines read

Casual, plain English, past tense, one short line (under about 70 characters), about what a visitor would notice. No jargon: no Pagefind, GoatCounter, tokens, embeds, refactors or CI. For example:

- Rebuilt Jack's Space from scratch with Astro
- Made my own 2048 and Catch the Cat
- Opened my Collection and a Travel Map

### The first fill

- Go through this repo's `git log` (21 commits, 26 Sep – 3 Oct 2026). Merge commits about the same thing on the same day, and skip what no visitor would notice (comma fixes, Moiré removed, small polish). Around a dozen lines.
- The site has run since 2023-02-23 (`SITE.started`), on Hexo until the rebuild, so the first line is "Started Jack's Space on Hexo". If the backup of the old Hexo repo (D2) is on this PC, add a few milestones from its history.
- Show me the list before it goes on the page.

### The page and the ways in

- `/changelog/`: `PageTop` ("Changelog" and a short lead), then the lines newest first, grouped by year like Archives. Reuse Archives' pattern rather than inventing one. In the sitemap, not in the menu.
- The footer: a "Changelog" link beside "Built with Astro."
- Site info: "Last update" shows the later of the newest post and the newest changelog line, and links to `/changelog/`.
- The palette (3b).

### Keeping it up to date

Add to CLAUDE.md: when a commit changes something a visitor can see, it adds a changelog line in this style, in the same commit. Invisible changes get none.

**Done when:** `/changelog/` shows the list I approved, the footer and Site info link to it, and the CLAUDE.md rule is in.

---

## Task 3b — Command palette

The Ctrl+K search (`SearchDialog.astro`) becomes a command palette. Same ways to open it (Ctrl/⌘+K, `/`, the header button), the same dialog look, and the same Pagefind search for posts.

### What it finds

Today it only finds posts: Pagefind indexes post pages only, so the Lab's tools, games and effects can't be found at all. The palette adds items built from lists the site already has, so new things show up by themselves. In this order:

1. **Actions:** switch theme, Surprise me, fullscreen where it applies, and the night sky once it's been found (3c).
2. **Pages:** everything in `NAV` (`src/site.ts`), plus Now and Changelog.
3. **Lab:** ready tools, games and effects from `src/lib/lab/tools.js`, with their descriptions.
4. **Posts:** Pagefind results as now, under the rest.

- An empty box shows a short list: switch theme, Home, the Lab, Surprise me, fullscreen where it applies, and the night sky once found.
- Items 1–3 show as soon as you type, and work in `npm run dev` too (Pagefind still needs the built site).
- Matching is our own small function in `src/lib/palette.js`, with tests: ignores case, words in any order, word starts rank higher, and an item can carry extra words to match ("dark", "theme", "random"). No new package.
- Icons come from the site's own set (`Icon.astro`), not emoji, so it looks like the rest of the UI.
- When nothing matches, say so plainly, like today's "Try a shorter word."

### Keyboard and touch

- Focus stays in the box: ↑ and ↓ move a highlight (a combobox with `aria-activedescendant`), Enter runs it, Esc closes, and a click or tap runs an item. Today the arrows move focus into the links; change that.
- Enter while an input method is still composing (Chinese input, `event.isComposing`) must not run anything.
- Closing gives focus back to whatever opened it.
- The header button and the box say "Search or run a command", not "Search posts".

### The actions

- **Switch theme:** the label names the theme it switches to. Move the switching out of `Header.astro` into one shared module that both the header button and the palette use (same `theme` key, same cross-fade, same reduced-motion rule), so they can't get out of step.
- **Surprise me = Random, built for real.** There's enough now: 14 posts, 7 tools, 4 games, 18 effects. One list of everything that can be opened, made at build time. The palette goes straight to a random one (never the page you're on). `/random/` becomes what docs/lab-brief.md imagined: "You got …", with Open it and Pick again. Drop "soon" from the Lab home, update CLAUDE.md's Random line, and keep `/random/` out of the sitemap with `noindex`, since it's different every visit.
- **Fullscreen:** only on the Travel Map, Lab games and effects, and it fills the screen with the map, the game or the effect, not the whole page. Hidden where the browser can't do it (`document.fullscreenEnabled`; iPhone Safari can't). Says "Exit fullscreen" while on. Check each one looks right full screen, and leave it off any that doesn't.

**Done when:** everything in the empty list works by keyboard alone and on a phone, any tool, game or effect can be found by name, posts are found as before, and the header button and the palette always agree on the theme.

---

## Task 3c — Starry Night 🌃 (the easter egg)

A hidden look: Jack's Space turns into actual space. You find it by typing a code word into the palette.

### Decided

- **Trigger:** only the code word in the palette, which works on phones too. No Konami code.
- **The word:** I'll tell you in chat. Don't write it into any committed file (this one, PLAN.md, TESTING.md, tests, comments): the repo is public. The script keeps only a hash of the word and compares it with the hash of what's typed (trimmed, ignoring case). Any small hash will do; it's a toy, not security. Tests use a made-up word.
- **Before it's found:** nothing hints at it. Part of the word shows nothing; only the exact word shows a single row, "✨ ???".
- **Finding it:** Enter on that row closes the palette, the page cross-fades into the night (the theme button's View Transition), one shooting star crosses at once, and a small note says what happened and how to turn it off. The existing announcer reads the note out too.
- **After that:** it stays on across visits until turned off (its own localStorage key, not `theme`). Once found, the palette always offers "Starry Night" and "Leave the night sky".
- **Leaving:** while night is on, the theme button shows a star and its label says "Leave the night sky". Pressing it, or the palette item, goes back to the theme from before (the system's, if none was saved).
- **No spoilers:** its changelog line gives nothing away, something like "Hid a little surprise somewhere".

### How it's built

- **Not a third `data-theme` value.** Plenty of code checks `[data-theme='dark']`: the header icons, the Travel Map, Collections, the effects. Night is the dark theme plus an attribute of its own on `<html>` (e.g. `data-sky="night"`), the way the Lab adds `data-area="lab"`. Its tokens go in `tokens.css` and win over the Lab's green.
- The head script in `Base.astro` applies it before the first paint, beside the theme, so nothing flashes.
- `src/effects/stage.js` and `src/lib/travel/globe.js` recolour by watching only `data-theme` (a `MutationObserver`). Make them react to the night attribute as well (or to a shared theme-change event), or they'll keep the old colours when night goes on or off.
- Call the sky something like `NightSky.astro`: `Stars.astro` is already the Collections' rating stars.

### How it looks (mockup first, phone and desktop, for my OK)

A deep indigo-violet sky, clearly apart from the dark theme's deep blue and the Lab's deep green, lighter toward the bottom like a city's glow on the horizon, with a warm starlight-gold accent. A starting point to tune in the mockup:

| Name | Hex | Use |
|---|---|---|
| Zenith | `#0B0E2A` | top of the sky, the page |
| Horizon | `#2B1E4E` | bottom of the sky |
| Surface | `#161A3D` | cards, the palette |
| Moonlight | `#ECEEFF` | text |
| Haze | `#A7ACD6` | muted text |
| Starlight | `#FFD27D` | focus, highlights, lit windows |

Measure every pair (CLAUDE.md's contrast check), the topic lanes, code blocks and the Travel Map's colours included.

- **Stars:** a fixed layer behind the page, CSS only: no canvas and no animation loop. Many faint stars, fewer bright ones, a handful twinkling slowly. Placed at build time from a fixed seed, so the sky doesn't jump between pages. Now and then (every 20 seconds or so) a shooting star. A calm sky, not the Lab's Starfield effect.
- **Horizon:** at the bottom of every page, just above the footer, an invented city skyline with a few lit windows. Scroll to the end and you reach the horizon. It's part of the page, not fixed, so it never covers what you're reading.
- **Reduced motion:** the stars stay still, nothing twinkles or shoots, and the switch is instant.
- **Cheap:** no work at all while night is off, no layout shift, smooth scrolling on a phone.
- Check the welcome screen, games, effects and code blocks in the night.

**Done when:** the word turns it on (phone and desktop), it's still on after closing and reopening the site, the theme button and the palette both turn it off back to my previous theme, everything above looks right in the night, contrast passes, and reduced motion is respected.

---

## Not in this round

A history of past Nows, a changelog feed, more palette commands (copy link and so on), a Konami code, Now or Changelog in the menu.

---

## Decisions and tasks

Your plan of 4 Oct 2026, above: a foundation check (sitemap, robots.txt, one shared page top, radii), a Now card and page, a Changelog, the search turned into a command palette with Random built for real, and a hidden night sky. You asked for all of it in one go, then one test.

- **D37. The four Lab games are in the sitemap**, and every build checks the sitemap against the built pages (`src/lib/sitemap-check.js`, run from `astro.config.mjs` when the build ends): a page in one and not the other stops the build, and the deploy with it. Redirect pages and pages marked `noindex` stay out. `/random/` is marked `noindex` (it's different every visit).
- **D38. robots.txt** lets every crawler in and names the sitemap. It's a route beside the sitemaps, so its address comes from `site`.
- **D39. One page top, `PageTop.astro`**, on Writing, Archives, the Lab home, Collections, Travel, About, tag pages, `/page/N/`, 404, Random, Now and Changelog: the big title, an optional lead, an optional icon and an optional row under them. Checked pixel by pixel at 375 and 1280 px in both themes: nothing moved.
- **D40. Every corner's roundness is a token.** Four were added to keep the look exactly: `--radius-2xs` (3px), `--radius-xs` (4px), `--radius-art` (10px), `--radius-image` (12px). Circles (50%) and Snake's rounded squares are shapes, not sizes, and stay as they are.
- **D41. Now is one file, `src/content/now.md`**, edited by hand; nothing in it can stop the build. Its date is its last commit's (the deploy now fetches the whole history for this), shown as "Updated 3 days ago" in the browser. The home sidebar shows up to three items under the profile card; `/now/` shows them all with the note. A value naming something in a collection shows its cover and leads to its tab.
- **D42. The Changelog is one file, `src/content/changelog.md`**, read the same way as Now, but a bad date stops the build. `/changelog/` lists it by year like Archives. The footer and Site info's "Last update" lead to it. The first fill came from this repo's history and the old Hexo site's backup.
- **D43. The search is a command palette**: actions (theme, Surprise me, Fullscreen where it applies, the night sky once found), pages, the Lab's tools, games and effects, then posts from the search index as before. Matching is our own small function (`src/lib/palette.js`). The arrows move a highlight while the typing stays in the box; Enter while an input method is still composing does nothing; Esc closes in one press, even with text in the box.
- **D44. One theme switch for the header and the palette** (`src/lib/theme.ts`), so the two always agree.
- **D45. Random is real**: one list of everything that can be opened (posts, tools, games, effects), made while the site is built. The palette's Surprise me goes straight to one (never the page you're on); `/random/` shows "You got …" with Open it and Pick again.
- **D46. Fullscreen** shows only the Travel Map, a game or an effect, on a plain background; hidden where the browser can't do it. All three were checked full screen.
- **D47. Starry Night** is the dark theme with a sky of its own (`data-sky="night"` on the page, its colours last in `tokens.css`, so they win over the Lab's green), found only by typing the secret word into the palette. The page keeps only a fingerprint of the word, never the word. It stays on until left with the star button or the palette, which go back to the theme from before. The stars are placed while the site is built, all CSS but one small timer, and cost nothing while the night is off. With less motion nothing moves.
- **D48. The night is a dark aurora: "Curtains"** (your pick of 4 Oct 2026, out of three first designs and then three aurora ones, in `scratch/mockups/starry-night/`). A near-black sky (#020509) with faint green veils edged in violet, high up, swaying slowly; mint for focus and links. No land and no city at the bottom: this replaces the spec's horizon. Every 10 to 20 seconds one star somewhere blinks with a soft glow. Measured: text at least 7.85:1, the grey intro over the aurora's brightest at least 6.59:1, code colours at least 6.14:1, the map's red 3.99:1 (3:1 is the bar for shapes).
- **D49. Archives is gone** (4 Oct 2026): out of the menu and the sitemap, its page deleted. Writing already lists every post. Its old addresses, the old site's included, forward to Writing, so links in search results and on other sites still land somewhere.
- **D50. The Changelog looks like a release log** (after imqi1.com): a card per day, each change with a label for its kind (New, Improved, Design, Fix), so every line now says its kind. The home page ends with a "Changelog" line right across the page; opening it shows the latest three days and "See all changes". The labels' words stay in the text colour (the colour is in the icon and the tint), because coloured words on their tint fell under 4.5:1.
- **D51. Now's items line up**: the words on the left, a cover (when there is one) at the right.
