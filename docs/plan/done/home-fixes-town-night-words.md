# Jack's Space — Home fixes, the Town's night, About and Collection words

The next round, after a look at the live site on 5 Oct 2026, in the order agreed in chat. The decisions and tasks are
below.

## What we found

1. **Latest changes shows a busy day's oldest lines.** The home page's Latest changes tile shows the four newest
   changes, but changes on the same day keep their order in `src/content/changelog.md`, and new lines are added at the
   bottom. So on 5 Oct, a day of twelve changes, the tile shows the first four written that day (the tiles, the link
   pills, the 2048 Bot, Little Worlds) and never the newest (the Train World's night lights, the drop-off bars). The
   Changelog page says "newest first" but lists each day oldest first. The cause is the sort in `readChangelog`
   (`src/lib/changelog.js`).
2. **The home page doesn't show Little Worlds.** The Lab tile's line reads "7 tools · 4 games · 18 effects" (`counts`
   in `src/pages/index.astro`), its rows are a tool, a game and an effect, and today's toy is an effect. The two
   newest things on the site have no way in from the home page.
3. **Jack's Town has no night.** Jack's Train World lights up in the dark theme (D99); the Town, beside it in Little
   Worlds, doesn't. Its plan, [little-worlds-town.md](../done/little-worlds-town.md), still has W3 (night) and W4 (rush hour)
   open, although its to-do is already ticked.
4. **Words still waiting for Jack:**
   - About's intro is still my draft (D54) and calls the site "my programming journal", but the site is now built
     around what Jack does, not around writing.
   - About's Work list is empty, so it doesn't show.
   - The tagline, "Things I build, play and love", stands in until Jack picks (D71).
   - None of the Collection's 15 items has a comment, so every note says "No comment yet."

## Not in this plan

- The next big piece, a plan of its own once this one is done: the five tools the Lab home shows as "Soon" (my pick)
  or a third Little World.
- Rush hour in the Town (D103), and a world among the home page's rows or as today's toy (D102).

---

## Decisions and tasks

Agreed in chat on 5 Oct 2026, when you said to follow my order. One task at a time, as before.

- **D101. A day's newest change comes first.** New lines go at the bottom of `changelog.md`, so a later line on the same day is a newer change, and `readChangelog` puts it first; days stay newest first. The home page's tile then shows the last four lines of the newest day, and each day's card on the Changelog page reads newest first, as its lead says. The file's top comment says to add lines at the bottom.
- **D102. The Lab tile counts Little Worlds:** "7 tools · 4 games · 18 effects · 2 worlds", the number from `WORLDS` in `src/lib/lab/tools.js`. Its rows and today's toy stay as they are (D69, D70): with D101, the worlds' newest changes reach the home page through Latest changes.
- **D103. The Town's night matches the Train World's, and rush hour is dropped.** W3: in the dark theme and the night sky, the Town lights up the way the Train World does (D99): the same warm light, added on top of what's under it and drawn under the cars; a driving car's headlights reach ahead and a parked car's are off; the stop-line lights glow in their colour; homes and places show lit windows. The light theme stays as it is. W4's rush hour is dropped: the lights already answer the traffic (D96), and the number of cars already rises and falls as visitors come and go. With W3 built, the Town's plan is finished.
- **D104. The words are Jack's, by interview.** Jack doesn't like writing, so the session asks and he answers in a few words, in Chinese or English. Claude turns each answer into plain English that stays close to what he said (nothing added, no flourishes) and shows every line before it goes in. The draft post was set aside because it didn't sound like him; these must.
- **D105. Your words as you typed them** (your word, 5 Oct 2026; this changes D104). An answer in Chinese goes in as you typed it, not turned into English. An English one keeps every word: only a capital at the start of each sentence and on names, and a full stop where one was missing.
- **D106. No headlights in the Town** (your word, 5 Oct 2026, after seeing them; this changes D103). The Town's night is the stop lines' glow and the lit windows; its cars have no headlights.
- **D107. An item without a comment says "Great movie!" or "Great game!"** (your word, 5 Oct 2026, in place of "No comment yet."): "Great" and its collection's name without the last "s". The four you'd left for later (Persona 5 Royal, Death Stranding, Palworld, V Rising) say it too, so F3 is finished.

Tasks:

- **F1. Newest first, and Little Worlds counted** (D101, D102), one commit.
  - `readChangelog` in `src/lib/changelog.js`: on the same day, a later line comes first; its comment says so.
  - `tests/changelog.test.js`: the first test expects a day's later lines first.
  - `src/content/changelog.md`: the top comment says new lines go at the bottom.
  - `src/pages/index.astro`: `counts` gains the worlds, and the Lab tile's line ends "· 2 worlds".
  - A changelog line for each (a visitor can see both).
  - This plan and the Publishing steps added to CLAUDE.md on 5 Oct weren't committed: they go in F1's commit too.

  *Done when:* `npm test`, `npm run check` and `npm run build` pass; on `npm run preview` at 1280 px the home page's Latest changes shows the newest day's last four lines, newest on top, the Lab tile's line ends "· 2 worlds" on one line, and the Changelog page lists each day newest first; a TESTING.md section is written; and you've looked. In the sweep, check the Lab tile's line where the tile is narrowest (1100 px, and phones); if it doesn't fit on one line, report before changing the tile.

  *Built 5 Oct 2026:* `readChangelog` turns the list round before its sort (which keeps equal days in their order), so a day's later lines come first; the first changelog test and the grouping test now expect that. The file's top comment and the Changelog rule in CLAUDE.md say new lines go at the bottom. The Lab tile's line counts `WORLDS` and fits on one line beside the title at 1280 and 1100 px; on a phone (375 px) it moves under "Lab", still on one line (before, the shorter line fitted beside it). Two changelog lines.
- **F2. The Town's night** (D103; W3 in [little-worlds-town.md](../done/little-worlds-town.md)). Start from how `src/worlds/trains.js` draws its beams and glows (`BEAM`, `GLOW`, the glow pictures), so the two worlds' light is the same. Drawing only: the traffic doesn't change.

  *Done when:* in the Lab's dark theme and the night sky at 1280 px, driving cars light the road ahead and parked ones are dark, the stop-line lights glow and windows are lit; the light theme looks as before; a frame's time at night is measured against day, as the Train World's was; `tests/town.test.js` passes unchanged; a changelog line and a TESTING.md section are written; and you've watched it. In the same commit, mark W3 built and W4 dropped (D103) in [little-worlds-town.md](../done/little-worlds-town.md) and `git mv` it to `done/`; its to-do is already ticked.

  *Built 5 Oct 2026:* what was built and measured is under W3 in [little-worlds-town.md](../done/little-worlds-town.md), now in `done/` with W3 built and W4 dropped.
- **F3. About and Collection words** (D104). One thing at a time:
  1. About's intro: a few short questions (what you do at work, what you build and play for fun, anything a visitor should know), then two short versions from your answers to pick from. "Programming journal" goes.
  2. About's Work list (role, place and years, newest first), or leave it hidden; and whether "What I work with" is right.
  3. The tagline: keep "Things I build, play and love" (my pick: it says what the site is now), take one of D71's other two, or your own. The title and link previews follow it.
  4. The Collection: a line for each of the 15 items, a few at a time; any you skip keep "No comment yet."

  The words go in `src/content/pages/about.md` (the intro, `work`, `tools`), `tagline` in `src/site.ts` and `comment:` in each collection's `index.yaml` (its README says how). *Done when:* every line is one you've OK'd; `npm run build` passes; About, the home page's hero and the Collection's notes show them at 1280 px; a changelog line for what a visitor can see; and you've read them on the page.

  *Built 5 Oct 2026, by interview:*
  1. The intro: from your answers (the job title only; what the site shows; nothing more), version A of two; "programming journal" is gone.
  2. Work: your two jobs from your resume, newest first, without the internship. What I work with is hidden (`tools: []`). The sweep found the Work card squeezing a job onto two lines on phones and tablets (720 to 900 px); a job's years now go under it where there's no room beside it.
  3. The tagline stays "Things I build, play and love".
  4. The Collection: notes for seven movies, as you typed them (D105). The other eight items say "Great movie!" or "Great game!" (D107: `defaultComment` in `src/lib/shelves.js`, tested), and their note is no longer greyed out.

When F3 is pushed, this plan moves to `done/`.
