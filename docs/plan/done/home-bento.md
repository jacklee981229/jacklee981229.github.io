# Jack's Space — Home as a bento dashboard

The home page stops being a list of 2023 posts and becomes one screen that shows what's alive on the site: who I am, what I'm up to, the Lab, recent changes, my Collection, my travels and my writing, as tiles on one grid.

**The approved mockup is `docs/home-bento.png`** (desktop, dark theme). Follow its structure: the grid, the tile sizes and positions, and the anatomy of every tile. Don't copy its placeholders: the grey covers, the drawn dot pattern standing in for an effect, and `[count]`. This brief says what goes there instead.

Same process as before (CLAUDE.md): decisions at the end of this file (the next free D number), test steps in TESTING.md, "Where things live" kept current, CLAUDE.md's UI checks, a changelog line. One task; stop for my OK before committing. The layout is already approved, so no new mockup: build it, then show me 1280 px and 375 px in dark, light and Starry Night.

**Do this after the About / old posts / counter plan** (`docs/about-legacy-counter-images.md`): this page uses its GoatCounter module and its "Start here" flag.

---

## 1. What goes, what stays

**Leaves the home page:**

- The posts timeline (`PostLog`, `PostCard` on the home page) and its pagination. `/page/N/` goes: redirect every `/page/N/` to `/writing/` in `astro.config.mjs` (Writing already lists every post), like the Archives redirects. The sitemap check will catch anything left over.
- The topic row (`TopicLegend` on the home page). If the earlier plan already moved Hexo last in it, the row simply goes.
- The sidebar: `ProfileCard`, `NowList`'s home card, `TagCloud` and `SiteInfo`. Their content moves into tiles; the tags don't come back.
- The changelog fold at the bottom (`ChangelogFold`). The Latest changes tile replaces it.
- Components that end up unused anywhere: delete them, and their tests and CLAUDE.md lines.

**Stays:**

- The header, the footer, the command palette, Starry Night.
- The welcome screen, as it is.
- The typing title, if it works with the two-line title (section 4). If it doesn't, show me the options instead of dropping it silently.

**Text to change** (I'll approve the words):

- The tagline is no longer "My programming journal". The mockup's "Things I build, play and collect." is a placeholder; offer two or three options, and I'll pick.
- Update `SITE.tagline`, the page `<title>`, the meta description and `og:description` to match. They all still say "programming journal".

---

## 2. The grid

- Inside the existing page container (`.wrap`, `--content-max`, `--gutter`), not a new width. Top padding as on other pages; `--space-8` below the grid before the footer.
- **4 equal columns**: `grid-template-columns: repeat(4, minmax(0, 1fr))`, gap `--space-4`. Rows at least about 10.5rem tall (`grid-auto-rows: minmax(…, auto)`), so tiles in the same row always share one height and their edges line up on both axes.
- **Desktop placement:**

| Tile | Columns | Rows |
|---|---|---|
| Hero | 1–2 | 1–2 |
| Now | 3 | 1–2 |
| Travel | 4 | 1 |
| This site | 4 | 2 |
| Lab | 1–2 | 3 |
| Latest changes | 3–4 | 3 |
| Collection | 1–3 | 4 |
| Writing | 4 | 4 |

- **Tablet** (reuse the home page's existing breakpoint, 1099px, rather than inventing one): 2 columns. Hero, Lab, Latest changes and Collection span both; Now, Travel, This site and Writing take one each. Use `grid-auto-flow: row dense` so no holes appear.
- **Phone** (the site's existing phone breakpoint): 1 column, in this order, which is also the order in the HTML: **Hero, Now, Lab, Latest changes, Collection, Travel, Writing, This site**. Desktop positions are set explicitly, so the HTML order can serve phones and screen readers.
- No tile ever scrolls inside itself or clips its content. If something doesn't fit, the row grows.

---

## 3. One tile anatomy

Make one shared component (e.g. `HomeTile.astro`) and use it for every tile except the Hero's outer shell, so the tiles can't drift apart.

- **Box:** background `--surface`, 1px `--rule` border, radius `--radius-lg`, padding `--space-5`. In the light theme, add `--shadow-card` like the other light cards; in dark it's `none` already.
- **Header row:** at least 28px tall, `space-between`:
  - Left: an icon chip (28×28, radius `--radius-art`, background `--wash`, a 16px icon from `Icon.astro` in `--muted`), then the title as an `h2` in `--text-ui`, weight 700, slight negative tracking.
  - Right: a short meta line in `--text-sm`, `--muted` (e.g. "Updated today", "7 tools · 4 games · 18 effects"), or a small link ("See all").
- **Colour is rare.** Every chip is neutral grey except the Lab's, which uses the Lab's green. Colour otherwise only comes from data that already has colour: the travel places, the changelog labels, the rating stars and the topic dots.
- **Links:** the tile itself is not one big link (no nested links). Each tile has its own links inside, and one obvious way into its section (the title or a link at the bottom).
- **Body:** a flex column with `--space-4` between parts; a "see more" link sits at the bottom (`margin-top: auto`), so bottoms line up across a row.
- Each tile is a `section` labelled by its `h2`. All text and controls meet CLAUDE.md's contrast and 44px touch-target rules.

---

## 4. The tiles

### Hero (columns 1–2, rows 1–2)

- Its own padding, larger than the others (`--space-6` to `--space-7`); same box otherwise.
- **Title:** "Jack's Space" on two lines (*Jack's* / *Space*), `--display-weight` and `--display-tracking`, line-height about 0.9, as large as fits the tile: about 92px at 1280px, down to about 56px. Two lines on purpose, not by wrapping chance.
- **Tagline** under it (section 1), `--text-lg`, `--ink`.
- **Bottom of the tile:** the avatar (the real one, 40px round), "Jack Lee" in bold, the job line in `--muted` (the same data `ProfileCard` uses today). Under them, the four profile links (Resume, LinkedIn, GitHub, Email) as text pills: `--radius-pill`, 1px `--rule` border, at least 44px tall. Reuse `ProfileLinks` if it can take this form.
- The old profile counts (posts / topics / tags) don't come back.

### Now (column 3, rows 1–2)

- From `src/content/now.md` through the existing parser (`now-file.js`). Header meta: the existing "Updated …" date, worked out in the browser as now.
- **First item, larger:** if it matches a Collection item, its real cover at 72×96 (radius `--radius-art`, set size, through the existing link-up); otherwise an icon box of the same width. Then the label in `--text-sm` `--muted` and the value at about 17px, weight 700.
- **Further items:** an icon box 72×44 and the same two lines. Up to three items, with a 1px `--rule` line between them.
- **Icons from the file:** a label in now.md that starts with an emoji ("🎮 Playing") shows that emoji large in its icon box and the rest ("Playing") as the label. No emoji: a neutral icon. now.md's format doesn't change.
- Bottom link: "See the Now page". Empty now.md: a quiet one-line note in the tile, never an empty hole in the grid.

### Travel (column 4, row 1)

- **A big number:** how many places are on the Travel Map (counted from the data), at the stat size (below), with "places so far" under it in `--text-sm` `--muted`.
- **A small static globe** (about 88px) on the right: drawn at build time as inline SVG from the Travel Map's own projection code, centred on the visited places, with them filled in the `--visited-*` colours. No script and no animation, kept light (small-scale outlines are enough).
- The title links to `/travel/`.

### This site (column 4, row 2)

- **A big number:** days since `SITE.started`, at the stat size, with "days running" beside it; recomputed in the browser like `SiteInfo` does today.
- **A line under it:** "N visitors · updated D MMM YYYY". The visitors come from the GoatCounter module (live site only; leave that part out locally or when it fails). The date is the existing "last update" logic and links to `/changelog/`.

### Lab (columns 1–2, row 3)

- Header meta counted from `src/lib/lab/tools.js`: ready tools, games and effects. No hard-coded numbers.
- **Left, "Today's toy":** a real effect running in a stage, using the existing effect code (`EffectStage`, `src/effects/`).
  - Stage: radius `--radius-md`, at least 200px tall, in the Lab's own colours. Today those are scoped to `:root[data-area="lab"]`; let a subtree opt in too (e.g. `[data-area="lab"]` on the tile), keeping the measured contrast. In the light theme, use whatever the Lab uses in light.
  - **Picked by the date:** the same effect for everyone on a given day, a different one the next day, worked out in the browser from the visitor's date (no rebuild needed). Put the rule in `src/lib/` with a test; it must not pick the same effect two days running.
  - A caption over the bottom-left corner: "Today's toy" in `--text-xs`, the effect's name in bold, on a nearly opaque Lab-coloured backing so it stays readable. The caption links to that effect's page.
  - It runs only while visible (pause offscreen), works with touch as well as a pointer, and never takes keyboard focus or scroll. **Reduced motion:** show the effect's still `EffectCover` instead of running it.
  - This is the only thing on the page that keeps moving. Nothing else animates on its own.
- **Right:** three rows (name left in weight 600, kind right in `--muted`: Tool / Game / Effect): the most visited tool, game and effect from the Lab's Most Popular data, one of each. Without data, the first ready item of each kind. Rows are separated by `--rule` lines, each at least 44px tall.
- Under them, a full-width **Surprise me** pill (dice icon, `--wash` background) using the same pick as the palette's Surprise me.
- On narrow widths the stage and the rows stack.

### Latest changes (columns 3–4, row 3)

- From `src/content/changelog.md` through the existing parser. The four newest lines, grouped under their dates (date label in `--text-sm` `--muted`). Reuse the changelog's own label styles (New, Improved, Design, Fix).
- **Labels sit in a fixed-width first column** (wide enough for "Improved"), so every line's text starts at the same x.
- Header link "See all" goes to `/changelog/`.

### Collection (columns 1–3, row 4)

- Header meta counted from the data, e.g. "Movies 8 · Games 7".
- **Five covers in a row** (`repeat(5, minmax(0, 1fr))`, gap about `--space-4`; three per row on phones). Pick them by interleaving the collections in file order (Movies 1, Games 1, Movies 2, …), so I choose what shows by reordering my YAML.
- **Each item:** the real cover through `pictureOf` with its size set (portrait 3:4 frame, `object-fit: cover`, radius `--radius-image`), the name in about 14px weight 600 (wrapping to two lines at most), then its stars with the existing `Stars` component. Each links to `/collections/#<collection>`.

### Writing (column 4, row 4)

- Header meta: the number of listed posts.
- **Three rows:** the "Start here" posts if any are marked (earlier plan), otherwise the newest non-Hexo posts. Each row: the topic's lane dot, the title in weight 600, the date under it in `--text-xs` `--muted`; `--rule` lines between rows.
- Bottom link: "All posts", to `/writing/`.

---

## 5. Look and feel

- **Tokens only**, as CLAUDE.md says. If the big stat numbers (about 2.75rem, display weight and tracking, line-height 1) or the row height have no fitting token, add one to `tokens.css` rather than writing raw values.
- **Type:** Schibsted Grotesk throughout; IBM Plex Mono only where the site already uses it. Hierarchy comes from size and weight, not colour.
- **Hover and focus:** links use the site's existing hover and focus styles. Tiles don't lift, tilt or glow.
- **Themes:** check all three. In light, tiles carry `--shadow-card`. In Starry Night, the tiles stay opaque over the sky, and the Lab stage keeps the night's colours or the Lab's, whichever reads better (show me).
- The page should feel calm: one moving thing (Today's toy), everything else still.

---

## 6. Logic and tests

Pure logic goes in `src/lib/` with node tests, like the rest:

- today's toy from a date (stable within a day, never the same two days running)
- the collection interleave
- the Writing picks (Start here first, Hexo excluded)
- the four newest changelog lines with their dates
- the emoji/label split for Now items

---

## Done when

- [ ] The home page matches the mockup's structure at 1280px.
- [ ] It stacks as described at tablet and phone widths with no holes, no clipping and no sideways scroll.
- [ ] Every number and list comes from real data.
- [ ] Today's toy changes by date and respects reduced motion.
- [ ] `/page/N/` redirects to `/writing/`.
- [ ] The removed components are gone.
- [ ] The tagline and meta text are the ones I picked.
- [ ] It looks right in dark, light and Starry Night.
- [ ] `npm test`, `npm run check` and `npm run build` (with the sitemap check) pass.

---

## Decisions and tasks

- **D68. The home page is a bento of tiles**, as this brief lays out: Hero, Now, Travel, This site, Lab, Latest changes, Collection, Writing, on four columns from 1100 px, two below, one on phones. The posts feed, the timeline graph, the topic row, the tag cloud, the changelog fold and the paging are gone (`/page/2/` forwards to `/writing/`; there was no `/page/3/`). The pinned flag went with the feed. Post pages keep their profile card and Site info.
- **D69. Today's toy** is one of the effects, picked from the visitor's date with a step that shares no factor with the number of effects, so it never repeats two days running and comes round to every one. Key Jam is left out: it plays sounds, which a page you've only opened shouldn't. With less motion asked for it shows the stage's own still picture (the effect drawn once) rather than its `EffectCover`: the toy is picked in the browser, so the page would have to carry every cover (about 200 KB) to show one.
- **D70. The Lab tile's rows** are the most visited tool, game and effect from the same GoatCounter counts as the Lab's Most Popular (`bestOf`), else the first ready one of each kind.
- **D71. The tagline** is "Things I build, play and love" for now, until Jack picks: that, "Code, games and the things I like", or "Notes, little tools and favourite things". The title, meta description and `og:description` follow `SITE.tagline`.
- **D72. The hero has two parts.** At the top, the title and tagline with the links in a column on their right (the title alone only filled half the tile); the title has more room (line height 1, more space before the tagline). At the foot, under a line edge to edge, Jack and his job, on one line. On phones the links go back to a row, under the tagline.
- **D73. No underlines on links that stand on their own**, on every page: tile titles, "See all", "See the Now page", "All posts", the update dates, the footer's Changelog, a post's topic and its Newer and Older links get the arrow chip (`Go.astro`: a tinted pill and an arrow under the mouse). List rows (Writing, the Lab tile) take the same tint, covers grow a little, and the Copy link and "Show more code" buttons tint instead of underlining. Links inside sentences keep their underline.
