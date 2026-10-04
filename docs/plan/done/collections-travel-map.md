# Jack's Space — Collections & Travel Map

## 1. Collections

Create a simple **Collections** section.

Purpose:
- A personal exhibition cabinet for things I like.
- Examples: Movies, Games, and other collections.

Each item:
- Image
- Name
- Star rating

Keep it very simple.
I can add my own items and arrange them by collection/category.

---

## 2. Travel Map

Create a **Travel Map** section.

Main idea:
- Show a world map.
- Places I have visited are highlighted with color.
- Places I have not visited stay mostly uncolored, with only map lines visible.

Two modes:

### Flat
A normal 2D world map.

### Globe
A 3D globe that I can rotate with the mouse.

The visited places should light up / have color in both modes.

The overall look should be clean, minimal, and visually cool.

---

## Decisions and tasks

Approved 2 Oct 2026. Your plan above: a Collections page (a cabinet of things you like, each a picture, a name and stars) and a Travel Map (the countries you've visited coloured, the rest only lines; flat or as a globe you can turn). It comes before the trim of the Lab's effects.

- **D22. Two new menu items**, Collections and Travel, before About, at `/collections/` and `/travel/`. On a phone the menu row slides sideways, so the last items sit off to the right. With seven items the menu takes its own row under the site's name below 860 px wide (it was 720).
- **D23. A collection is a small text file with its pictures beside it**, in `src/content/collections/<name>/`. No admin page: the site is plain files. Items show in the order they're listed. Stars run from 1 to 5, halves allowed. An item with no picture gets a plain cover with its name.
- **D24. Pictures may be posters and cover art, kept small** (your choice). They're other people's copyrighted pictures: the risk is small but not zero, and an owner could ask for one to be taken down. Only JPG, PNG and WebP files are taken, because the picture library this version of Astro uses has known holes in other formats.
- **D25. The map colours whole countries.** A visited place too small to see on a world map (Singapore, Hong Kong) is named under the map but not drawn (changed 3 Oct: it had a dot, which you asked to remove). A name the map doesn't know stops the build with a plain message. The count says "places", not "countries".
- **D26. Map packages** (approved): `d3-geo` and `topojson-client` for the map maths, and `world-atlas` for the country shapes (Natural Earth, public domain). They load only on the map page.
- **D27. The flat map is drawn while the site is built**, so it shows at once and needs no script. The globe is drawn in the browser, turns with a drag, and turns slowly by itself until touched.

Your changes of 3 Oct 2026, after seeing the first build:

- **D28. Collections is a board with a tab for each collection**, not one long page. The cards stand on a turntable: choosing a tab turns it half-way round, so the card at the back comes to the front (clockwise for a tab further along, the other way for a tab back).
- **D29. Five items to a row, wider apart.** A name has room for two lines; names and stars sit in the middle under the cover. A thin line runs between one row and the next (not between a cover and its name, where it first was).
- **D30. An item grows a little under the mouse; after about two seconds its note opens beside it** (right, or left at the end of a row) with your comment on it. Until a comment is written the note says "No comment yet."
- **D31. Each visited place has its own colour**, running from home (red) through orange to the farthest place (yellow), in order of distance, so places near each other look alike. The colours follow ColorBrewer's yellow-orange-red scale, darker on the light theme to stay readable. The visited places breathe: a soft glow that swells and fades, gentle at rest.
- **D32. The pictures** were downloaded with your OK: the games' covers from the store's own picture server (its 600 px versions), the shows' posters from TMDB, in the language you wrote each name.
- **D33. A visited place under the mouse rises out of the map like a hologram** (flat map and globe): a little bigger, thin lines across it, its name over it in capitals, and its breathing stronger. The globe holds still while a place is risen. The pointer over the globe is the ordinary arrow, not a dragging hand.
- **D34. The pages are called "Jack's Collection" and "Jack's Travel Map"**, and their tops tally with Writing's and the Lab's: the big title, the lead, then the tabs or the switch under it. (They first had a small top of their own.) The menu says Collection and Travel.
- **D35. The Travel Map opens on the globe**; Flat is the other choice. This changes D27: the first view now needs its script, where the flat map needed none.
- **D36. The globe opens out into the flat map, and closes up again**, when the switch is used: it turns to the map's middle as it unrolls, in a little over a second. With reduced motion the two just swap.

Tasks:

- **M1. Mockups** of the Collections page and the map, flat and globe, in both themes, for your OK.
- **C1. Collections:** the page, the items, the stars, and how to add an item. *Done when:* a wrong star number or a missing picture stops the build with a plain message, and the page works at one window size.
- **T1. Travel Map, flat.** *Done when:* every country on your list is coloured, and a misspelt one stops the build.
- **T2. Travel Map, globe**, with the Flat | Globe switch. *Done when:* a drag turns it, and the same countries are coloured as on the flat map.
- **F1. Finish:** the menu, the docs and the test steps; then your test, the wide checks, commit and push.

Not in this round: filters, search, and trip dates or photos on the map.
