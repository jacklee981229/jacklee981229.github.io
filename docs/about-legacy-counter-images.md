# Jack's Space — About, Old Posts, Visitor Counter, Game Covers & Share Images

Six parts, in order: **0 → 1 → 2 → 3 → 4 → 5**. Do one at a time and stop for my OK after each, as usual (CLAUDE.md). Each part gets its own commit.

For every part: record the decisions in docs/PLAN.md (the next free D number), add test steps to TESTING.md, keep CLAUDE.md's "Where things live" up to date, pass CLAUDE.md's UI checks, and add a changelog line when a visitor can see the change.

The home page is being redesigned separately; it's not in this plan. So keep About about me rather than the site's activity, and don't make anything here depend on the home page's current layout.

---

## Part 0 — design-ideas.md only when I ask

docs/design-ideas.md is an idea bank for when I ask for design ideas or inspiration. It is not a rulebook for every UI change.

- In CLAUDE.md, replace "Before proposing any UI, read docs/design-ideas.md…" with: read docs/design-ideas.md only when I ask for design ideas or inspiration.
- In design-ideas.md, "How to use this file" step 4 says the same thing the other way round (check it before proposing any UI). Change it to match.

**Done when:** neither file tells you to read the idea bank unless I ask.

---

## Part 1 — The old Hexo posts

8 of the 14 posts are about Hexo, which this site no longer runs on, and Writing opens with them.

- **A note on every Hexo post:** a short line at the top saying it was written in 2023 for the old Hexo version of this site, which runs on Astro now, so the steps may no longer apply. Draft the wording for my OK. Drive it from the topic (or one front-matter flag), not text pasted into eight files.
- **Hexo goes last** wherever topics are listed: Writing, and the topic row on the home page. The other topics keep their order.
- **Start here:** a front-matter flag (e.g. `featured: true`) and a small section at the top of Writing listing those posts. Suggest two or three non-Hexo posts; I'll pick.

**Done when:** every Hexo post carries the note, Hexo is last in both topic lists, and Writing starts with the posts I picked.

---

## Part 2 — About

Today About has a job title, four buttons and two sentences: under 30 words. Make it a page about who I am, in a few sections, built from the site's existing pieces (`PageTop`, the existing card styles). Not a new look.

1. **Intro:** a short paragraph on who I am, what I do and what this site is.
2. **Work:** a short timeline (role, place, years). I'll give you the entries; don't guess them or pull them from anywhere else.
3. **What I work with:** languages and tools. Draft it from what the posts and this repo show (C#, .NET, WPF, Flutter, Astro and so on); I'll confirm.
4. **Things I like:** a few of the top-rated covers from the Collection, linking to `/collections/`, and the places on the Travel Map (how many and which), linking to `/travel/`. Read them from the existing data; no copies, and no live globe here.
5. **Find me:** Resume, LinkedIn, GitHub, Email (the existing links).
6. **This site:** running since 2023 (`SITE.started`), and a line pointing to the Changelog.

- The words live in `src/content/pages/about.md` (the timeline and the tools in its front matter), so I can change them without touching code.
- Draft the intro only from what the site already says about me, mark anything you're unsure of, and wait for my rewrite or OK. No age or other private details.
- Not on About: Now, the Lab's Most Popular and the changelog list. Those belong to the home page redesign.
- On a phone the sections stack.

**Done when:** About has every section with words I approved, all its lists come from the existing data, and it looks like the rest of the site at 375 px and 1280 px in every theme.

---

## Part 3 — Visitor counter: GoatCounter only

Before you start, I'll turn on **"Allow adding visitor counts on your website"** in GoatCounter's settings (it's off by default). Check with me that it's on.

- **Remove busuanzi:** its script in `Base.astro`, the `busuanzi_*` ids in `SiteInfo.astro` and `[slug].astro`, and any mention in CLAUDE.md.
- **Site totals** from `https://jacklee981229.goatcounter.com/counter/TOTAL.json`; **a post's views** from `/counter/<encoded path>.json`. Check what the live endpoint actually returns (`count`, and `count_unique` if it's there) and map it to Visitors and Page views. If only one number comes back, show one row. The numbers arrive as formatted strings ("1,234").
- Plain `fetch`, no new script. Put the requests in one small shared module, so the numbers are easy to move when the home page changes.
- Live site only, as now; local previews keep their "live site only" note. If a request fails, hide that row rather than leaving a dash there forever.
- **Decided:** the numbers restart from when GoatCounter was added (1 Oct 2026). busuanzi's older totals are dropped.

**Done when:** nothing mentions busuanzi any more (search the repo), the numbers show on the live site, and local previews still show the note.

---

## Part 4 — Game covers

The four games (`/lab/game/2048/`, `catch-the-cat`, `snake`, `blocks`) all show the same "Games" placeholder on their Lab cards, while tools and effects show real previews.

- Give each game post a real cover: a screenshot of the game mid-play (a 2048 board full of tiles, a long snake, a stack of blocks, the cat half trapped), not the start screen. Set it as the post's cover, so it shows on the Lab card and also becomes the game page's share image (Part 5 uses covers where they exist).
- Take the screenshots with a throwaway headless browser run through `npx` from `scratch/`, not a project dependency. Use the same size and framing for all four, and check them on the card in light, dark and Starry Night.
- If a screenshot doesn't read well at card size, draw that cover instead, the way `EffectCover` draws the effects.

**Done when:** each game card shows its own game and looks right in every theme.

---

## Part 5 — Share images

Pages without a cover share my avatar as their preview (`og:image`, with `twitter:card` "summary"). That's the Lab and every tool and effect, Collection, Travel, Now, Changelog, About, Writing, the home page, and posts without a cover.

- **One template, made at build time:** a 1200×630 PNG for each of those pages, in the site's look (the dark palette from the tokens). It shows a small section label (Writing, Lab · Tool, Lab · Effect, Lab · Game, Collection, Travel…), the page title, its one-line description or lead, and "Jack's Space · jacklee981229.github.io".
- **Covers win:** pages with a cover keep using it (posts with covers, and the games after Part 4). Every page gets `twitter:card` "summary_large_image".
- **How:** satori turns the template into SVG with the text as paths, and sharp (already installed with Astro) makes the PNG. **satori is approved by this brief as the one new package.** It can't read woff2, so add TTF or OTF copies of Schibsted Grotesk and IBM Plex Mono (OFL; keep the licence files) outside `public/`, used only for this.
- Static endpoints (e.g. `/og/<page>.png`), made from the same page list as the sitemap, so no page is missed. A test checks that every page's `og:image` points to a file that exists in `dist/`.
- After it's live, I'll check a few links in a preview tool such as LinkedIn's Post Inspector.

**Done when:** every page has a share image (its cover or a generated one), the test passes, and the images look right in a preview tool.

---

## Not in this round

The home page redesign (its own plan), more slash pages, TIL notes, the Lab's "Soon" tools.
