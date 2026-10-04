# Jack's Space — Little Worlds: Jack's Town

An endless traffic town that a visitor can just stare at. Cars, roads, junctions, traffic lights and the other usual
parts, running by themselves forever.

It isn't a canned animation, it's a running program: like a game that a bot plays by itself, without being a game.
Every car decides each moment for itself (keep a gap, brake for red, turn, give way), and every junction's light
changes, so the town never loops.

Gathered in chat on 4–5 Oct 2026; the decisions and tasks are below.

## What I picked

- **Where:** a new Lab section, **Little Worlds** (things that run by themselves). The first one is **Jack's Town**.
- **Look:** top-down and flat.
- **Endless:** one town that fits the window; it's endless because the trips never stop.
- **Reference:** the calm, minimal road-building games: their flat, soft look, and homes and places in matching
  colours, so every car drives somewhere for a reason. Refer to them, don't copy them: build our own version that
  matches the website. Don't name those games anywhere in the repo.
- **Extras for later**, each its own task: night headlights in the dark theme; smart lights and rush hour.

## Not in this plan

- A town that grows and a bot that lays new roads (kept as an idea).
- Buses, people crossing, roundabouts.
- Visitor touches: following a car, tapping a light, live counters.

---

## Decisions and tasks

Your plan of 5 Oct 2026, above: an endless traffic town that runs by itself, for visitors to stare at. One task at a time, as before.

- **D58. A new Lab section, "Little Worlds"**, for things that run by themselves. The first is **Jack's Town** at `/lab/world/town/`, laid out like an Effects page: the Lab header, the town, then "Check these too!".
- **D59. Top-down and flat, one town that fits the window**, endless because the trips never stop. The calm road-building games are a reference only; the look is our own: the site's theme colours, the topic colours for homes, places and cars, soft rounded roads. No game is named anywhere in the repo.
- **D60. Every trip has a reason:** homes and places come in matching colours (three colours); a car leaves its home, drives to a place of its colour, waits a moment, and drives home.
- **D61. A real simulation, not an animation.** The roads, lights and driving rules are in `src/lib/town/`, run in fixed, seeded steps, so the tests can replay a town exactly. Canvas, written from scratch, no packages. Cars drive on the left; the lights run on a timer for now.
- **D62. It never jams for good:** a car enters a junction only when there's room beyond it, and a car stuck for over a minute fades out (a new trip starts later).
- **D63. The Effects' manners:** theme colours, Pause and Play, a still picture under reduced motion, no work while off screen, and its script loads only on its own page. The Effects stage (`src/effects/stage.js`) is reused if it fits; if it doesn't, I report before building another.

Tasks:

- **W1. The town runs**, on a hidden page (`noindex`, not on the Lab home). *Done when:* unit tests run 24 simulated hours on several seeds with no car stuck over a minute, no two cars overlapping, no red light run and every trip finished; it runs smoothly at 1280 px; and you've watched it.
  *Built 5 Oct 2026, then redone the same day after you found it unsatisfying (cars appeared and vanished at the buildings):* the map is `src/lib/town/layout.js`, the traffic `src/lib/town/sim.js` (both tested by `tests/town.test.js`), the drawing `src/worlds/town.js` on the Effects' own stage (it fitted, so no new stage), at `/lab/world/town/` with `noindex`. Every car now lives parked nose in on its home's drive. It backs out onto the lane when there's a gap (white lights on), drives off, signals, turns into a free bay at a place of its colour (three bays a place, picked before it sets off) and parks; later it backs out and goes home the same way. Houses have a pitched roof and a drive, places a car park; the ground has kerbs; lights are coloured stop lines; cars brake gently and show brake lights and indicators. *Then, at your word:* no trees; four colours (Git's orange added), so eight places; and one to three roads out of town (by its size), each from a junction on the edge straight out past the picture. Visitors come in along them, park at a place of their colour and drive out again; now and then a resident drives out of town and comes back a while later. So the number of cars in town keeps changing (22 to 33 in a day in an 8 by 4 town of 22 homes), and cars only ever appear or vanish a block or more beyond the town's edge, out of sight. Tests: four towns each run a simulated day (none stuck, the longest stop under 50 seconds; the longest wait to back out 40; none crossing on red; no two cars' bodies ever overlapping; visitors coming and going; every trip finished), and three hours on each check that no car ever jumps or swings between two steps, and none appears or vanishes in sight. The lights' colours are new tokens (`--signal-go`, `--signal-wait`, `--signal-stop`) made from colours the site already has.
- **W2. Goes live** *(done 5 Oct 2026: `WORLDS` in tools.js, the Little Worlds section after Effects on the Lab home with its jump link, the card with a picture of the town in the Lab's green (also its link preview), a car icon, the palette, Random, Most Popular, the sitemap, the share label "Lab · Little World", and a changelog line):* the Little Worlds section and the town's card on the Lab home, its cover, its hint line, the palette and Random, the sitemap, its share picture and a changelog line. The wide checks after your OK.
- **W3. Night:** in the dark theme, headlights, glowing lights and lit windows.
- **W4. Smart lights and rush hour:** traffic builds and thins, and the lights give more green to the busier road.
