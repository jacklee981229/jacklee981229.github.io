# Jack's Space — Jack's Train World rework

Asked in chat on 12 Oct 2026.

## My words

> ok我们有了做little town的经验。
> 接下来，我们也要用大致的方向对train world进行改动。
> plan一下。

## What I checked before planning (12 Oct 2026)

- **Today's Train World**, about 1,900 lines: `src/worlds/trains.js` draws it; `src/lib/trains/layout.js` lays out the
  network, `sim.js` runs the trains, `view.js` follows one; tests in `tests/trains.test.js`. Built 5 Oct 2026 from
  Jack's wish for "the good vibe of a function train network" (the old plan's D75 to D95).
  - A new random network each visit, fitted to the window: a double main line round the card's edge, one way on each
    track, keeping left; six stations (a pickup and a drop-off for each of three cargo colours), each an outpost whose
    branch ends in a loop, so trains never reverse; a stacker depot of 13 sidings; 12 trains.
  - Signals cut the track into blocks; a train books its whole way through a junction before it goes in; the
    longest-waiting train goes next; a train stuck two minutes comes back at the depot.
  - Add train, Remove train and Pause on the card; click a train and the view glides in and follows it; at night,
    headlight cones and glowing signal lamps.
- **What stops it feeling like a world** (screenshots in light and dark): it's a track diagram on a plain card. No
  land, water or trees; nothing is ever built or taken away; no time of day; the main line runs round the card's edge
  like a frame; over a hundred signal dots and the depot's 13 sidings are much of what you see; the theme snaps across
  instead of fading; and its controls differ from the Town's.
- **What the Town's rework did** (`38b75e0`), the direction to follow:
  - Land: one bold ground colour per theme, a river with banks, trees, short crisp shadows; drawn its own way, not a
    copy of the game that inspired it.
  - A new town each day, the same for everyone (Malaysia time); New town makes another.
  - It builds itself on arrival (about 5 s), then changes about every 2 minutes, adding and taking away so it stays
    the same size; what's new pops to catch the eye.
  - A clock with weekdays and busy hours; shadows turn with it, the river flows, cloud shadows drift.
  - Night follows the theme and fades across in 2 s (it stays live through the theme's circle).
  - Controls in one panel on the map: speed, full screen, New town; no Pause, no Add or Remove. A chip with the day,
    the time and the counts.
  - Smooth vehicles that never reverse; thought bubbles; every rule unit-tested over many days.
  - Prototypes first: a still look, then a moving change prototype, before the real build.

---

## The rework (my recommendation)

**What you see**

- A stretch of countryside on a bold green ground (D1), with a river, clusters of trees and soft shadows, in the Town's
  model-like style but its own colours.
- The railway crosses it rather than framing it: a main line comes in at one edge and leaves at another, with branches
  out to the stations and bridges where it crosses the river.
- Stations are plain buildings in bold colours (D2): a pickup with its stock stacked beside the platform, a drop-off
  whose stock you can see run down. Wagons fill with the cargo's colour, as now.
- Track as a little model: a ballast bed with a shadow, sleepers, two rails. The depot is a small stacker yard, one
  siding more than there are trains, not a wall of thirteen.
- Signals stay, with lamps only where lines meet and where trains wait (D3).

**What happens, with nobody playing**

- **A new railway each day**, the same for everyone; New railway makes another, until the page is reloaded.
- **It builds itself on arrival**, in about 5 s: the land and the river, the main line laying itself, stations popping
  up, then trains rolling out of the depot. With reduced motion it's all there at once.
- **It changes, seldom:** about every 2 minutes at normal speed, a station opens (its branch laying itself off the
  main line, the station popping up) or one closes (its last train done, its track taken up with a puff of dust);
  now and then a passing loop is added where the line is busy. The railway stays about the same size and never
  outgrows the card, and no track ever goes from under a train or a train's booked way.
- **A clock** with weekdays and busy hours: drop-offs use their stock faster in the busy hours, so more trains run;
  late at night it's quiet.
- **Trains** run as now: an engine and wagons that follow the curves, speed up and slow down smoothly, keep to their
  signals and never reverse; trains come onto the railway along the line from off the map and leave by it, so the
  world adds and removes its own trains.
- **Live touches**, as the Town's: shadows turn with the clock, the river flows, cloud shadows drift.

**Looks**

- Light theme: day. Dark theme: the same railway at night, the ground deep, windows lit, headlight cones and signal
  lamps glowing (as now). Night sky: as dark, with the aurora on the river. It fades across in 2 s when the theme
  changes. Colours only from `--trains-*` tokens, a day set and a night set.

**The page**

- The top card like the Town's: one line.
- A chip like the Town's: the weekday and time, and the counts ("6 stations · 12 trains", my wording for your OK).
- The Town's panel on the map: speed, full screen, New railway. Add train, Remove train and Pause go.
- Click a train and the view follows it, as now (D4).
- A new picture for its Lab card.

**Out of scope:** the Pond; visitors laying track (it isn't a game); passengers and timetables; sound; keeping a
railway from one visit to the next; roads and cars from the Town crossing the line (a later idea).

## Decisions and tasks

Decided by Jack, 12 Oct 2026 ("all yes. no.4 dont need the bubble. build the prototype"):

- **D1.** The ground is a green countryside, from the site's games green.
- **D2.** The stations are plain buildings in bold colours with coloured cargo, no real industries.
- **D3.** Signal lamps only where lines meet and where trains wait.
- **D4.** Clicking a train follows it, as now; no bubble.
- **D5.** Prototype first: T1 and T2 before the real build.

Decided by Jack on look v2, 12 Oct 2026 ("ok,可以照这样子做。比例要调整，肯定不能满地图全部component这么大。那个traffic light我要的还是一粒灯。我只是要你改善一粒灯的UI。不是要写实，而是要好看。然后不用做出ore.. The roundabout ... -> no. make it just a component of the rail network. sand ground is ok. can start T2 based on my saying."):

- **D6.** The look is v2's (`look2.html`), on the sand ground; this replaces D1's green, and there's no river or trees.
- **D7.** Everything smaller: the pieces at about two thirds of v2's size, so the land shows between them.
- **D8.** A signal is one lamp, drawn to look good, not like a real signal.
- **D9.** No ore fields.
- **D10.** The roundabout is one part of the network, not its centrepiece.

Decided by Jack on the T2 prototype, 12 Oct 2026 (each also on his to-do list):

- **D11.** "我希望这个part不要有角度，而是curve。这样火车行驶比较自然。" Where an arm joins the roundabout, the
  track curves in smoothly, with no corner, so trains run on naturally.
- **D12.** "我觉得东西太大，应该要zoom out至少两倍，所以地图会更大，东西更多。" Zoomed out at least twice as far: a
  bigger map with more on it.
- **D13.** "更多intersection，更多火车，更多不一样的路线。" More junctions, more trains, more different routes.
- **D14.** "速度更快，要有速度感。" Faster trains, with a feeling of speed.

What I'll do unless Jack says otherwise:

- The Town's direction throughout: a railway a day, a change about every 2 minutes with a pop, the build on arrival,
  the clock, the panel, the live touches, the night fade (`options.fades`).
- Keep what works: blocks and look-ahead signals, turnaround loops (no reversing), the stacker depot (smaller), the
  dispatcher, smooth starts and stops, headlights.
- What the Town already has and the trains need too (the day's seed, the panel, the chip, the river, trees, clouds and
  the pop) is shared from one place, not copied; the Town looks and runs exactly as now.
- Lanes on the left. Canvas 2D, no packages. No trademarked names in code, comments or the changelog.
- The logic is unit-tested: the same seed lays the same railway; every station can be reached after every change;
  no train stuck over 24 railway hours, the railway changing; no two trains ever touch; it never outgrows the card;
  no track taken from under a train.

Tasks:

- **T1. Look prototype** (about 30 min): one still railway in the new look, from a small hand-made map at the card's
  size, in light and dark, two takes on the ground. *Check:* screenshots; Jack picks. Built 12 Oct 2026:
  `scratch/prototypes/trains/look.html` (`?take=a` bright meadow green or `b` deep green, `&theme=light` or `dark`):
  a double main line across the land from edge to edge over a steel bridge, six outposts (each a plain building in
  its cargo's colour, crates at a pickup, a stock gauge on a drop-off's roof), a four-siding depot under a shed, fields,
  trees, the river, short shadows, a cloud's shadow; lamps only at each outpost's way in, way out and waiting place.
  Jack, on it (12 Oct 2026, with Factorio screenshots: a rail roundabout, a station loop, a stacker): "let's try ground
  color. and, i dont want same element like rivers, trees. redesign on the buildings, maybe like a warehouse. image 2
  this still ok. traffic light looks not cool. too cheap. this round rail is weird in shape. can get some idea from
  factorio screenshots. rework." (image 2: the depot under its shed.) So `look2.html` (`?take=a` sand, `b` red
  earth, `c` olive): no river or trees but mottled earth, tufts and pebbles, and behind each pickup a field of stones in
  its cargo's colour (my addition); warehouses with corrugated gable roofs and a loading dock; signal heads (a dark
  housing, three lamps, one lit) on a concrete footing; stations as an even U of track, one radius throughout, the
  warehouse inside it; a rail roundabout where the west, east and north lines meet, its south arm to the depot (kept).
- **T2. Change prototype** (about 45 min): a quick moving page (not in the site) where the day's railway builds itself
  and then changes, fast-forwarded: a station opening with its branch, one closing, a passing loop; trains as simple
  blocks. *Check:* Jack watches it run and says how often changes should come. Built 12 Oct 2026:
  `scratch/prototypes/trains/change.html` (`?day=YYYY-MM-DD` another day's railway, `?theme=dark`, `?every=N` seconds
  between changes at 1×, 30 by default; buttons 1×, 5×, 20× and New railway), in look v2 at two thirds of its size
  (D7), on the sand (D6): the main line and the roundabout lay themselves, then each station (its U laid, its
  warehouse popping with a flash and a burst); trains come in from the west, east and north, call at a pickup and a
  drop-off of their colour (wagons filling and emptying as they stand), and leave by another edge; a change opens a
  station or closes one (its last train gone, the warehouse folding in a puff of dust, its track taken up), between 5
  and 8 open; one glossy lamp per signal (D8), red while a train waits. Rules found while testing: on the roundabout
  trains follow each other and one comes on only into a gap, checked until it's past the stop line; a train pulling
  out of a station waits for 9 cells of clear main line behind, then a main-line train gives way if it can stop well
  clear, else the one pulling out holds short until it has passed. Soaked: 12 railways for 10 to 20 minutes each at
  20×: no two trains closer than 0.48 cells (car middles), no train standing still over 4 s outside a platform.
- **T3. The railway's model** in `src/lib/trains/`: the land, the network on it, its growth and renewal. *Check:*
  tests (the same seed the same railway; always connected; bounded).
- **T4. Trains on a changing railway:** dispatch, signals, the depot, trains coming and going off the map, busy hours,
  nothing removed under a train. *Check:* tests (24 railway hours over many days with changes: nobody stuck, no
  overlaps, every load delivered); frame time.
- **T5. Drawing:** the new look; what stays still drawn once and redrawn only when something changes; the pop; the live
  touches; the night fade. *Check:* screenshots in each theme and on a phone; frame time on Jack's laptop.
- **T6. The page:** the top card, the chip, the panel, clicking a train, the Lab card's picture; keyboard and touch;
  reduced motion; phone. *Check:* every control by keyboard and touch.
- **T7.** After Jack confirms: the sweep, a changelog line (my wording for his OK), one commit.
