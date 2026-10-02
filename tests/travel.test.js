import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { geoNaturalEarth1, geoOrthographic } from 'd3-geo';
import { HEIGHT, WIDTH, colourSteps, flatMap, flatProjection, inView, middles, namesIn, openingOut } from '../src/lib/travel/map.js';
import { ALSO, placesFor } from '../src/lib/travel/places.js';

const load = createRequire(import.meta.url);
const world = load('world-atlas/countries-110m.json');
const fine = load('world-atlas/countries-50m.json');
const drawn = namesIn(world);
const known = namesIn(fine);
const places = (visited) => placesFor(visited, drawn, known);

test('the finer file knows every country the map draws, each under one name', () => {
  assert.ok(drawn.length > 150 && known.length > drawn.length);
  assert.deepEqual(drawn.filter((name) => !known.includes(name)), []);
  assert.equal(new Set(known).size, known.length);
});

test('the places come back in the order listed; one too small for the map is known but not drawn', () => {
  assert.deepEqual(places(['Malaysia', 'Singapore', 'Japan', 'Hong Kong']), [
    { said: 'Malaysia', name: 'Malaysia', drawn: true },
    { said: 'Singapore', name: 'Singapore', drawn: false },
    { said: 'Japan', name: 'Japan', drawn: true },
    { said: 'Hong Kong', name: 'Hong Kong', drawn: false },
  ]);
  assert.deepEqual(places([]), []);
});

test("capital letters, accents and spaces around a name don't matter, and it shows as it was written", () => {
  assert.deepEqual(places(['malaysia', ' JAPAN ', "Cote d'Ivoire", 'curacao']), [
    { said: 'malaysia', name: 'Malaysia', drawn: true },
    { said: ' JAPAN ', name: 'Japan', drawn: true },
    { said: "Cote d'Ivoire", name: "Côte d'Ivoire", drawn: true },
    { said: 'curacao', name: 'Curaçao', drawn: false },
  ]);
});

test('everyday names are understood', () => {
  const said = ['USA', 'UK', 'Korea', 'Czech Republic', 'Macau', 'Türkiye', 'Dominican Republic'];
  const names = ['United States of America', 'United Kingdom', 'South Korea', 'Czechia', 'Macao', 'Turkey', 'Dominican Rep.'];
  assert.deepEqual(places(said).map((place) => place.name), names);
});

test('every everyday name leads to a name the map knows, and is written the way names are compared', () => {
  for (const [everyday, name] of Object.entries(ALSO)) {
    assert.ok(known.includes(name), `${everyday} -> ${name}`);
    assert.equal(everyday, everyday.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim(), everyday);
    // An everyday name that is also a map name would never be reached.
    assert.ok(!known.some((k) => k.toLowerCase() === everyday), everyday);
  }
});

test('a name the map does not know is a plain message with the nearest names', () => {
  assert.throws(() => places(['Malaysia', 'Malaysa']), /Travel Map: "Malaysa" isn't a place the map knows\. Did you mean Malaysia\? Fix it in src\/content\/travel\/visited\.yaml\./);
  assert.throws(() => places(['Indo']), /Did you mean Indonesia or India\?|Did you mean India or Indonesia\?/);
  assert.throws(() => places(['Atlantis']), /"Atlantis" isn't a place the map knows\. Fix it in/);
});

test('a place listed twice is a plain message, even under two names', () => {
  assert.throws(() => places(['Japan', 'japan']), /Japan is listed twice \("Japan" and "japan"\)/);
  assert.throws(() => places(['USA', 'United States']), /United States of America is listed twice \("USA" and "United States"\)/);
});

test("a place's middle is where it is on the earth", () => {
  const [[lon, lat]] = middles(fine, ['Singapore']);
  assert.ok(Math.abs(lon - 103.8) < 0.3 && Math.abs(lat - 1.35) < 0.3, `${lon}, ${lat}`);
});

test('the colours run from home to the farthest place, in order of distance, evenly spread', () => {
  // Jack's own list: home, then nearer and farther places in no particular order.
  const names = ['Malaysia', 'Singapore', 'Thailand', 'China', 'Taiwan'];
  const steps = colourSteps(middles(fine, names));
  assert.deepEqual(steps, [0, 0.25, 0.5, 1, 0.75]);
  // Home stays at the start wherever the others are.
  assert.deepEqual(colourSteps(middles(fine, ['Japan', 'Australia', 'South Korea'])), [0, 1, 0.5]);
});

test('one place, or none, needs no spread of colours', () => {
  assert.deepEqual(colourSteps([[101, 4]]), [0]);
  assert.deepEqual(colourSteps([]), []);
  // Two places at the very same spot: home still comes first, and the steps are still all different.
  assert.deepEqual(colourSteps([[101, 4], [101, 4], [120, 20]]), [0, 0.5, 1]);
});

test('the flat map has the world, its lines and a shape for each visited country it can draw', () => {
  const map = flatMap(world, places(['Malaysia', 'Singapore', 'Japan']));
  for (const d of [map.outline, map.grid, map.lines]) assert.match(d, /^M[\d.,-]+[LZ]/);
  assert.deepEqual(map.shapes.map((shape) => [shape.said, shape.name]), [['Malaysia', 'Malaysia'], ['Japan', 'Japan']]);
  for (const shape of map.shapes) assert.match(shape.d, /^M[\d.]+,[\d.]+L/);
  // Kept to one decimal place, so the page stays small.
  assert.ok(!/\.\d{2}/.test(map.lines));
});

test('each country on the flat map comes with the box it fills and its middle', () => {
  const [malaysia, japan] = flatMap(world, places(['Malaysia', 'Japan'])).shapes;
  for (const shape of [malaysia, japan]) {
    const [left, top, right, bottom] = shape.box;
    assert.ok(left >= 0 && top >= 0 && right <= WIDTH && bottom <= HEIGHT && left < right && top < bottom, `${shape.name} ${shape.box}`);
    // Every point of the shape is inside its box.
    const numbers = shape.d.match(/[\d.]+/g).map(Number);
    for (let i = 0; i < numbers.length; i += 2) assert.ok(numbers[i] >= left - 0.1 && numbers[i] <= right + 0.1 && numbers[i + 1] >= top - 0.1 && numbers[i + 1] <= bottom + 0.1, `${shape.name} ${numbers[i]},${numbers[i + 1]}`);
    assert.ok(shape.middle[0] > left && shape.middle[0] < right && shape.middle[1] > top && shape.middle[1] < bottom, `${shape.name} ${shape.middle}`);
  }
  // Japan is north-east of Malaysia: further right and higher up the map.
  assert.ok(japan.middle[0] > malaysia.middle[0] && japan.middle[1] < malaysia.middle[1]);
});

test('every part of the flat map stays inside its frame', () => {
  const map = flatMap(world, places(['Russia', 'New Zealand', 'Chile', 'Fiji']));
  for (const d of [map.outline, map.lines, ...map.shapes.map((shape) => shape.d)]) {
    const numbers = d.match(/-?[\d.]+/g).map(Number);
    for (let i = 0; i < numbers.length; i += 2) {
      assert.ok(numbers[i] >= 0 && numbers[i] <= WIDTH, `x ${numbers[i]}`);
      assert.ok(numbers[i + 1] >= 0 && numbers[i + 1] <= HEIGHT, `y ${numbers[i + 1]}`);
    }
  }
});

/** The globe part-way open, laid out plainly: no turn, no shift, one unit to the radian. */
const partOpen = (flatness) => openingOut(flatness).scale(1).translate([0, 0]).rotate([0, 0]);
const near = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

test('opening out starts as the globe, ends as the flat map, and half-way is half-way between', () => {
  const globe = geoOrthographic().scale(1).translate([0, 0]);
  const flat = geoNaturalEarth1().scale(1).translate([0, 0]);
  for (const spot of [[101, 4], [0, 0], [-60, 45], [80, -30], [30, 80]]) {
    assert.ok(near(partOpen(0)(spot), globe(spot)), `globe ${spot}`);
    assert.ok(near(partOpen(1)(spot), flat(spot)), `flat ${spot}`);
    const half = partOpen(0.5)(spot);
    assert.ok(near(half, [(globe(spot)[0] + flat(spot)[0]) / 2, (globe(spot)[1] + flat(spot)[1]) / 2]), `half ${spot}`);
  }
  // Opened out, it is the page's own flat map: the same fit puts a point in the same place.
  const fit = flatProjection();
  assert.ok(near(openingOut(1).scale(fit.scale()).translate(fit.translate()).rotate([0, 0])([101, 4]), fit([101, 4])));
});

test('more of the earth comes into view as the globe opens out: half of it at first, all of it well before flat', () => {
  assert.equal(inView(0), Math.PI / 2);
  assert.equal(inView(1), Math.PI);
  let last = 0;
  let all = 1;
  for (let step = 0; step <= 100; step++) {
    const reach = inView(step / 100);
    assert.ok(reach >= last, `${step}`);
    if (reach === Math.PI) all = Math.min(all, step / 100);
    last = reach;
  }
  assert.ok(all > 0.5 && all < 0.8, `${all}`);
});

test('nothing in view folds back over itself while the globe opens out', () => {
  // Along any line of latitude, going east must always move a point to the right, wherever it is in view.
  const degrees = Math.PI / 180;
  for (const flatness of [0.05, 0.2, 0.35, 0.5, 0.6, 0.65, 0.7, 0.85]) {
    const layout = partOpen(flatness);
    const reach = inView(flatness);
    for (const lat of [-85, -60, -30, 0, 30, 60, 85]) {
      let before = -Infinity;
      for (let lon = -179; lon <= 179; lon += 2) {
        if (Math.acos(Math.cos(lat * degrees) * Math.cos(lon * degrees)) >= reach) continue;
        const [x] = layout([lon, lat]);
        assert.ok(x > before, `flatness ${flatness}, ${lat} north, ${lon} east`);
        before = x;
      }
    }
  }
});
