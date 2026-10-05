# Jack's Space — the Collection's gallery

Asked in chat on 5 Oct 2026, mainly for Movies.

- Remove the notes: the comment that opens beside an item.
- A click on an item, Stranger Things for example, opens a gallery of that item's covers: left, MIDDLE, right. A little
  like a photo you found of three paintings in a gallery room: the middle one facing you, the other two on the side
  walls.
- It moves left and right. The left and right covers aren't really shadows but a blurred or greyed version, and a click
  on either side switches to it.
- Download several different covers for every movie; each movie's gallery shows its own.

---

## Decisions and tasks

Agreed in chat on 5 Oct 2026.

- **D108. The notes go, words and all.** No note box; no `comment:` field; no "Great movie!" or "Great game!" (this undoes D105's notes and D107). Your seven notes stay in git's history only.
- **D109. A click on an item opens its gallery over the page**: its covers one at a time, the middle one big and sharp, the one before it on the left and the one after it on the right, as the sides' look (D112) shows them. A click on a side cover, ‹ or ›, the arrow keys or a swipe swaps to it; it goes round from the last cover to the first. The name and stars are at the top, "2 / 5" under the covers; × or Esc closes it and puts you back on the item. Under less motion the covers change without sliding.
- **D110. Movie covers from TMDB**, where today's posters came from (D32): five different posters per movie, picked by me, in a mix of languages and looks. Before downloading I list them with their sizes for your OK; you then review them in the gallery.
- **D111. Games get covers too, in big versions** (you choose): about five official pictures per game (the store's cover at its double size, other editions' covers, key art), from the stores' own picture servers, listed for your OK the same way. A picture keeps its own shape in the gallery, so wide key art shows whole.
- **D112. The sides' look is mockup A, "soft turn"** (your pick of four): the side covers a little smaller, turned slightly in towards the middle, dimmed and a touch blurred; a swap slides them along.
- **D113. Built in one go, without stopping** (your word, 5 Oct 2026; this changes D110 and D111): G1 and G2 one after the other, with no stop for the cover list's OK. The pictures come only from the sources D110 and D111 name, and the hand-over lists every one with its source and size.
- **D114. A game's pictures must each look different** (your word, 5 Oct 2026, after the first try; this changes D111): not one key art again in another shape or size. The first try was set aside, and the gallery went in with the movies alone; the games keep their covers alone until G3.

Tasks:

- **G1. The gallery** (D108, D109, D112), with the covers there are today.
  - The note goes: its box, script and styles in `src/pages/collections.astro`, `comment` in `src/content.config.ts`, `defaultComment` and `placeNote` in `src/lib/shelves.js` with their tests, the comments in `movies/index.yaml`, the README's rule.
  - A click on an item opens the gallery (a dialog, so the keys and the focus behave), in the look you pick; its pictures load only when it opens.
  - The step maths (which cover is middle, left and right, going round) in `src/lib/shelves.js`, tested.
  - A changelog line.

  *Done when:* `npm test`, `npm run check` and `npm run build` pass; at 1280 px in both themes a click on any item opens its gallery, a side cover, ‹ ›, the arrow keys and a swipe swap covers, × and Esc close it with the focus back on the item, and an item with one cover opens with no sides; a TESTING.md section is written; and you've tried it.

  *Built 5 Oct 2026:* the note's code and styles, `comment`, `defaultComment`, `placeNote` and their tests are gone, and the seven notes are out of `movies/index.yaml`. Each item is now a button; a click fills the one gallery dialog from the item's own `<template>` of pictures, made while the site is built in sizes up to 1440 px wide, so nothing in it loads until it opens. `galleryOf` and `stepsFrom` in `src/lib/shelves.js`, tested. Each picture keeps its own shape, and the side pictures are placed just clear of the middle by their real widths. It wears a post's enlarged picture's backdrop and Close button, with the page behind also blurred so its covers don't compete with the dimmed side pictures; Close takes the first focus, and a click on the dark around the pictures closes it, as on a post's enlarged picture. Checked at 1280 px in both themes and on a phone: every way of stepping and closing, the focus back on the item, the page held still, no gallery picture loading with the page, and the sides clear of the middle at every step. *The sweep* (eight window sizes from a phone to 1920 by 960, both themes, the keyboard, contrast, less motion, every page) found two things, both fixed: on opening, the first picture was sized before the "1 / 5" line was there, so it ran into that line until the first step; and Close came last when tabbing, though it sits at the top. It now comes first.
- **G2. The covers** (D110, D111). The list (movie, picture, source, size) for your OK; then the downloads into each collection's folder, each listed under its item as `gallery:` (the cover on the board stays `image:`), a missing one stopping the build like a missing `image:`; the README says how. *Done when:* every movie has five covers and every game about five pictures, all showing in their galleries at 1280 px and on a phone; the build passes; a changelog line; and you've looked through them.

  *Built 5 Oct 2026, the movies:* each movie has four more TMDB posters, different looks in a mix of languages and some with no words, picked from about twenty each; its cover was saved again from TMDB at up to 1000 by 1500 (it was 500 px wide), so the gallery opens as sharp as the rest. You confirmed this part, and it went in on its own (the games stay at their covers alone until G3). *The games, first try:* four more official pictures each from the Microsoft Store (poster, square box art, wide key art, promotional square) and Steam (wide library art, store background). You found them too similar, or the same picture again: the stores mostly have one key art in different shapes and sizes. They were set aside (D114). The movies' pictures, with where each came from:
  - `movies/stranger-things.jpg` 1000×1500, 180 KB: TMDB, English, image.tmdb.org/t/p/original/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg
  - `movies/stranger-things-2.jpg` 1000×1500, 198 KB: TMDB, English, image.tmdb.org/t/p/original/mGn3kQAVssGkWCAjmYrEvD9tIRd.jpg
  - `movies/stranger-things-3.jpg` 680×1000, 199 KB: TMDB, English, image.tmdb.org/t/p/original/xvSUOU0IEbLka8RixocDfwgkdWZ.jpg
  - `movies/stranger-things-4.jpg` 1000×1500, 232 KB: TMDB, no words, image.tmdb.org/t/p/original/uAc35R8pBa7ykvDfgy1tQs76ETP.jpg
  - `movies/stranger-things-5.jpg` 1000×1500, 236 KB: TMDB, Japanese, image.tmdb.org/t/p/original/DGWUKWfKr03DoEDKZSR1DhNqA.jpg
  - `movies/the-uncanny-counter.jpg` 814×1220, 157 KB: TMDB, English, image.tmdb.org/t/p/original/tKU34QiJUfVipcuhAs5S3TdCpAF.jpg
  - `movies/the-uncanny-counter-2.jpg` 1000×1500, 262 KB: TMDB, Korean, image.tmdb.org/t/p/original/ups2XydNWHFpil3qQUgE7KcViOb.jpg
  - `movies/the-uncanny-counter-3.jpg` 1000×1500, 221 KB: TMDB, no words, image.tmdb.org/t/p/original/bsbuXbQqryQ8aJlwXFkFXbrYko1.jpg
  - `movies/the-uncanny-counter-4.jpg` 680×1000, 106 KB: TMDB, English, image.tmdb.org/t/p/original/jy42fQOYbgyY3dbQ0UBCvpx5kqC.jpg
  - `movies/the-uncanny-counter-5.jpg` 960×1440, 155 KB: TMDB, English, image.tmdb.org/t/p/original/yoEwbpfV8ciW8AOfxpGQayx9KSV.jpg
  - `movies/wednesday.jpg` 1000×1500, 178 KB: TMDB, English, image.tmdb.org/t/p/original/9PFonBhy4cQy7Jz20NpMygczOkv.jpg
  - `movies/wednesday-2.jpg` 1000×1500, 194 KB: TMDB, English, image.tmdb.org/t/p/original/kKwy8QiXyQocbDj4haUG0uD1SbF.jpg
  - `movies/wednesday-3.jpg` 1000×1481, 131 KB: TMDB, English, image.tmdb.org/t/p/original/36xXlhEpQqVVPuiZhfoQuaY4OlA.jpg
  - `movies/wednesday-4.jpg` 1000×1500, 62 KB: TMDB, English, image.tmdb.org/t/p/original/gq5xcbK2IDM6DeYLdpHqLpoxU0f.jpg
  - `movies/wednesday-5.jpg` 1000×1500, 115 KB: TMDB, no words, image.tmdb.org/t/p/original/7p6JEySCeQeJItgAw8hz8V6j8xn.jpg
  - `movies/happiness.jpg` 1000×1500, 173 KB: TMDB, English, image.tmdb.org/t/p/original/tU1naKQs9Q0r5Uw9dy0PPUre0hq.jpg
  - `movies/happiness-2.jpg` 1000×1500, 124 KB: TMDB, Korean, image.tmdb.org/t/p/original/go3l8u9cyZXotJWqorI8jWW2Jn7.jpg
  - `movies/happiness-3.jpg` 1000×1500, 150 KB: TMDB, Korean, image.tmdb.org/t/p/original/6cXBRxF2mZYT64oZVSNTiaTVy5L.jpg
  - `movies/happiness-4.jpg` 680×1000, 50 KB: TMDB, English, image.tmdb.org/t/p/original/5ICbC908OwjbXy7ILbrs602GPJd.jpg
  - `movies/happiness-5.jpg` 680×1000, 72 KB: TMDB, English, image.tmdb.org/t/p/original/dvA1DlmIyfBg06FPc9bLBUfISrz.jpg
  - `movies/nan-hong.jpg` 1000×1500, 140 KB: TMDB, Chinese, image.tmdb.org/t/p/original/cTYyp5ggqQhr264P1tXTB6rwjKl.jpg
  - `movies/nan-hong-2.jpg` 854×1280, 200 KB: TMDB, Chinese, image.tmdb.org/t/p/original/2F9usvOEtqoXKoCCQrpdJcZMisI.jpg
  - `movies/nan-hong-3.jpg` 1000×1500, 209 KB: TMDB, Chinese, image.tmdb.org/t/p/original/jEc0eR95R1aZGu01HbWxjErWjEz.jpg
  - `movies/nan-hong-4.jpg` 900×1350, 120 KB: TMDB, no words, image.tmdb.org/t/p/original/mbRlIbzKIYP98X2Gi4veewH4LQl.jpg
  - `movies/nan-hong-5.jpg` 1000×1500, 177 KB: TMDB, English, image.tmdb.org/t/p/original/8AeyYT8HBsYaKiTq7P3e9QZW7be.jpg
  - `movies/howls-moving-castle.jpg` 1000×1500, 199 KB: TMDB, English, image.tmdb.org/t/p/original/13kOl2v0nD2OLbVSHnHk8GUFEhO.jpg
  - `movies/howls-moving-castle-2.jpg` 1000×1500, 168 KB: TMDB, Japanese, image.tmdb.org/t/p/original/v0K2e1t6ocUNnkZ9BeiFdcOT9LG.jpg
  - `movies/howls-moving-castle-3.jpg` 892×1336, 123 KB: TMDB, Japanese, image.tmdb.org/t/p/original/tJ2kRPC7i099UfEiQ6XSj1EV8ti.jpg
  - `movies/howls-moving-castle-4.jpg` 750×1125, 90 KB: TMDB, English, image.tmdb.org/t/p/original/p6hjIRl77a7zERk8sPhJWuFXDgv.jpg
  - `movies/howls-moving-castle-5.jpg` 1000×1500, 162 KB: TMDB, no words, image.tmdb.org/t/p/original/fXKg3wkHfWoZEiJUZYxcrdPNWKi.jpg
  - `movies/zhu-yu.jpg` 1000×1500, 166 KB: TMDB, Chinese, image.tmdb.org/t/p/original/cYV1cn51qeu7aLqMUrSsmPe1QNo.jpg
  - `movies/zhu-yu-2.jpg` 1000×1500, 250 KB: TMDB, Chinese, image.tmdb.org/t/p/original/ijO7oElnlSHlGlPJ5gtlWG8UP1q.jpg
  - `movies/zhu-yu-3.jpg` 1000×1500, 108 KB: TMDB, Chinese, image.tmdb.org/t/p/original/29abWAgWXYVGs8IeumQACVXm1dA.jpg
  - `movies/zhu-yu-4.jpg` 1000×1500, 220 KB: TMDB, Chinese, image.tmdb.org/t/p/original/r0tun2ibKc9YucnQ57rUUMC8s8j.jpg
  - `movies/zhu-yu-5.jpg` 1000×1500, 382 KB: TMDB, no words, image.tmdb.org/t/p/original/yf84gIa0x2xH5sn8xHMRuDSOFGY.jpg
  - `movies/teach-you-a-lesson.jpg` 896×1344, 168 KB: TMDB, English, image.tmdb.org/t/p/original/fMECSPrTmRClSViMsXFYmiYIcWP.jpg
  - `movies/teach-you-a-lesson-2.jpg` 1000×1481, 221 KB: TMDB, Korean, image.tmdb.org/t/p/original/nqswtN5h6G66mFYXkIeCiWtFJcO.jpg
  - `movies/teach-you-a-lesson-3.jpg` 667×1000, 63 KB: TMDB, no words, image.tmdb.org/t/p/original/gqrVGt40dKVvVxktMTHAaEBH0fJ.jpg
  - `movies/teach-you-a-lesson-4.jpg` 710×1067, 63 KB: TMDB, no words, image.tmdb.org/t/p/original/Ajm5YDX0WEouLdoSxtHKfLpu1az.jpg
  - `movies/teach-you-a-lesson-5.jpg` 735×983, 63 KB: TMDB, no words, image.tmdb.org/t/p/original/mcKAlrWgGzXeQaDWYTtiyGiCOXh.jpg

  40 files, about 6.5 MB.
- **G3. The games' pictures, again** (D114). About four more per game, each clearly a different picture from the cover and from each other, from the games' official sources; listed with sources and sizes as before. *Done when:* every game's pictures look different at a glance in its gallery at 1280 px; the build passes; and you've looked through them.
