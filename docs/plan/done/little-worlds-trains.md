# Jack's Space — Little Worlds: Jack's Train World

A train network that runs by itself, for visitors to watch. The second Little World, beside
[Jack's Town](little-worlds-town.md).

## The idea

I remember the good old days of a factory-building game I played: once we had built a fully working train network,
it was fascinating to watch it running and running. We don't want a factory game here, just the good vibe of a
working train network.

Like the Town, it isn't an animation but a running program: every train, signal and station decides for itself, so it
never loops. No game is named anywhere in the repo, and nothing copies a game's look.

## What makes a train network good to watch

Gathered on 5 Oct 2026 from that game's wiki, forums and player discussions, and from calm train games and toys on
the web. (Reddit couldn't be read with my tools.)

1. **Signals that think ahead.** The track is cut into blocks, one train per block. A train books its way before it
   gets there, so the lamps ahead of it turn amber before it arrives, red as it passes, and green again behind it.
2. **Junctions that never stop.** Trains thread through a junction one after another, timed by the signals, and never
   wait in the middle. The rule players swear by: a look-ahead signal before and inside a junction lets a train in only
   if it can also get out.
3. **Queues that clear.** Trains wait their turn in a waiting bay beside a busy station, then peel off one at a time.
4. **Work you can see.** Wagons fill with colour at a pickup and empty at a drop-off. Every trip has a reason.
5. **Trains that feel heavy.** Long trains snake through curves, slow down well before a red, and pull away gently.
6. **The map view.** Players love watching their trains zip around the game's map: simple shapes on thin lines. A
   flat, top-down look like the Town's is that view.
7. **A network that adapts.** With a well-loved add-on, nobody gives trains fixed routes: stations ask for what they
   need, and the nearest free train in the depot goes. The yard empties and fills with demand, so it's never the same
   twice.

## Idea bank

Pick by number. ★ marks my recommended first version.

**The network**

- I1 ★ Double track, one way on each (trains keep left, like the Town's cars), so trains never meet head-on.
- I2 ★ A main line round the screen with branches to the stations and a depot yard, made to fit the window: a new
  network each visit.
- I3 ★ A turnaround loop at the end of each branch, so trains never reverse.
- I4 ★ Junctions guarded by look-ahead signals.
- I5 A flyover where two lines cross: one on a bridge, with its shadow on the line below.
- I6 A rail grid of square blocks, the layout big bases use: very busy junctions, but it looks like the Town's grid.
- I7 A single-track country branch with passing loops, where one train waits in the loop for the other to pass.

**Trains and their work**

- I8 ★ Cargo in three colours: pickups and drop-offs of matching colours, like the Town's homes and places.
- I9 ★ A dispatcher: a drop-off asks for cargo when its stock runs low; the nearest free train leaves the depot, loads
  at a pickup of that colour, delivers, and goes back to the depot.
- I10 Fixed routes instead: each train runs its own pickup-to-drop-off loop for ever. A steadier rhythm.
- I11 ★ Waiting bays before busy stations, and a limit on how many trains head to each.
- I12 Trains of different lengths, the longest with an engine at each end.
- I13 Passenger trains on a timetable, stopping at platforms between the freight trains.

**Looks**

- I14 ★ Flat and top-down like the Town: rails with faint sleepers, an engine and its wagons, signal lamps beside the
  track, in the site's theme colours.
- I15 A plainer map look: thin lines, trains as coloured bars. Fits a bigger network.
- I16 The path a train has booked glows faintly ahead of it, so you can see its plan.
- I17 Night in the dark theme: headlights reaching ahead, lamps glowing (like the Town's night).
- I18 A quiet landscape behind: water with bridges, trees, fields.

**Life over time**

- I19 Busy and quiet spells: demand rises and falls, so the yard empties and fills.
- I20 The network grows: every few minutes a new branch is laid piece by piece until the window is full, then a fresh
  network starts.
- I21 A small counter: deliveries today.

**Visitor touches**

- I22 Hover over a train to see its number and job ("No. 7, timber, forest to mill").
- I23 Follow a train.
- I24 Tap a signal to hold it at red, and watch the network work around it.
- I25 Soft rail sounds, off until switched on.
- I26 A level crossing with Jack's Town: cars wait at the barriers while a train goes by.

## What I picked

- **Network:** a main line round the screen, with branches to the stations and a depot (I1 to I4).
- **Trains:** a dispatcher sends them where cargo is needed (I8, I9, I11).
- **Look:** a train set seen from above, like the Town (I14).
- **Extras for later:** night lights (I17).

## Not in this plan

- Building track yourself, money, factories and production chains.
- Anything taken from the factory game's look: its colours, its pictures, its map.
- The rest of the idea bank, for now.

---

## Decisions and tasks

Your plan of 5 Oct 2026, above. One task at a time, as before.

- **D75. Jack's Train World is the second Little World**, at `/lab/world/trains/`, laid out like the Town's page: the Lab header, the network, then "Check these too!". Its card goes in the Little Worlds section that the Town's W2 adds to the Lab home.
- **D76. The network** (I1 to I4): a double-track main line round the window, one way on each track, trains keeping left; a branch to each station, ending in a turnaround loop so trains never reverse; and a depot yard. Look-ahead signals stand before and inside every junction, plain signals at its exits. It's laid out from a few set pieces (straights, curves and switches), like a toy train set, so every join is smooth. It's made to fit the window, a new one each visit; a phone gets fewer stations.
- **D77. The work** (I8, I9, I11): cargo in three colours, the topic colours as in the Town, with a pickup and a drop-off of each colour. A drop-off's stock runs down, and when it's low the dispatcher sends the nearest free train from the depot: empty to a pickup of that colour, load, deliver, and back to the depot. Only so many trains may head to one station at once; the busy ones get a waiting bay.
- **D78. The look** (I14): flat and top-down like the Town, in the site's theme colours. Rails with faint sleepers; an engine and wagons that follow the curves; wagons that fill with their cargo's colour while loading and empty while unloading; signal lamps beside the track, green, amber (booked) or red (taken). Trains speed up and brake gently and slow down well before a red. No game is named anywhere in the repo, and nothing copies a game's look.
- **D79. A running program, like the Town.** The rules are in `src/lib/trains/`, run in fixed, seeded steps, so the tests can replay a network exactly. Canvas, written from scratch, no packages. `src/worlds/trains.js` draws it on the Effects' stage, which brings Pause and Play, the still picture under reduced motion and rest while off screen; its script loads only on its own page.
- **D80. It never jams for good:** one-way tracks, look-ahead signals, turnaround loops, the limit per station, the waiting bays and more room in the depot than there are trains. If a train still waits over two minutes, it fades out and comes back at the depot; the tests prove that never happens.

- **D81. Simpler outposts and a stacker depot** (your look at the first network, 5 Oct 2026; this changes D76). Every station is an outpost: a branch ending in a loop, in one of four shapes: a plain loop (trains wait on the straight going up, go round, and stop at the platform coming down, the yard between the two); a round head (trains wait on the stem going in, round the head, and stop on the stem coming back, the yard beside it); a leaning loop (the plain one on a bend, leaning over an empty place beside it); and a loop with two platforms side by side, for one pickup where nothing stands across from it. The depot is a stacker, like your picture: parallel sidings curving off one track and back onto another, one more than there are trains; it replaces the fanned loops. Cargo stays in three colours.
- **D82. Booking and dispatch, as built.** A train books the block ahead once it's within braking distance of it, so lamps turn amber before it arrives, red under it, and green again behind it. At a look-ahead signal it books the way through the junction and on until there's room for the whole train beyond it (through the next junction too, if the track between is too short), or nothing at all, so no train ever stops in a junction; this is what the "inside" signals of D76 do. A drop-off uses a full stock in 200 seconds (at 80 they stood empty half the time; at 200, under 2%) and asks for a load when it's below 45%; one load brings 55%. The dispatcher sends the parked train nearest the pickup of that colour; at most two trains head for one station, the second waiting on the straight before the platform (or using the second platform). A train loads and unloads in 5 seconds, its wagons filling and emptying one after another. Four trains on a three-colour network, three on a phone's.
- **D83. Upright stations, faster trains** (your look at the trains, 5 Oct 2026; this changes D81 and D82). No leaning loops: every station stands straight up from the main line, as a plain loop, a round head or (one pickup) a loop with two platforms. Trains go three times as fast: 210 pixels a second on the main line, and at that speed straight on through its junctions too, so they don't slow down at every station they pass; 138 turning off the main line or onto it, 156 on the branches. They pick up speed for about three seconds after they start and slow down for about two before they stop, so you can see both. To keep the faster trains as busy as before (out of the depot three quarters of the time), a drop-off uses a full stock in 80 seconds again; they stand empty under 3% of the time.
- **D84. Two trains for each colour** (your word, 5 Oct 2026; this changes D82 and D83): six trains on a three-colour network, four on a phone's, with a siding more than there are trains. A drop-off asks for another load whenever one more would fit on top of its stock and the loads already on their way, up to two at once, so a busy colour has two trains working for it; each load brings 35% of a full stock (55% left no room for a second one). Trains are out of the depot about four fifths of the time, and drop-offs are hardly ever empty.
- **D85. Follow a train** (I23, your word of 5 Oct 2026). Click or tap a train and the view glides in (in 0.8 seconds) until the whole train fills half the stage's shorter side, then keeps the middle of the train in the middle of the stage as it goes, the network sliding past; near the network's edge the page's colour shows beyond it. Click another train to glide over to it; click anywhere else, or press Esc, to glide back out to the whole network. Over a train the pointer is a hand, and the line under the title says "Click a train to follow it, and anywhere else to stop." Zoomed in, the network is drawn afresh each frame, only what's in view, so the rails and trains stay sharp.

- **D94. Twice the trains** (your word, 5 Oct 2026; this changes D84): four trains a colour, so twelve (eight on a phone), and thirteen sidings. A colour has up to four at work: two at or on their way to its pickup, and two on their way to its drop-off with a load; a loaded train waits at the pickup's platform while two are already on their way to its drop-off. Each load is a fifth of a full stock, so four can be on their way at once.
- **D95. The longest-waiting train goes next** (found while testing D94). Where stations stand close together, a train leaving one has to book its way across up to three junctions at once; with twelve trains those were rarely all free together, and a train could wait two minutes and be taken off (D80). Now the train that has waited longest at a look-ahead signal (over 8 seconds) goes next: no other train may book a junction way on its stretch, or one crossing it, unless it's already standing on that stretch and can clear it. Also fixed: a train put back in the depot after a long wait only goes into a siding nobody is in or pulling out of; before, it could be put on top of a train just leaving (an old flaw that only showed once a train was taken off).
- **D97. A line out, Add train and Remove train** (your word, 5 Oct 2026). A branch leaves the main line at a free place, as far from the depot as can be, and runs straight out of the picture: one track out, one back in, each long enough to hide a whole train. Two buttons beside Pause. Add train brings one more train in along the line, out of sight, to a free siding; it then works like the rest. Remove train sends a train with no work (parked, or empty on its way back to the depot), picked at random, out along the line and off the railway. The depot has a spare siding for each colour, so Add train can bring up to three more (two on a phone); each button greys out while it can't. With the depot full (fifteen trains) the longest wait in the soaks was a minute, but none got stuck.
- **D99. Night lights** (TR4, at your word of 5 Oct 2026). In the dark theme, and the night sky, every running train's headlight throws a soft cone of warm light (between the page's ink and the lamps' amber) from the front of its engine along the way it faces, fading out about three wagons ahead; a train parked in the depot has its lights off. Every signal lamp glows round it in its own colour. The light is added to what's under it, so the track ahead brightens; it goes under the trains and the lamps. The light theme stays as it is.
- **D100. A drop-off's bar fills as the train unloads** (your word, 5 Oct 2026). The stock rises bit by bit while the wagons empty, over the five seconds of unloading, instead of jumping a fifth of the bar at the end.

Tasks:

- **TR1. The network, still**: the layout that fits the window, drawn without trains, on a hidden page (`noindex`, not on the Lab home). *Done when:* unit tests show that at window sizes from a phone's to 1920 px every station can be reached from the depot and back, every join is smooth (no gap or sharp kink), every junction has its signals, and the network stays inside the window; and you've looked at it at 1280 px.
  *Built 5 Oct 2026, together with TR2 at your word:* `src/lib/trains/layout.js` (the network), `src/lib/trains/sim.js` (the trains), both tested by `tests/trains.test.js`; `src/worlds/trains.js` draws them, at `/lab/world/trains/` with `noindex` (its own page, `src/pages/lab/world/trains.astro`, outside `WORLDS` until TR3). Layout tests, at eleven window sizes from 320 by 288 to 1920 by 1000, two networks each: a pickup and a drop-off per colour (two colours on a phone); all three station shapes turn up; every station reachable from every siding and back; no gap or kink at any join and no bend tighter than a station's loop; a look-ahead signal at every way into a junction and a plain one at every way out; everything inside the window; no two tracks' sleepers overlapping except through a junction (also checked by hand on 330 networks).
- **TR2. Trains run**: the signals and booking, trains following their routes, loading and unloading, the depot and the dispatcher. *Done when:* unit tests run 24 simulated hours on several seeds and window sizes with no two trains in one block, none passing a red, every delivery finished, no stock below zero and no train faded out; it runs smoothly at 1280 px; and you've watched it.
  *Built 5 Oct 2026, with TR1:* tests run a simulated day on five networks (1265 by 652, a phone, 1920 by 1000, 768 by 600, and a very short 1280 by 288): no block or junction way under two trains, no train anywhere it hadn't booked, no two trains touching, none waiting near two minutes or taken off, no stock below zero, every load delivered but those on board at the end, and no train jumping between two steps.
- **TR3. Goes live**: the card in Little Worlds on the Lab home, its cover, its hint line, the palette and Random, the sitemap, its share picture and a changelog line. The wide checks after your OK.
  *Built 5 Oct 2026, at your word:* in `WORLDS` (`src/lib/lab/tools.js`) with its description, its hint ("Click a train to follow it, and anywhere else to stop."), a train icon (new in `src/lib/icons.js`; each world now names its own icon and the palette's extra words, where both were the town's before) and its picture `src/assets/worlds/trains.png`. So it has its card in Little Worlds, its page at `/lab/world/trains/` from `[slug].astro` (the hidden page is gone), a place in the palette, Random and the sitemap, and its picture as its link preview; and a changelog line. The stage's Fullscreen now says "Show this world on the whole screen" (it said "the town" on every world).
- **TR4. Night** (I17): in the dark theme, headlights reaching ahead and the lamps glowing.
  *Built 5 Oct 2026 (D99; D100 came with it):* `src/worlds/trains.js` draws the beams and the glow (each lamp colour's glow is one small picture, laid round every lamp of that colour), only while the page's colour is dark. A frame takes about half a millisecond longer at night (0.8 against 0.3 on the test page). Checked in the Lab's dark theme, the night sky and the light theme, zoomed out and following a train.
- **TR5. Follow a train** (D85). *Done when:* unit tests show that a followed train is always wholly in view and that a click on any of its cars picks it; it glides in, follows and glides back out smoothly at 1280 px and on a phone; and you've tried it.
  *Built 5 Oct 2026:* `src/lib/trains/view.js` (the view on a train, and which train a click picks), tested by `tests/trains.test.js` on three networks for an hour each; `src/worlds/trains.js` zooms in and follows.
- **TR6. Twice the trains** (D94, D95). *Done when:* twelve trains (eight on a phone) run with no train taken off in the tests' simulated days, and you've watched it.
  *Built 5 Oct 2026:* `src/lib/trains/layout.js` (four trains a colour, a siding more), `src/lib/trains/sim.js` (four at work a colour, the longest-waiting train first, the depot fix). Soaks, 12 hours each, ten networks at each of nine window sizes: none jammed, the longest wait 34 seconds; trains out of the depot 68 to 93% of the time.
- **TR7. Add train and Remove train** (D97). *Done when:* tests show the line out leaves the picture and reaches every siding, trains come on and leave only out of sight, and a full railway runs for hours with no shared block, no touching and nobody stuck; and you've tried it.
  *Built 5 Oct 2026:* `src/lib/trains/layout.js` (the line out, the spare sidings), `src/lib/trains/sim.js` (trains joining and leaving; `send` can now start partway across a junction), `src/worlds/trains.js` (the buttons; it stops following a train that has left), the buttons from `controls` in `WORLDS`. Tests: the line out, and six hours of trains joining and leaving at two window sizes. Soaks, 12 hours each with the depot full and trains joining and leaving, ten networks at each of nine window sizes: none jammed; the longest wait 63 seconds.
