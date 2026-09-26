# Jack's Space v2: plan

**Status: approved 26 Sep 2026.** Tasks 1 to 6, 8 and 9 done: the new site went live on 26 Sep 2026. Then UI tweaks 1 (26 Sep): the Tags page removed, a theme fade and a new hover for the sidebar tags. UI tweaks 2 (26 Sep): a 0.3 s fade, the typing title, menu and card hover, and the welcome screen. Task 9's last check passed on 27 Sep: the UI tweaks push redeployed the site by itself. Site info fixes (27 Sep): the comma in the running days, and "live site only" in place of the counter on local previews. Next: Task 10, our first new post.

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
| About | Keep |
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
