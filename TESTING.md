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
9. Open "Flutter Get Started". Expected: a cover banner with the app screenshot in front of a faint "Flutter", and "Check these too!" at the bottom shows other posts as cards. Click the first screenshot in the post: it opens large with the caption "flutter sdk", and Esc closes it.
10. Make the browser window narrow (about phone width). Expected: nothing scrolls sideways, cards show the cover on top, the month labels are hidden (each card shows its date), the year sits beside the lanes, and the lanes stay unbroken.

## Task 2: skeleton

1. Install and build:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm install
   npm run build
   ```
   Expected: the build ends with "32 page(s) built", "Complete!" and Pagefind's "Indexed 14 pages" (it was 6 pages before Tasks 3 to 6 added the posts). npm also prints Node-version warnings (EBADENGINE) and "3 vulnerabilities"; both are expected on Node 20 (see D1 and D8 in [site-v2.md](docs/plan/done/site-v2.md)).
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
4. Click Writing, Archives and About. Expected: each page opens with its title, and the menu underlines the current page.
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

Expected: the build ends with "32 page(s) built" and "Indexed 14 pages"; the preview runs at http://localhost:4321/. Leave it running and use a second terminal for the commands below.

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
8. Open /writing/ (5 topics), /archives/ (14 posts under 2023) and /tags/hexo/ (5 posts). Expected: the game pages appear in none of them. They open at /lab/game/2048/ and /lab/game/catch-the-cat/ (the old /game_1/ and /game_2/ forward there), and at phone width both games fit the screen without scrolling sideways.
9. Press Ctrl+K and type `emulator`. Expected: "Flutter Get Started" with the matching words highlighted. Type `zzqqxx`: "No posts match “zzqqxx”. Try a shorter word."
10. Open http://localhost:4321/atom.xml and http://localhost:4321/sitemap.xml. Expected: the feed has 14 entries, newest "Flutter Get Started"; the sitemap has 29 addresses and no game pages.
11. On the home page, press Tab repeatedly (not run by Claude: the browser pane wasn't drawing). Expected: every card, topic pill, tag and button shows a blue outline when reached; a card's outline goes round the whole card.
12. Visitor counts say "live site only" locally: they only load on jacklee981229.github.io. Check them after go-live (Task 9).
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

## UI tweaks 1: Tags page, theme fade, tag hover

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "32 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Look at the menu. Expected: Home, Writing, Archives and About. There's no Tags item.
3. Open http://localhost:4321/tags/. Expected: the home page.
4. Open http://localhost:4321/tags/hexo/. Expected: the title "hexo", "5 posts tagged “hexo”." and the 5 posts, with no "All tags" link above the title.
5. Click the theme button (the moon or sun, top right). Expected: the whole page fades to the other theme (0.3 seconds since UI tweaks 2). Click it again: it fades back. Reload: the theme you picked last stays.
6. Point at "hexo" in the sidebar's Tags card. Expected: it grows a little and turns solid (dark with white text in light mode, light with dark text in dark mode), with no underline, and the other tags stay as they are. Move the mouse away: it shrinks back.
7. Scroll to the bottom, click an empty spot in the footer (to the right of the licence line), then press Shift+Tab. Expected: "script", the last tag in the sidebar, gets the same solid look, plus a blue outline.
8. Make the window about phone width. Expected: nothing scrolls sideways.

## UI tweaks 2: faster fade, typing title, menu and card hover, welcome screen preview

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "32 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/. Expected: the big "Jack's Space" types itself in about 1.3 seconds, letters at uneven speeds with a short pause before "Space". A cursor follows the newest letter, blinks twice after the "e", then disappears. Nothing else on the page moves while it types. Reload to see it again. (Since the welcome screen, the first open in a tab plays that first; see the next section.)
3. Click the theme button. Expected: the page fades to the other theme in 0.3 seconds.
4. Point at "Writing" in the menu, then at "Home". Expected: each word grows a little while pointed at; the line under "Home" stays where it is.
5. Point at a post card on the home page. Expected: it grows slightly towards the right and its border takes the topic colour; the coloured lane line still touches its left edge.
6. Open http://localhost:4321/2/, scroll to "Check these too!" and point at a card. Expected: that card grows slightly; the others stay as they are.
7. Make the window about phone width. Expected: nothing scrolls sideways.
8. Open the welcome screen preview (needs internet for the font):
   ```powershell
   start C:\repos\Jack\jacks-space\scratch\mockups\intro\index.html
   ```
   Expected: style A plays over a picture of the home page and clears after 3 seconds. The panel at the bottom left plays A. Reveal, B. Curtain and C. Spotlight (or press 1, 2, 3; R replays). Clicking or pressing a key during an intro skips it. "Light backdrop" switches the picture and the colours to the light theme.

## Welcome screen (style B, Curtain)

It plays once per browser tab, and only when the tab's visit starts on the home page. To see it again, open a new tab.

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "32 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open a new tab (Ctrl+T) and go to http://localhost:4321/. Expected: "Welcome to" and "Jack's Space" slide up into view and a thin bar fills; at about 2 seconds the screen lifts away like a curtain, and the big title types itself as it's uncovered. The screen is gone by 3 seconds.
3. Reload the page. Expected: no welcome screen; the title types at once.
4. Open a new tab, go to http://localhost:4321/ and click (or press any key, or scroll) while the welcome screen shows. Expected: it fades out at once and the title starts typing straight away.
5. Open a new tab, go to http://localhost:4321/2/, then click Home in the menu. Expected: no welcome screen, because the visit started on a post.
6. Make the window about phone width, open a new tab and go to http://localhost:4321/. Expected: "Jack's Space" fits across the screen, and nothing scrolls sideways.

## Site info fixes

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "32 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/ and look at the Site info card. Expected: "Running for" shows the days with a normal comma (for example "1,312 days", no gaps around the comma), and Visitors and Page views say "live site only" in grey.
3. Open https://jacklee981229.github.io/ and wait a few seconds (after this change is pushed). Expected: Visitors and Page views show numbers, never "live site only".

## About and profile links

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "32 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/about/. Expected: under "About Me", only "Senior Software Engineer at Squarebox Technology", then four tiles in a row: Resume, LinkedIn, GitHub, Email. "About this Site" is unchanged.
3. Point at a tile. Expected: it turns solid and grows a little, like the sidebar tags.
4. Click Resume. Expected: your current Resume Google Doc opens (Senior Software Engineer at Squarebox Technology), not the old 2023 PDF.
5. Open http://localhost:4321/. Expected: the profile card shows your name beside the avatar, the same job title under it, and the same four links as icons in one row. Pointing at an icon turns it solid, grows it a little and shows its name.
6. Make the window about phone width. Expected: the About tiles go 2 by 2, and nothing scrolls sideways.
7. Click Resume, LinkedIn or GitHub (on About or in the home card). Expected: it opens in a new tab and the blog stays open. Email opens your mail app.
8. Open http://localhost:4321/2/ and click "this" in the second point under "Concept" (a link to Hexo's docs), then the licence link in the footer. Expected: each opens in a new tab. Links within the blog (menu, tags, posts) still open in the same tab.

## Card shadow (light theme)

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "32 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Switch to the light theme and open http://localhost:4321/. Expected: the post cards and the three sidebar cards sit on a soft shadow that lifts them off the page. Open http://localhost:4321/2/ and scroll to "Check these too!": those cards have it too.
3. Switch to the dark theme. Expected: no shadows, as before.

## Lab L1: the Lab home, Count Words and Random

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "35 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Look at the menu, then open http://localhost:4321/lab/. Expected: Lab sits between Archives and About. The page shows "Jack's Lab" with a flask icon, then Tools in two groups (Text and Images): every card has an icon and an example of what it does, the ready tools open and the rest say "Soon". Mini Games! shows Jack's 2048, Jack's Catch the Cat, Jack's Snake and Jack's Blocks with their covers, and Random is a dashed card.
3. Open Count Words and type or paste some text. Expected: words, characters, characters without spaces, lines, paragraphs and reading time update as you type. "well-known" counts as one word, and 我喜欢写代码 counts as 4 words. Clear empties the box and sets every count back to 0.
4. Go back to the Lab and open both games. Expected: they play as before.
5. Open http://localhost:4321/random/. Expected: "Random", a line saying it's coming, and a "Back to the Lab" button.
6. In a second terminal, in `C:\repos\Jack\jacks-space`:
   ```powershell
   npm run new "Lab" hexo
   ```
   Expected: `"/lab/" is already one of the site's own pages. Pick a different title.` and no new draft.
7. Make the window about phone width. Expected: the Lab cards go one per row; on Count Words the counts sit above the text box; nothing scrolls sideways.
8. On your phone, after the Lab is pushed (not tested here, since this PC has no real phone): open https://jacklee981229.github.io/lab/count-words/, paste text from another app, and check the counts update.

## 2048, our own version

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "35 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/game/2048/ (or the Lab's "Jack's 2048" card). Expected: Score and Best, a New game button, and a green 4 by 4 board with two tiles. No "refused to connect".
3. Press the arrow keys (or W, A, S and D) quickly, several times in a row. Expected: tiles slide smoothly, equal tiles join with a small pop and the score goes up with a floating "+", a new tile fades in after each move, and fast presses never lag behind.
4. Reload the page. Expected: the same game comes back, and Best keeps your highest score.
5. Press Ctrl+K, type "a" and press the left arrow in the search box. Expected: the tiles don't move. Press Esc.
6. On your phone (or the browser's phone view): swipe on the board. Expected: the tiles move with each swipe, and the page doesn't scroll while your finger is on the board.
7. Keep playing to 2048 if you like. Expected: "You made 2048!" with Keep going and New game. If the board fills up with no moves left: "No more moves." with Try again.

## Catch the Cat, our own version

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "35 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/game/catch-the-cat/ (or the Lab's "Jack's Catch the Cat" card). Expected: Moves and Best, Undo and New game buttons, and a green board of 11 rows of dots with the cat in the middle and a few dots already blocked.
3. Click a free dot. Expected: it turns solid green with a small pop, and the cat glides one dot towards the nearest edge. Moves goes up by one.
4. Keep clicking dots far from the cat. Expected: when the cat reaches the edge it runs off the board, and "The cat got away." offers Undo and Try again. Undo takes back your last move.
5. Trap the cat (block all six dots around it). Expected: "You trapped the cat in N moves!", and Best shows your fewest moves, also after a reload.
6. Press Tab until the board has a blue outline, then use the arrow keys and Enter. Expected: a blue ring moves between dots, and Enter blocks the dot inside it.
7. On your phone (or the browser's phone view): tap dots. Expected: each tap blocks a dot, and nothing scrolls sideways.

## Catch the Cat, the cat's animation

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "39 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/game/catch-the-cat/ and watch the cat for a few seconds. Expected: it sits side-on on its dot, its tail sways, and it blinks every few seconds.
3. Click a free dot. Expected: the cat turns to face where it's going, hops one dot with its legs moving (leaning up or down when it changes row), and lands sitting. No black box appears around the board.
4. Click several dots quickly, one after another. Expected: every hop starts cleanly and the cat always ends sitting, never stuck mid-stride.
5. Keep clicking dots far from the cat until it reaches the edge. Expected: it gallops off the board the same way, fading out, then "The cat got away." Undo brings it back, sitting.
6. Click New game and trap the cat. Expected: it looks one way, then the other, then hangs its head with its ears down, and then "You trapped the cat in N moves!".

## Lab L2: Change Case, Encode URL, Clean Text, Convert Timestamp

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "39 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/. Expected: Count Words, Change Case, Clean Text, Encode URL and Convert Timestamp open; Compare Text and the four image tools still say "Soon".
3. Open Change Case and type `hello world. HOW are you?`. Expected: UPPERCASE is chosen and Result shows `HELLO WORLD. HOW ARE YOU?`. Click Sentence case: `Hello world. How are you?`. Click snake_case: `hello_world_how_are_you`.
4. Click Copy and paste into Notepad. Expected: the button says "Copied" for a moment, and the pasted text matches Result. Click Clear: both boxes are empty.
5. Open Encode URL and type `a b&c 你好`. Expected: Result `a%20b%26c%20%E4%BD%A0%E5%A5%BD`. Click Swap: your text becomes that code, Decode is chosen, and Result is `a b&c 你好` again.
6. Still on Decode, click Clear and type `100% sure%20thing`. Expected: Result `100% sure thing`, and under it "1 % code couldn’t be read, so it’s left as it was."
7. Open Clean Text and paste a messy text: extra spaces between words and at line ends, and several empty lines between paragraphs. Expected: Result has single spaces, nothing at line ends, and one empty line between paragraphs. Click "Remove all": no empty lines are left. Untick "Trim lines": the spaces at line starts come back.
8. Open Convert Timestamp and type `1727600000`. Expected: "Read as seconds.", Your time (Asia/Kuala_Lumpur, GMT+8) `29 Sep 2024, 16:53:20` and UTC `29 Sep 2024, 08:53:20`. Type `123` at the end: "Read as milliseconds." and `.123` after both times. Type a letter: "Type a Unix time in digits, like 1727600000."
9. Under Date to Unix time, pick 29 Sep 2024, 4:53:20 PM. Expected: Seconds `1727600000` and Milliseconds `1727600000000`. Click UTC: Seconds `1727628800`. The Copy beside Seconds copies just that number.
10. On your phone (or the browser's phone view), try any of the four. Expected: one column, the choices wrap onto more lines, and nothing scrolls sideways.

## 2048: clock and leaderboard

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "39 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/game/2048/ and click New game. Expected: Time shows `00:00.00` and waits. Press an arrow key: the time starts running, in hundredths of a second.
3. Wait a few seconds, then reload the page. Expected: the same game comes back, and its time carries on from where it was, without the moment the page was closed.
4. Press the arrow keys quickly in any order until no moves are left (a minute or two). Expected: the time stops, and "No more moves." asks for "Your name for the leaderboard". Type a name with W, A, S or D in it and press Enter: the name arrives whole, the message says "Saved for <name>: number 1 on the leaderboard.", and the Leaderboard beside the game (under it on a phone) shows your name, score and time, picked out in green.
5. Click Try again and play another game to the end. Expected: no name is asked. A lower score says "<name>'s best is still …" and your row stays; a higher score replaces it.
6. Under the leaderboard, click Change name, type another name and press Enter. Expected: "Playing as <new name>." The next finished game gets its own row.
7. On your phone (or the browser's phone view). Expected: Score, Best and Time on one line with New game under them, and the leaderboard fits without scrolling sideways.

## 2048: keys anywhere, the game in view, the leaderboard card

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "39 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/game/2048/ in a normal desktop window. Expected: no big "Games" banner; the game sits right under the title and starts on screen (on a short screen its lower part is below the edge until you play). (The Lab's "Jack's 2048" card still has its cover.)
3. Click the page's title, then press an arrow key. Expected: the tiles move. Click the theme button (the sun or moon at the top), then an arrow key: the tiles still move.
4. Press Ctrl+K, type a letter and press the arrow keys. Expected: they stay in the search box and the tiles don't move. Press Esc twice to close it.
5. Make the window short, scroll down until the board is out of sight, then press the up arrow. Expected: the page scrolls like any page, and the tiles don't move.
6. Make the window short enough to cut off the bottom of the board, reload, and press an arrow key. Expected: the page glides just enough to show the whole board.
7. Look beside the game (under it on a phone). Expected: the leaderboard is a card with a border and rounded corners, times show two decimals (like `00:12.70`), and your latest row is green with rounded ends.
8. If you reach 2048: "You made 2048!" saves the score straight away, so New game from there keeps it on the leaderboard. (I checked this with a set-up board; reaching 2048 by hand takes a while.)

## Game pages like tools, "Check these too!", and small fixes

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "39 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/game/2048/. Expected: "‹ Lab", "Jack's 2048" and "Slide the tiles and reach 2048.", then the game. No date, tags, Copy link or banner. On a desktop window the leaderboard card sits to the right of the board, level with its top.
3. Scroll to the bottom. Expected: a full-width band a shade apart, with a line along its top: "Check these too!", "Other tools and games in the Lab.", then Jack's Catch the Cat first and Lab tools, as cards. No Recent posts and no author card.
4. Open http://localhost:4321/lab/game/catch-the-cat/. Expected: the same layout, with Jack's 2048 first under "Check these too!".
5. Open http://localhost:4321/lab/count-words/. Expected: the description fits on one line; the text box and the counts card start and end level; "Check these too!" shows the four other tools.
6. Open http://localhost:4321/lab/change-case/. Expected: "Change to" with two lined-up rows, "Text" (UPPERCASE and the rest) and "Code" (camelCase and the rest).
7. Open any post, for example http://localhost:4321/11/, and scroll to the bottom. Expected: the same full-width band, with "Check these too!", "More posts from Jack's Space.", up to four post cards (the same topic first) and the author card. No "Related posts" or "Recent posts".
8. On your phone (or the browser's phone view), open /lab/game/2048/ and /lab/count-words/. Expected: the leaderboard under the game; the counts above the text box; nothing scrolls sideways.

## The Lab in dark green

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "41 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Switch to the dark theme and open http://localhost:4321/lab/. Expected: the whole page, header included, in deep green instead of deep blue.
3. Open a tool (http://localhost:4321/lab/count-words/), a game (http://localhost:4321/lab/game/2048/) and http://localhost:4321/random/. Expected: the same deep green.
4. Open the home page or any post. Expected: still deep blue.
5. Switch to the light theme. Expected: the Lab looks like the rest of the site.

## Snake

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "41 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/game/snake/ (or the Lab's "Jack's Snake" card). Expected: a short green snake with eyes on a faint grid of cells, a dot of food, "Press an arrow key or swipe to start", a "No walls" switch (off) beside New game, and the leaderboard to the right, with a "With walls" tag under its title.
3. Press an arrow key. Expected: the snake moves that way a whole cell at a time, jumping from cell to cell with no gliding, and the clock runs. Pressing the way straight back does nothing.
4. Steer onto the food. Expected: Score goes up, the snake grows by one, new food appears, and the snake speeds up a little (3 ms a step per food, reaching top speed at 27).
5. Press Space. Expected: "Paused." and everything stops; Space again carries on. Switching to another window pauses it too.
6. Run into a wall or yourself. Expected: the head shakes, then "Game over." asks for your name (or saves under the name you gave before), and your row shows in the leaderboard.
7. On your phone (or the browser's phone view), swipe on the board. Expected: it starts and turns with each swipe, the page doesn't scroll under your finger, and the leaderboard sits under the game.
8. Start a game, then try the "No walls" switch, also while paused. Expected: it's greyed out and doesn't change.
9. Click New game, then tick "No walls". Expected: a fresh game; the tag under the leaderboard's title says "No walls", its board is separate (empty at first) and Best starts at 0. Steer into a wall: the snake comes back in on the opposite side. Running into yourself still ends the game.
10. Reload the page. Expected: the switch is still ticked. Untick it: back to "With walls", with your earlier scores and Best.

## Blocks

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "41 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/game/blocks/ (or the Lab's "Jack's Blocks" card). Expected: the well with "Ready?" and Start, Next, Score, Best, Lines, Level and Time beside it, the leaderboard to the right, and "Ready?" with Start in view without scrolling. Click Start: the page glides so the whole well fits the window.
3. Click Start. Expected: pieces fall. Left and right move (holding keeps moving), up turns (Z turns back), down drops faster, Space drops at once, and an outline shows where the piece will land.
4. Fill a whole row. Expected: it flashes and goes, the rows above come down, Lines goes up, and the score jumps (more for more rows at once: 100, 300, 500 or 800 times the level).
5. Press P. Expected: "Paused."; P again carries on. Switching to another window pauses it too.
5a. Press C (or R, or Shift). Expected: the falling piece goes into the Hold box and the next piece comes in; the Hold box fades, and C does nothing more until that piece sets. After it sets, C swaps the falling piece with the held one, which comes in at the top.
6. Let the blocks reach the top. Expected: "Game over." with the name form (or saved under your name), and your row in the leaderboard.
7. On your phone (or the browser's phone view). Expected: two rows of buttons under the well, Hold, Turn and Drop, then Left, Down and Right (holding Left, Right or Down repeats), and nothing runs off the screen. Tapping a button doesn't flash a blue box over it.

## Games load their newest version (no hard refresh)

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "41 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/game/2048/, press Ctrl+U to see the page's source and search for `Game2048`. Expected: the script's name has a fingerprint at the end, like `Game2048.astro_astro_type_script_index_0_lang.CW-dTkQx.js`, and no address starts with `/games/`.
3. Search the source for `2048.` and `leaderboard.`. Expected: both stylesheets are in `/_astro/` with a fingerprint too. Open any post (for example http://localhost:4321/11/) and search its source: no game stylesheets or scripts at all.
4. After the next deploy that changes a game, open that game's page on the live site with a normal reload (F5). Expected: the new version straight away, no Ctrl+Shift+R needed.

## Games under /lab/game/, "In memories." and no tap flash

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "41 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. In a second terminal, in `C:\repos\Jack\jacks-space`:
   ```powershell
   node scratch/check-old-urls.mjs
   ```
   Expected: `/game_1/` and `/game_2/` say "ok (redirects)", and the last line is "47 old addresses checked, 0 problems."
3. Open http://localhost:4321/game_1/. Expected: it lands on http://localhost:4321/lab/game/2048/ with "Jack's 2048". http://localhost:4321/game_2/ lands on http://localhost:4321/lab/game/catch-the-cat/.
4. Open http://localhost:4321/lab/ and open each Mini Games card. Expected: the addresses /lab/game/2048/, /lab/game/catch-the-cat/, /lab/game/snake/ and /lab/game/blocks/, each game with its best score and leaderboard as you left them.
5. Open http://localhost:4321/lab/game/blocks/. Expected: "In memories." under the game.
6. Open http://localhost:4321/11/. Expected: the post, at the same address as before.
7. On your phone (or the browser's phone view), tap a dot in Catch the Cat, then the buttons under Blocks. Expected: the dot turns dark and the piece moves, with no blue patch flashing over what you tapped.

## Game texts, leaderboards lined up, Catch the Cat's keys, back to Mini Games

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "41 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open each game from http://localhost:4321/lab/. Expected, under each board:
   - 2048: "Use the arrow keys (or W, A, S and D), or swipe on the board." and below it "The classic 2048. The original game is by Gabriele Cirulli (source)."
   - Snake: "Eat and grow!" under the title; "Turn with the arrow keys (or W, A, S and D). Space pauses." under the board; "The classic snake game." below.
   - Catch the Cat: "Click a dot to block it. Trap the cat before it reaches the edge."
   - Blocks: "Use the arrow keys (or W, A, S and D): left and right move, up turns, down drops faster. Z turns back, Space drops, C or R holds. P pauses."
3. In a wide window, open 2048, Snake and Blocks in turn. Expected: the leaderboard starts at the same place to the right of the game on all three, and "Kept in this browser." sits beside "Leaderboard" (Snake's wall tag goes under that line).
4. In Catch the Cat, click a dot, then press the down arrow. Expected: the dot is blocked and the page scrolls; the game doesn't take the arrow keys. Press Tab until the board has a blue outline: now the arrow keys move a ring and Enter blocks the dot inside it.
5. In Blocks, start a game and press R. Expected: it holds the piece, like C.
6. On any game, click "‹ Lab". Expected: the Lab home opens at Mini Games, not at the top.

## Games fill the screen

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "41 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. On a laptop (or a browser window about 1440 by 760), open http://localhost:4321/lab/game/2048/. Expected: the title, then the scores and the top of a big board. Press an arrow key: the page glides so the scores and the whole board fill the window.
3. Do the same on Snake (an arrow key), Blocks (Start) and Catch the Cat (click a dot). Expected: each glides the same way, and the whole game fits the window. On a MacBook Air-sized window, 2048 and Snake are about 650 pixels wide and the Blocks well about 720 tall.
4. Make the window shorter or taller and reload. Expected: the games grow and shrink with the window's height, up to a comfortable maximum, and the leaderboard stays in the same place on 2048, Snake and Blocks.
5. On your phone (or the browser's phone view). Expected: the games fill the width as before, and nothing scrolls sideways.

## Most Popular (GoatCounter)

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "41 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/. If the build prints "Most Popular: GoatCounter gave no counts", it couldn't reach the counter; the site still builds, without the section.
2. Open http://localhost:4321/lab/. Expected: no "Most Popular" yet. It appears once four different Lab items (tools, games or effects) have been visited on the live site.
3. After the next publish, open https://jacklee981229.github.io/ and a few Lab pages, then open https://jacklee981229.goatcounter.com. Expected: your visits listed within a minute, each page under its own address.
4. In a terminal:
   ```powershell
   curl.exe -s https://jacklee981229.goatcounter.com/counter/TOTAL.json
   ```
   Expected: `{"count_unique":"N", "count":"N"}`, the site's total views. These public numbers can lag up to four hours behind the dashboard.
5. Once four Lab items have visits, wait for the next publish or the daily refresh (04:17), then open https://jacklee981229.github.io/lab/. Expected: "Most Popular" at the top, under the Tools / Mini Games / Effects / Random buttons, with the four most visited items as cards, most visited first, and no numbers.
6. To keep your own visits out of the counts on a device, open https://jacklee981229.github.io/#toggle-goatcounter there once. Expected: a message that GoatCounter is now disabled in that browser (the same address switches it back on).

## Lab P1: Markdown Preview

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "51 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/. Expected: a new "Preview" group between Text and Images, with Markdown Preview and JSON Preview.
3. Open Markdown Preview. Expected: a sample already in the Markdown box, and beside it the same thing as a page: a big heading, a bulleted and a numbered list, two tick boxes (one ticked), a small table, a quote and a code box. On a phone the page sits under the box.
4. Click in the Markdown box. Expected: on a laptop the page glides so both boxes, Clear and Copy HTML all fit the window.
5. Change the text, for example add a line `## Hello`. Expected: the page follows as you type.
6. Type `<b>hi</b>` and `<script>alert(1)</script>` on lines of their own. Expected: both show as plain text in the page; nothing turns bold and no message pops up.
7. Click a link in the page. Expected: it opens in a new tab, and your text is still there.
8. Click Copy HTML and paste into Notepad. Expected: "Copied" on the button, and the page's HTML (starting with a heading tag) in Notepad.
9. Click Clear. Expected: an empty box, "Your formatted page shows here." in the page, and the cursor back in the box.
10. Press Tab from the box. Expected: Clear, then the page (it scrolls with the arrow keys), then Copy HTML, each with a blue outline.

## Lab P2: JSON Preview

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "51 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/json-preview/. Expected: a sample on one long line in the JSON box, and beside it the same thing tidy: one item a line, names in bold, text green, numbers blue, true/false purple, null grey, with a small triangle beside every { and [. At the top right of Preview, a "Tidy | Compact" switch with Tidy filled in. On a phone the preview sits under the box.
3. Click the triangle beside "tools". Expected: the list folds to one line, `"tools": [ 3 items ],`; click again and it unfolds.
4. Replace the text with `{"b":1,"2":12345678901234567890,"1":0.1000}`. Expected: the names stay in that order (b, 2, 1) and the numbers show exactly as typed, the long one not rounded.
5. Click Compact on the switch. Expected: Compact is filled in, and the preview shows the JSON with no spaces or line breaks, in the same colours (a long one wraps inside the box, after a comma). Click Tidy: the tree is back.
6. Click Copy and paste into Notepad, once with the switch on Tidy and once on Compact. Expected: the JSON with one item a line, then all of it on one line: Copy gives what's showing.
7. Type `{"a": 1,}`. Expected: "Not valid JSON yet", "Take out this comma: nothing comes after it." and "Line 1, column 8", whichever side the switch is on. Copy now says "Nothing to copy".
8. Type `{'name': 'Jack'}`. Expected: a message about double quotes, not single quotes.
9. Paste a big JSON file (1 MB or so). Expected: it shows within a second, the page stays usable, and a long list shows its first 100 items with a "Show 100 more" button. On Compact, the first part shows with a "Show more" button under it, and Copy still gives the whole file.
10. Click Clear. Expected: an empty box and "Your JSON shows here."

## Effects: eight of them, and Random back to "coming soon"

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "51 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/ and click Effects at the top. Expected: an Effects section with eight cards, each with a small picture: Dot Grid, Mouse Trail, Gravity Trail, Particles, Gooey Cursor, Distortion, Ripples, Compass. Under it, Random is a dashed box saying it's coming. (On a phone the four buttons at the top take two rows.)
3. Open http://localhost:4321/random/. Expected: "Random", a line saying it's coming, and a "Back to the Lab" button. No cards.
4. Open Dot Grid. Expected: the address is /lab/effect/dot-grid/. A small top (‹ Lab, the name and one line of what to do), then a field of dots right across the window, with the top of "Check these too!" in sight under it. Leave the mouse alone: a ring of coloured dots drifts around by itself. Move the mouse: the dots lean away from it. Click: a ripple spreads.
5. Click "‹ Lab". Expected: the Lab home, at the Effects section.
6. Open each of the other seven and move the mouse. Expected: Mouse Trail, five coloured ribbons weaving after the pointer; Gravity Trail, little balls falling and bouncing, a burst on a click; Particles, drifting points joined by lines, pushed away on a click; Gooey Cursor, soft blobs that stretch and melt together; Distortion, a net of lines that swells and twists, a wave on a click; Ripples, rings spreading wherever the pointer goes, a big splash on a click; Compass, a field of needles all pointing at the pointer, the near ones bigger and coloured, a spreading ring of spinning on a click.
7. Click Pause. Expected: everything stops and the button says Play; Play starts it again.
8. Click the sun or moon at the top right. Expected: the effect redraws in the other theme's colours.
9. On your phone (or the browser's phone view), drag a finger on the stage. Expected: the effect follows the finger and the page doesn't scroll; drag on the title above the stage, or on what's below it, to scroll the page.
10. With "reduce motion" switched on in Windows (Settings, Accessibility, Visual effects, Animation effects off), reload. Expected: a still picture and a Play button; nothing moves until you press Play.

## 2048: Undo, and the clock waits at 2048

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "51 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/game/2048/ and click New game. Expected: an Undo button left of New game, greyed out, and the line under the board ends with "Z undoes one move."
3. Press an arrow key, then click Undo. Expected: the tiles slide back to where they were and the score goes back; Undo greys out again. Click it again, or press Z: nothing changes.
4. Press an arrow key, then Z. Expected: that move is taken back too (move, undo, move, undo works).
5. Make two moves, then click Undo twice. Expected: only the last move comes back.
6. Make a move and reload the page. Expected: Undo is still there for that one move.
7. Play until no moves are left, then click Undo. Expected: "No more moves." goes, the last move is taken back, and the time runs again.
8. If you reach 2048: the time stops while "You made 2048!" is up, at the same time the leaderboard shows. Keep going starts it again. Undo there takes the 2048 back and the game carries on. (I checked this with a set-up board.)
9. Make the window about 1280 wide and 650 tall. Expected: Score, Best, Time, Undo and New game share one line, and the whole board is on screen while you play. On a phone, the two buttons sit under the scores.

## Collections and the Travel Map

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "63 page(s) built" and "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Look at the menu. Expected: Home, Writing, Lab, Collection, Travel, About (Archives was removed on 4 Oct). On a phone the menu slides sideways, and opens with the current page's word in view.
3. Open http://localhost:4321/collections/. Expected: "Jack's Collection" as big as "Jack's Lab" on the Lab page, "Things I like, kept where I can look at them." under it, and under that two tabs, "Movies 8" (filled in) and "Games 7". Then a board with the eight movies: five in a row, the other three in the middle under them, 48 px apart. Each has its poster, its name in the middle under it, and its stars under that. One thin line runs between the two rows, under the first row's stars: none between a poster and its own name.
4. Rest the mouse on an item. Expected: it grows a little at once. After about two seconds a small note opens on its right with its name, its stars and "No comment yet." (for the last item of a row, on its left). Move to the item beside it: that one's note comes at once. Move the mouse away: the note closes. The note's stars are the same as the ones under the name: on a four-star item, four filled and the fifth a faint shadow.
5. Click an item. Expected: its note opens without the wait. Esc, or a click somewhere else, closes it.
6. Click "Games 7". Expected: the tab fills in at once, and the board turns like two cards on a round table, clockwise seen from above: Movies swings away to the left and round to the back, the back of the Games card shows on the right, and Games comes round to the front. It takes about a second. Then the seven games: five in a row, two in the middle under them.
7. Click "Movies 8". Expected: the table turns back the other way.
8. Open http://localhost:4321/collections/#games. Expected: the page opens on Games, without a turn.
9. A comment shows in the note. With `npm run dev` running, add a line `    comment: Testing the note.` under an item's `image:` line in `src\content\collections\games\index.yaml`, reload http://localhost:4321/collections/#games and rest the mouse on that item. Expected: the note says "Testing the note." in place of "No comment yet." Take the line out again.
10. Open http://localhost:4321/travel/. Expected: "Jack's Travel Map" as big as "Jack's Lab", "5 places so far." under it, and under that a Globe | Flat switch with Globe filled in. The page opens on a globe facing Malaysia, turning slowly by itself, with four countries coloured: Malaysia red, Thailand orange, Taiwan amber, China yellow. No dot. Under it the five names with their colours, from home outward: Malaysia, Singapore, Thailand, Taiwan, China. (Singapore is too small to draw on a map of the world, so it's only named.) The whole globe and the names fit in the window, and the pointer over the globe is the ordinary arrow.
11. Watch the coloured countries for ten seconds. Expected: they breathe gently: a faint glow around them swells and fades, about five seconds for a breath in and out.
12. Move the mouse onto a coloured country. Expected: the globe holds still, and the country rises from its surface like a picture made of light: a little bigger, thin lines across it, a brighter edge, a faint mark left where it was, and its name over it in capitals ("CHINA"). Its glow breathes harder while the others stay gentle. Move away: it settles, and the globe turns on.
13. Drag the globe. Expected: it turns with the mouse, any way you drag, and stops turning by itself. Flick it: it keeps turning for a moment, then rests. It never rolls upside down.
14. Press Tab until the globe has a ring around it, then press the arrow keys. Expected: left and right look west and east, up and down look north and south, and the page doesn't scroll.
15. Click Flat. Expected: the globe opens out into the flat map, in a little over a second: it turns towards the middle of the map as it widens, the far side of the earth comes into view, the ball's filling fades, and it settles as the world laid flat in thin lines, the same four countries in the same colours, breathing gently. Nothing jumps or blinks at the end, and the names under it don't move.
16. Move the mouse onto a coloured country on the flat map. Expected: it rises the same way, a little bigger and higher, with its name over it. With the mouse at the very edge of a country, it doesn't flicker. Move away: it settles back.
17. Click the sun or moon at the top right. Expected: the map and the globe redraw in the other theme's colours (on the light theme, dark red through burnt orange to mustard, with a fainter glow).
18. Click Globe. Expected: the flat map closes up into the globe again, facing where you left it, and it carries on as before (it turns by itself if you never touched it). Click Flat and, while it's still opening, Globe: it finishes opening, then closes up again.
19. A wrong star number stops the build. In `src\content\collections\movies\index.yaml`, change the first `stars: 5` to `stars: 4.2` and run `npm run build`. Expected: it stops with the item's name, then `has 4.2 stars. Stars go from 1 to 5, in halves: 4 or 4.5, not 4.2.` Put the 5 back.
20. A missing picture stops the build. In the same file, change the first `image:` line to `image: missing.jpg` and run `npm run build`. Expected: it stops with `Collections:`, the item's name, then `in movies asks for the picture "missing.jpg", but there is no file of that name in src/content/collections/movies/`. Put it back.
21. A misspelt place stops the build. In `src\content\travel\visited.yaml`, change `Malaysia` to `Malaysa` and run `npm run build`. Expected: it stops with `Travel Map: "Malaysa" isn't a place the map knows. Did you mean Malaysia? Fix it in src/content/travel/visited.yaml.` Put it back.
22. Add an item of your own, following `src\content\collections\README.md`, with `npm run dev` running. Expected: it shows at http://localhost:4321/collections/ after a reload.

## Five effects livened up: Orbits, Garden, Flock, Spotlight, Sand

1. Start the local site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run dev
   ```
   Expected: the site runs at http://localhost:4321/.
2. Open http://localhost:4321/lab/ and find Flock under Effects. Expected: its card shows a shoal of small fish of different sizes, not arrows.
3. Open http://localhost:4321/lab/effect/orbits/ and rest the mouse in the middle. Expected: the planets cross the sun at every angle, on round paths and long thin ones, some going clockwise and some anticlockwise; a planet looks bigger on the near side of its path and smaller on the far side. Then move the mouse quickly from the right side to the left. Expected: only the sun follows the mouse; the planets stay where they were and chase after it, the ones left furthest behind (on the right) fastest, each at its own pace, then swing round the sun again. Click: they fling out and fall back as before.
4. Open http://localhost:4321/lab/effect/garden/. Expected: short plants with thin trunks and few forks beside tall ones; some branches fork in two or three, some carry straight on, some stop early in a flower. Rest the mouse at the far left, then at the far right. Expected: the tall plants curve over towards it, trunk and all, while the short ones hardly lean. Sweep the mouse fast once across part of the stage: the plants it passes over swing most, the tall ones slowly back and forth, the short ones quickly straight again. With the mouse still, each branch sways a little on its own. Click a few times: no two new plants alike.
5. Open http://localhost:4321/lab/effect/flock/. Expected: a shoal of small fish (a body and a forked tail), some bigger, some slimmer or rounder, each beating its tail, faster when it swims faster. Click near them: they dart off with quicker tails, then gather again.
6. Open http://localhost:4321/lab/effect/spotlight/ and hold the mouse still. Expected: the faint shapes in the dark drift and turn very slightly, each at its own pace; the shapes in the light stay perfectly still. Move the light over a drifting shape: it settles into place as the light reaches it. Click: the light opens over everything and the drifting stops until it closes again.
7. Open http://localhost:4321/lab/effect/sand/ and click several times high up. Expected: each click bursts out a heap of a different size and shape: lumpy, stretched one way or another, with small clumps and loose grains thrown beyond it, never a neat circle. Look closely at the sand: the grains are a mix of sizes, some a little smaller and some a little bigger than the rest, and the coloured stripes are of different widths.

## Foundation check: sitemap, robots.txt, one page top, radii

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "65 page(s) built" with no "Sitemap check failed", then "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/sitemap.xml. Expected: the four games are listed (`/lab/game/2048/`, `/lab/game/catch-the-cat/`, `/lab/game/snake/`, `/lab/game/blocks/`), and so are `/now/` and `/changelog/`. `/random/` is not.
3. Open http://localhost:4321/robots.txt. Expected: `User-agent: *`, `Allow: /`, then `Sitemap: https://jacklee981229.github.io/sitemap.xml`.
4. A forgotten page stops the build. Stop the preview (Ctrl+C), and in `src\lib\collections.ts` put `//` in front of the line `{ path: '/now/', lastmod: nowFile().updated },`. Run `npm run build`. Expected: it stops with `Sitemap check failed.` and `Built but not in the sitemap (...): /now/`. Take the `//` out again.
5. Open Writing, the Lab, Collection, Travel, About, a tag (click one in the home sidebar) and http://localhost:4321/page/2/. Expected: every top looks as before: the big title, the lead, and Collection's tabs, Travel's switch and the Lab's buttons under it, nothing moved.

## Now

1. With the built site running (above), open http://localhost:4321/. Expected: in the sidebar, right under the profile card, a "Now" box: "🎮 Playing" with Shape of Dreams and its small cover, "💻 Building" with Jack's Space, the words lined up on the left and the cover at the right, and "See the Now page". On a phone the sidebar comes after the posts.
2. Click Shape of Dreams. Expected: Jack's Collection opens on the Games tab.
3. Open http://localhost:4321/now/. Expected: "Now", "What I'm up to at the moment.", both items, a little bigger.
4. The date. Once `now.md` is committed and the site rebuilt, both the box and the page end with "Updated today" (or "yesterday", "3 days ago"…). Hover it: the full date shows. Until the file is committed there's no date.
5. Change it from your phone: on github.com open `src/content/now.md` in the repo, edit a line (say `- 🎬 Watching: something new`), commit. Expected: after the deploy (about two minutes) the home box and `/now/` show the new line and "Updated today".
6. Nothing breaks it: with `npm run dev` running, put a line without a colon (`- Taking it easy`) and some text under the list in `src\content\now.md`. Expected: the line shows as it is, the text shows only on `/now/`. Empty the file: the box goes away and `/now/` says "Nothing here right now." Put the two lines back.

## Changelog

1. With the built site running, scroll to the bottom of the home page. Expected: a thin line right across the page with "Changelog ⌄" in the middle, then the footer.
2. Click it (or Tab to it and press Enter). Expected: it opens: "Latest changes" with "See all changes" on the right, then a card for each of the latest three days: the date, and each change with a coloured label (New, Improved, Design or Fix) and its text. Click it again: it closes.
3. Click "See all changes" (or the footer's Changelog link). Expected: http://localhost:4321/changelog/: 2026 with a card per day, then 2023 ending with "Started Jack's Space on Hexo". Collection, Travel Map, About, Lab, Now and Writing are links.
4. On the home page, Site info's "Last update" says 4 Oct 2026 and is a link to the Changelog.
5. A bad line stops the build: in `src\content\changelog.md`, on line 6 (`- 2026-09-26 new: Rebuilt Jack's Space from scratch with Astro`), change `new` to `tweak` and run `npm run build`. Expected: it stops with `Changelog: line 6 of src/content/changelog.md (...) needs a date, a kind and the change…`. Put it back.

## Archives removed

1. With the built site running, look at the menu. Expected: Home, Writing, Lab, Collection, Travel, About.
2. Open http://localhost:4321/archives/. Expected: it goes straight to Writing. The same for an old address, http://localhost:4321/archives/2023/.

## Command palette and Random

1. With the built site running, open http://localhost:4321/writing/ and press Ctrl+K (or `/`, or click the magnifier, whose label now says "Search or run a command"). Expected: the box says "Search or run a command"; under it Switch to dark theme, Home, Lab, Surprise me, each with an icon.
2. Type `json`. Expected: "Lab" with JSON Preview, then "Posts" with posts that mention JSON. Type `preview markdown`: Markdown Preview. Type `orbits`: the effect. Type `snake`: the game. Type `dark`: the theme switch.
3. Keys: type `git`, press ↓ and ↑. Expected: the highlight moves through the list while the cursor stays in the box; Enter opens the highlighted post. Esc closes the palette in one press, even with text in it, and the focus is back on what opened it.
4. Type something with a Chinese input method and press Enter to pick the word. Expected: the word goes into the box; nothing opens.
5. Press Ctrl+K, then Enter on "Switch to dark theme". Expected: the page fades to dark, and the header's button now says (on hover) "Switch to light theme". Press the header's button: back to light, and the palette's first item says "Switch to dark theme" again.
6. Type `xyzq`. Expected: "Nothing matches “xyzq”. Try a shorter word."
7. Surprise me: on any page, Ctrl+K, Enter on Surprise me. Expected: some other page opens (a post, a tool, a game or an effect), never the one you were on.
8. Open http://localhost:4321/random/. Expected: "You got a post:" (or a tool, a game, an effect), its name and what it is, Open it and Pick again. Pick again shows something else. The Lab home's Random box says "Feeling lucky?" with Surprise me, and its button row no longer says "soon".
9. Fullscreen: on http://localhost:4321/travel/, Ctrl+K, Enter on Fullscreen. Expected: only the globe (or flat map) fills the screen. Ctrl+K again: the item says "Exit fullscreen". Do the same on a game (http://localhost:4321/lab/game/2048/, the game in the middle of the screen) and an effect (http://localhost:4321/lab/effect/orbits/, edge to edge). On Writing there's no Fullscreen item. On an iPhone there's none anywhere (its browser can't).
10. Phone: tap the magnifier, type `clean`, tap Clean Text. Expected: it opens.
11. Dev too: with `npm run dev` running, Ctrl+K and `json` still finds JSON Preview; posts aren't searched there, and it says "Posts can only be searched on the built site."

## Starry Night

1. With the built site running, press Ctrl+K and type the secret word (the one from chat). Expected: a single row, "???", with a sparkle, and nothing else. Typing only part of the word shows nothing of it.
2. Press Enter. Expected: the palette closes, the page fades into a near-black night sky with stars and faint green aurora curtains high up, one shooting star crosses at once, and a note at the bottom says you found the night sky and how to leave it (it goes after a few seconds, or on a click). The header's button shows a star.
3. Look around: stars behind every page (the same sky on every page), a few twinkling, the aurora swaying slowly, now and then a shooting star, and every 10 to 20 seconds one star somewhere blinking with a soft glow. The menu row stays plain dark. Nothing at the bottom of the page but the footer. Check the home page, a post with code (http://localhost:4321/7/), a game, an effect, the Travel Map and Collection, on a desktop and a phone.
4. Close the browser tab and open the site again. Expected: still night, from the first moment, without a flash of the old theme.
5. Ctrl+K: the first item says "Leave the night sky". Or press the star button. Expected: back to the theme you had before (light or dark), or the system's if you never chose. Ctrl+K again: "Starry Night" is offered from now on.
6. Less motion: in Windows, Settings → Accessibility → Visual effects → Animation effects off, then turn the night on. Expected: the stars and the aurora stand still, nothing twinkles, blinks or shoots, and the switch is instant.

## Idea bank only on request

1. Open `CLAUDE.md` and find `docs/design-ideas.md`. Expected: it says to read the idea bank only when Jack asks for design ideas or inspiration.
2. Open `docs/design-ideas.md`, "How to use this file". Expected: steps 1 and 4 say the same: only when asked.

## Old Hexo posts and Start here

1. Build and start the built site:
   ```powershell
   cd C:\repos\Jack\jacks-space
   npm run build
   npm run preview
   ```
   Expected: "64 page(s) built" with no error, then "Indexed 14 pages"; the site runs at http://localhost:4321/.
2. Open http://localhost:4321/writing/. Expected: "Start here" first, with Flutter Get Started, Terraria and Git Commands; then the topics, Hexo last.
3. On the home page, the topic row ends with Hexo.
4. Open a Hexo post (http://localhost:4321/7/). Expected: a note above the text: "I wrote this in 2023 for the old version of this site, which ran on Hexo. It runs on Astro now, so these steps may no longer apply." A non-Hexo post (http://localhost:4321/g1/) has no note.

## About

1. Open http://localhost:4321/about/. Expected: the intro, then cards: What I work with (Languages, Frameworks, Tools), Things I like (five covers from the Collection, then a line to My Collection and one to My Travel Map with the five places), Find me (Resume, LinkedIn, GitHub, Email) and This site (running since 23 Feb 2023, and a link to the Changelog). Two cards side by side on a desktop; one under another on a phone.
2. Add your work: in `src\content\pages\about.md`, replace `work: []` with entries like
   ```yaml
   work:
     - role: Senior Software Engineer
       place: Squarebox Technology
       years: 2022 – now
   ```
   With `npm run dev` running, reload http://localhost:4321/about/. Expected: a Work card with each entry: the role, the place under it, the years on the right.
3. Change the intro or the tools in the same file: the page follows after a reload.

## Visitor counter: GoatCounter only

1. With the built site running locally, open http://localhost:4321/. Expected: Site info shows Running for, "Visitors: live site only" (one row, no Page views) and Last update. A post shows no views locally.
2. After the deploy, open https://jacklee981229.github.io/. Expected: Site info's Visitors shows a number (counting since 1 Oct 2026). Open a post: "N views" beside its date.
3. Search the repo for busuanzi: only the plans in `docs/plan/` mention it.

## Game covers

1. Open http://localhost:4321/lab/ and scroll to Mini Games. Expected: each game shows its own cover, a game in play: a 2048 board with tiles up to 64, the cat between blocked dots, a long snake, a stack of blocks. Check in light, dark and the night sky.

## Share pictures

1. With the built site, open http://localhost:4321/og/index.png, http://localhost:4321/og/about.png and http://localhost:4321/og/lab/effect/orbits.png. Expected: 1200 by 630 pictures: the section label with a coloured dot, the title, the description, and "Jack's Space jacklee981229.github.io" at the bottom; Lab pages in the Lab's green.
2. A post with a cover and the games share their covers: in the page source of http://localhost:4321/lab/game/2048/, `og:image` points to the game's cover.
3. After the deploy, paste a few addresses (the home page, a tool, a game, About) into LinkedIn's Post Inspector (https://www.linkedin.com/post-inspector/). Expected: each shows its picture, large.

## Home bento

1. Open http://localhost:4321/ at full width. Expected: the big two-line "Jack's / Space" types in; tiles in four columns: the hero and Now on the left, Travel and This site stacked on the right, Lab and Latest changes under them, Collection and Writing at the bottom. Edges line up in every row.
2. The Lab tile: an effect is moving in the dark green box, its name in the corner ("Today's toy"). Move the mouse over it: it follows. Click the name: that effect's page opens.
3. Back home, click Surprise me. Expected: something on the site opens (a post, tool, game or effect).
4. Travel shows the number of places and a small globe with them coloured. This site shows the days running and "updated 4 Oct 2026" (visitors only on the live site).
5. Make the window narrower than 1100 px: two columns, no gaps. Narrower than 720 px (or on a phone): one column in the order Hero, Now, Lab, Latest changes, Collection, Travel, Writing, This site. Nothing scrolls sideways.
6. Open http://localhost:4321/page/2/. Expected: it forwards to Writing.
7. Switch to light, then type the secret word in the palette for the night sky. Expected: the page reads well in each; the Lab box stays green.

## Links without underlines

1. Open http://localhost:4321/ and point at a tile's title (Lab), "See all", "See the Now page" and "All posts". Expected: no underline; a soft pill comes up behind the words and an arrow slides out. Nothing beside them moves.
2. Point at a Lab row and a cover. Expected: the row tints; the cover grows a little.
3. Open http://localhost:4321/writing/ and point at a post. Expected: the row tints, no underline.
4. Open a post, e.g. http://localhost:4321/g1/. Point at the topic (Git) above the title, "Copy link", the Older post title and the footer's Changelog. Expected: pills and arrows (Copy link: a pill without an arrow). A link inside the post's text is still underlined.
5. Press Tab through the home page. Expected: each of these links shows its pill and arrow along with the focus ring.

## 2048 Bot

1. Open http://localhost:4321/lab/game/2048/ and click New game. Click the robot button (Bot). Expected: the game plays itself, about five moves a second; the button turns into a square (Stop).
2. Click Stop. Expected: it stops at once.
3. Click Bot again, then press an arrow key. Expected: the bot stops and your move is made. Same with Z (it stops and takes one move back) and New game.
4. Click Bot and switch to another tab for a moment. Expected: back on the page, the bot has stopped.
5. Let the bot play until a message comes up. Expected: it stops at "You made 2048!" (Keep going, then Bot again plays on) or "No more moves."; neither message offers the name box, and Best stays where it was.
6. Reload during a bot game, then play it to the end yourself. Expected: still no name box: a game the bot played in stays off the leaderboard until New game.
7. On a laptop the buttons above the board are three round icons on the same line as the scores; point at one for its name. On a phone they show their names, on a line under the scores.

## Jack's Town

1. Open http://localhost:4321/lab/world/town/. Expected: a town seen from above fills the window under the Lab header: grey roads with kerbs, houses (a pitched roof, a drive beside it) and places (a flat roof with a ring, three parking bays in front) in four colours, coloured stop lines at the junctions, cars, and one to three roads running off the edge. Each load is a different town.
2. Watch a house whose car is parked on its drive. Expected: when it leaves it waits for a gap, backs out onto the lane with white lights at the back, stops, and drives off.
3. Follow a car to a place of its colour. Expected: it blinks its indicator, slows, turns into a free bay and parks nose in beside the others; later it backs out and drives home, where it turns into its own drive.
4. Watch a junction for a minute. Expected: cars stop at red (brake lights on), go on green, queue behind each other, signal before turning, and keep to the left. No car drives through another.
5. Watch a road that runs off the edge. Expected: cars drive in from beyond the edge and out past it; none pops up or disappears inside the town.
6. Click Pause, then Play. Expected: the town stops and carries on. Switch to the light theme: the same town in light colours.
7. Run the simulation's tests: `node --test tests/town.test.js`. Expected: `# pass 10`, about half a minute (four towns each run a whole day).
8. Open http://localhost:4321/lab/. Expected: a Little Worlds button among the section links; it jumps to a Little Worlds section after Effects with Jack's Town's card (a picture of the town); the card opens the town.
9. Press Ctrl+K and type `town`. Expected: Jack's Town under Lab. http://localhost:4321/sitemap.txt lists `/lab/world/town/`.

## Jack's Train World (hidden)

1. Open http://localhost:4321/lab/world/trains/. Expected: a train set seen from above fills the window under the Lab header: a double-track main line round the edge; outposts off its top and bottom, each standing straight up from it, in three shapes (a plain loop, a round head, a loop with two platforms), each with its yard (crates in a colour at a pickup, a building in a colour at a drop-off, with a stock bar on its roof); a depot of parallel sidings beside a shed; and six trains (four on a phone), each a dark engine and three grey wagons, most of them already running.
2. Watch a train leave a platform. Expected: it pulls away slowly and picks up speed for about three seconds; along the main line it runs fastest, without slowing where it goes straight on past a station's junction; it slows down for about two seconds before it stops, and well before a red. The lamps ahead of it turn amber before it arrives and red as it passes, green again behind it; it never stops inside a junction.
3. Watch a pickup. Expected: a train stops at the platform and its wagons fill with the pickup's colour one after another; it then goes to the drop-off of that colour, where the wagons empty and the drop-off's stock bar fills up; then it goes back to a siding in the depot.
4. Watch a drop-off's bar. Expected: it shrinks (a full bar lasts about 80 seconds); whenever there's room on it for another load (about a third of the bar), a train sets off from the depot for it, and a second one if there's room for one more before the first arrives. Each delivery fills about a third of the bar.
5. Reload a few times. Expected: a different network each time, stations spread along the main line. Make the window narrow or open it on a phone: the network stands upright with two colours.
6. Click Pause, then Play; switch between light and dark. Expected: it stops and carries on; the same network in the theme's colours.
7. Click a train (tap it on a phone). Expected: over a train the pointer is a hand; the view glides in until the whole train fills about half the stage, then follows it, the train staying in the middle while the network slides past (near the edge, the page's colour shows beyond the network). Click another train in view: the view glides over to it.
8. Click anywhere that isn't a train, or press Esc. Expected: the view glides back out to the whole network.
9. Run its tests: `node --test tests/trains.test.js`. Expected: `# pass 16`, in about fifteen seconds (five networks each run a whole day).
10. It isn't in the Lab, the sitemap or search engines yet: http://localhost:4321/sitemap.txt has no `/lab/world/trains/`.
