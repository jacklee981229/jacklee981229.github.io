# Jack's Space — Music in the Collection

Asked in chat on 6 Oct 2026.

- Add music, or the OST, to the movies and dramas in the Collection.
- Rename "Movies" to a word that fits both movies and dramas. Is it "Film"?

What I checked before planning (6 Oct 2026):

- All eight have their music on Spotify, for example:
  - 难哄: 任性 by Mayday, its theme song (主題曲);
  - 逐玉: 我對緣分小心翼翼 by JJ Lin, its theme song;
  - Howl's Moving Castle: Merry-Go-Round of Life by Joe Hisaishi;
  - Stranger Things: its theme by Kyle Dixon & Michael Stein;
  - Wednesday: Wednesday Main Titles by Danny Elfman.

  The Uncanny Counter, Happiness and Teach You a Lesson have their soundtrack albums there.
- Spotify's own player can sit in a page, free and with no account or key from us. A visitor logged in to Spotify in that browser hears the whole song; anyone else hears a 30-second preview, marked "Preview". Spotify's kit for whole songs on a website (the Web Playback SDK) needs each listener's own Premium login, so your Premium can't open whole songs for visitors.
- A page can start, pause and skip Spotify's player, but it can't fade it in or set its volume. Safari doesn't let it start without a press (Spotify's own docs say so).
- "Film" mostly means movies, and seven of the eight are series. Only Howl's Moving Castle is a film.

## Not in this plan

- Music for the games (you asked for the movies and dramas; it can come later).
- Music anywhere but an item's gallery: not on the board, the home page or other pages, and none that keeps playing when you leave the page.
- The songs' own audio files in the repo, played by our own player. You asked; it would fade in at 50% for everyone, but the songs are copyrighted and the repo and site are public, so it would be publishing them without permission, and a takedown could disable the whole site.

---

## Decisions and tasks

Agreed in chat on 6 Oct 2026.

- **D119. The music plays in Spotify's small player** (your pick): about 80 px tall, dark, with the song's cover art. The whole song for visitors logged in to Spotify, a 30-second preview for the rest.
- **D120. One song per show**, its theme song or best-known track (your pick of my recommendation). I list all eight (show, song, singer, link) for your OK; you swap any.
- **D121. A press starts it** (your pick of my recommendation). In the gallery, under the name and stars, a small button with the song and singer; pressing it puts Spotify's player there and starts the song (in Safari, a second press on the player's own ▶). It keeps playing while you step through the pictures and stops when the gallery closes. You first wanted it to start by itself, fading in at 50%, but Spotify's player can't fade or have its volume set by the page, so a song starting by itself would come out of nowhere.
- **D122. "Movies" becomes "Film & TV"** (your pick of my recommendation). Only the name visitors see changes: the tab, the home page's Collection tile and the words search finds it by. The folder stays `movies`, so the link /collections/#movies keeps working.

What I'll do unless you say otherwise:

- Each show's song goes in its collection list as `music:`, with the song's name, the singer and the Spotify link (Spotify's Share, then Copy Song Link), so you can add or change one yourself; the Collection's README says how. A link that isn't a Spotify song stops the build with a message naming the show, like a missing picture.
- Song names show as written on Spotify, Chinese and all.
- The button wears the gallery's Close pill look (no mockups this time; say if you'd like some first). Spotify's player in its dark look, in both of the site's themes, since the gallery is always dark.
- Nothing from Spotify loads with the page or the gallery, only after the press, the way the gallery's pictures load only when it opens.
- A changelog line for each visible change.

Tasks:

- **M1. The new name** (D122). The `name:` line in `src/content/collections/movies/index.yaml`; the palette finds the Collection by "film", "tv", "dramas" and "series" too (`src/lib/palette-items.ts`); a changelog line. *Check:* the Collection's tab and the home page's Collection tile say "Film & TV", /collections/#movies still opens it, and the palette finds it by the new words. *Done when:* `npm test`, `npm run check` and `npm run build` pass, and you've seen it.
- **M2. The music** (D119–D121).
  1. The list for your OK: show, song, singer, Spotify link, and why that one.
  2. `music` in the collections' schema (`src/content.config.ts`) and in `movies/index.yaml`; turning a song link into the player's address in `src/lib/shelves.js`, tested: a Spotify song link works, any other link stops the build.
  3. The button and the player in the gallery (`src/pages/collections.astro`): a press loads the player and starts the song, stepping keeps it playing, Close and Esc stop it, and the pictures fit around the player.
  4. The README, CLAUDE.md, a TESTING.md section and a changelog line.

  *Check:* at 1280 px and on a phone, on my own preview: every show's button names its song; a press loads Spotify's player and the song plays (a preview in my logged-out browser); stepping keeps it playing; Close and Esc stop it; nothing goes to Spotify before the press; a wrong link stops the build. *Done when:* the checks pass, `npm test`, `npm run check` and `npm run build` pass, and you've listened.

M1 can ship on its own; M2 follows, one commit.
