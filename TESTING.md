# Testing

Manual test steps, one section per task. Older sections stay so they can be re-run.

## Task 1: design mockups

The mockups load fonts from Google and images from the live site, so they need internet.

1. Open the mockups page in your default browser:
   ```powershell
   start C:\repos\Jack\jacks-space\scratch\mockups\index.html
   ```
   Expected: a page listing "A. Commit graph (your pick)" and "B. Code editor (set aside)".
2. Open A's Home. Expected: a large "Jack's Space" title in Schibsted Grotesk, topic pills (Hexo 8, Git 1, ChatGPT 2, Games 2, Flutter 1), and the 10 newest posts as rounded cards with the cover on the left. Terraria, Don't Starve, Talk about Hexo Admin, ChatGPT extensions and Flutter Get Started show their own image in front of the faint topic name; the other posts show the topic's icon. The sidebar cards show 14 posts, 5 topics and 12 tags, plus site info (about 1,311 days running, 719 visitors, 1,036 page views).
3. Look at the graph beside the cards. Expected: "2023" at the top, "Oct" beside Flutter Get Started and "Mar" beside ChatGPT - Useful Prompts, and a "6-month break" line between Don't Starve and ChatGPT - Useful Prompts, where the Hexo lane turns dashed. Every lane runs unbroken between cards.
4. Point at "Hexo" in the topic pills. Expected: the Hexo lane and Hexo cards stay bright and the rest dim.
5. Click "Try fonts and cards" (bottom left). Expected: Schibsted Grotesk and "Cover on the side" are selected and marked "Your pick". Picking another font or card style changes the whole page at once, and the pick stays after a reload. Esc closes the panel.
6. Click the moon button (top right), then reload. Expected: dark theme, and it stays dark after the reload.
7. Press Ctrl+K and type `git`. Expected: the search box lists "Git Commands". Type `zzzz`: "No posts match “zzzz”. Try a shorter word." Esc closes it.
8. Open "Hexo Change Default to Page". Expected: a teal line down the left, a Hexo cover banner with a code icon, "On this page" with 2 entries, three yml code blocks with line numbers, and 3 related-post cards at the bottom. Click Copy on the first block: it changes to "Copied", and pasting gives the 4 `index_generator` lines.
9. Open "Flutter Get Started". Expected: a cover banner with the app screenshot in front of a faint "Flutter", and "No other Flutter posts yet." under Related posts. Click the first screenshot in the post: it opens large with the caption "flutter sdk", and Esc closes it.
10. Make the browser window narrow (about phone width). Expected: nothing scrolls sideways, cards show the cover on top, the month labels are hidden (each card shows its date), the year sits beside the lanes, and the lanes stay unbroken.

## Task 2: skeleton

1. Install and build:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm install
   npm run build
   ```
   Expected: the build ends with "33 page(s) built", "Complete!" and Pagefind's "Indexed 14 pages" (it was 6 pages before Tasks 3 to 6 added the posts). npm also prints Node-version warnings (EBADENGINE) and "3 vulnerabilities"; both are expected on Node 20 (see D1 and D8 in the plan).
2. Type-check:
   ```powershell
   npm run check
   ```
   Expected: "0 errors", "0 warnings", "0 hints".
3. Start the local site:
   ```powershell
   npm run dev
   ```
   Open http://localhost:4321/. Expected: the big "Jack's Space" title, "My programming journal." with the intro, the post timeline (Task 4), and the footer "© 2023–2026 Jack Lee. Posts are licensed CC BY-NC-SA 4.0." Ignore the "New version of Astro available" message in the terminal.
4. Click Writing, Archives, Tags and About. Expected: each page opens with its title, and the menu underlines the current page.
5. Open http://localhost:4321/nope/. Expected: "Page not found" with a "Go to the home page" button.
6. Click the moon button (top right), then open another page and reload. Expected: the site stays dark, and the button now offers the light theme.
7. Reload any page and press Tab. Expected: "Skip to content" appears at the top left. Further Tabs move through the name, the menu and the theme button, each with a blue outline.
8. Make the window about phone width. Expected: the menu moves to its own row under the name, and nothing scrolls sideways.
9. In the terminal, press Ctrl+C to stop the site.

## Tasks 3 to 6: posts, lists, old content, search and feeds

These use the built site. Start it once for the whole section:

```powershell
cd C:\repos\Jack\jacks-space
npm run build
npm run preview
```

Expected: the build ends with "33 page(s) built" and "Indexed 14 pages"; the preview runs at http://localhost:4321/. Leave it running and use a second terminal for the commands below.

1. Unit tests:
   ```powershell
   npm test
   ```
   Expected: "# tests 24", "# pass 24", "# fail 0".
2. Old addresses:
   ```powershell
   node scratch\check-old-urls.mjs
   ```
   Expected: the last line is "47 old addresses checked, 0 problems." /0/, /arsenal/ and /test/ are listed as dropped on purpose.
3. Open http://localhost:4321/. Expected: 10 post cards on coloured lanes, "Oct" and "Mar" beside the cards, a "6-month break" line, and a sidebar with "14 posts 5 topics 10 tags". At the bottom, "Page 1 of 2" and "Older posts", which opens /page/2/ with the last 4 posts and "Newer posts".
4. Point at "Games" in the topic pills. Expected: only the two Games cards (Terraria, Don't Starve) and their lane stay bright.
5. Open http://localhost:4321/7/. Expected: a teal line down the left, "On this page" with 13 entries, 19 code blocks labelled with file names such as "fullpage-loading.pug" and with line numbers, the 6 longest folded behind "Show all N lines", and no licence notice (the old post had it turned off).
6. Open http://localhost:4321/11/. Expected: the finished-app screenshot as the cover. Click the first screenshot in the post: it opens large with the caption "flutter sdk"; Esc closes it.
7. Open http://localhost:4321/2/ and click Copy on the first code block. Expected: "Copied"; pasting gives the 4 `index_generator` lines. (Not run by Claude: copying needs a real click, and the browser pane wasn't drawing.)
8. Open /writing/ (5 topics), /archives/ (14 posts under 2023), /tags/ (10 tags) and /tags/hexo/ (5 posts). Expected: the game pages appear in none of them. They still open at /game_1/ and /game_2/, and at phone width only the Catch the Cat box scrolls sideways, not the page.
9. Press Ctrl+K and type `emulator`. Expected: "Flutter Get Started" with the matching words highlighted. Type `zzqqxx`: "No posts match “zzqqxx”. Try a shorter word."
10. Open http://localhost:4321/atom.xml and http://localhost:4321/sitemap.xml. Expected: the feed has 14 entries, newest "Flutter Get Started"; the sitemap has 30 addresses and no game pages.
11. On the home page, press Tab repeatedly (not run by Claude: the browser pane wasn't drawing). Expected: every card, topic pill, tag and button shows a blue outline when reached; a card's outline goes round the whole card.
12. Visitor counts show "–" locally: they only load on jacklee981229.github.io. Check them after go-live (Task 9).
13. Bad fields stop the build. In `src\content\posts\11\index.md` change `topic: flutter` to `topic: flutterx`, then run `npm run build`. Expected: it stops with "posts → 11 data does not match collection schema" and "Expected 'hexo' | 'git' | 'chatgpt' | 'games' | 'flutter', received 'flutterx'". Change it back to `topic: flutter`.

## Task 8: writing workflow

1. Start a test draft:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run new "Test Post" git
   ```
   Expected: "Draft created: src\content\posts\test-post\index.md". Without a topic, or with a wrong one, it prints the list of topics instead.
2. Preview it (stop the preview from the section above first, since both use port 4321):
   ```powershell
   npm run dev
   ```
   Open http://localhost:4321/test-post/. Expected: the draft shows, and it is the first card on the home page. Press Ctrl+C to stop.
3. Build and check the draft is left out:
   ```powershell
   npm run build
   Test-Path dist\test-post
   ```
   Expected: `False`.
4. Delete the test draft:
   ```powershell
   Remove-Item -Recurse src\content\posts\test-post
   ```
5. Open Claude Code in `C:\repos\Jack\jacks-space` and type `/new-post`. Expected: Claude starts the writing workflow by asking what the post is about (not run by Claude, since this session is open in C:\repos\Jack).

## Task 9: go live

1. Open https://jacklee981229.github.io/. Expected: the new site, with the big "Jack's Space" title and the post timeline.
2. Open two old links: https://jacklee981229.github.io/11/ and https://jacklee981229.github.io/tags/ChatGPT/. Expected: the Flutter post, then the "chatgpt" tag page (the second passes through "Page not found" for a moment, which sends it on).
3. Check the latest deploys:
   ```powershell
   & "$env:LOCALAPPDATA\Programs\gh\bin\gh.exe" run list --repo jacklee981229/jacklee981229.github.io --limit 3
   ```
   Expected: the newest "Deploy to GitHub Pages" run shows `completed` and `success`.
4. On the live home page, wait a few seconds. Expected: the sidebar shows numbers for Visitors and Page views instead of "–", continuing from the old site's counts (719 and 1,036 on 26 Sep, or more).
5. Press Ctrl+K and search for `terraria`. Expected: the Terraria post.
