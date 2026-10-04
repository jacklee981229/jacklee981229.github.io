// The Travel Map's drawing, worked out while the site is built: the flat map as lines an SVG can draw, and which
// colour each visited place gets. The country shapes are Natural Earth's (the world-atlas package): `world` is its
// coarse file, which the map draws, and `fine` its finer one, which also knows the places too small to draw.
// Also how the globe opens out into the flat map. Tested by tests/travel.test.js.
import { geoCentroid, geoDistance, geoGraticule10, geoNaturalEarth1, geoNaturalEarth1Raw, geoOrthographic, geoOrthographicRaw, geoPath, geoProjectionMutator } from 'd3-geo';
import { feature, mesh } from 'topojson-client';

/** The flat map's own size, in the SVG's units. */
export const WIDTH = 1000;
export const HEIGHT = 520;

/** The names a file of country shapes has. */
export const namesIn = (atlas) => atlas.objects.countries.geometries.map((g) => g.properties.name);

/**
 * The middle of each of these places, as [longitude, latitude].
 * @param {string[]} names the map's own names @returns {[number, number][]}
 */
export function middles(fine, names) {
  const all = feature(fine, fine.objects.countries).features;
  return names.map((name) => geoCentroid(all.find((f) => f.properties.name === name)));
}

/**
 * How far along the colours each place sits, from 0 to 1. The first place is home, at 0; the others follow in
 * order of their distance from it, spread evenly, the farthest at 1. So places near each other get colours near
 * each other, and no two share one.
 * @param {[number, number][]} spots each place's middle, home first @returns {number[]}
 */
export function colourSteps(spots) {
  if (spots.length < 2) return spots.map(() => 0);
  const far = spots.map((spot) => geoDistance(spots[0], spot));
  // Home stays first even if another place has the very same middle.
  const order = spots.map((_, i) => i).sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : far[a] - far[b] || a - b));
  const steps = [];
  order.forEach((place, rank) => { steps[place] = Math.round((rank / (spots.length - 1)) * 1000) / 1000; });
  return steps;
}

/** How the flat map lays the earth out: the whole world, just inside the map's own size. The globe opens out into this. */
export const flatProjection = () => geoNaturalEarth1().fitExtent([[2, 2], [WIDTH - 2, HEIGHT - 2]], { type: 'Sphere' });

/**
 * The globe on its way to the flat map. `openingOut(flatness)` gives a way of laying the earth out that is the globe
 * at 0, the flat map at 1, and between the two every point is that share of the way from where the globe puts it to
 * where the flat map does. (It hands back the same projection each time, set anew.)
 */
export const openingOut = geoProjectionMutator((/** @type {number} */ flatness) => {
  if (flatness === 0) return geoOrthographicRaw;
  if (flatness === 1) return geoNaturalEarth1Raw;
  return (/** @type {number} */ x, /** @type {number} */ y) => {
    const round = geoOrthographicRaw(x, y);
    const flat = geoNaturalEarth1Raw(x, y);
    return [round[0] + (flat[0] - round[0]) * flatness, round[1] + (flat[1] - round[1]) * flatness];
  };
});

// On the globe the far half of the earth lies behind the near half. Part-way open, the furthest part would still
// fold back over the nearer, so it stays out of sight until the picture has opened far enough to hold it. How soon
// that is depends on how closely the flat map packs its lines of longitude: closest at the poles, where they are
// this fraction as far apart as the globe's own are at its middle.
const NARROWEST = Math.min(...Array.from({ length: 91 }, (_, degrees) => geoNaturalEarth1Raw(1, (degrees * Math.PI) / 180)[0]));

/**
 * How far round from the middle of the picture the earth is in view, in radians, for how flat it is: a quarter turn
 * on the globe (the near half), more and more as it opens out, and a half turn (all of it) from some way before flat.
 * @param {number} flatness from 0 to 1
 */
export function inView(flatness) {
  const edge = (flatness * NARROWEST) / (1 - flatness);
  return edge >= 1 ? Math.PI : Math.acos(-edge);
}

/**
 * The flat map: the outline of the whole world, the grid of latitude and longitude, every border and coast as one
 * line, and each visited country the map draws as a shape of its own, with the box it fills ([left, top, right,
 * bottom]) and its middle, all in the map's units.
 * @param {{ said: string, name: string, drawn: boolean }[]} places from placesFor()
 */
export function flatMap(world, places) {
  const projection = flatProjection();
  // One decimal place is finer than a screen can show, and keeps the page small.
  const path = geoPath(projection).digits(1);
  const countries = feature(world, world.objects.countries).features;
  const tenth = (/** @type {number} */ n) => Math.round(n * 10) / 10;
  return {
    outline: path({ type: 'Sphere' }),
    grid: path(geoGraticule10()),
    lines: path(mesh(world, world.objects.countries)),
    shapes: places.filter((place) => place.drawn).map(({ said, name }) => {
      const country = countries.find((c) => c.properties.name === name);
      return { said, name, d: path(country), box: path.bounds(country).flat().map(tenth), middle: path.centroid(country).map(tenth) };
    }),
  };
}

/**
 * A small globe for the home page, `size` pixels across, turned to face the middle of the visited places: its
 * outline, the land, and the visited countries the map can draw, each with its step along the colours. Drawn once
 * while the site is built; rounded to whole pixels, which is all a globe this small needs.
 * @param {{ name: string, drawn: boolean }[]} places in the listed order, home first @param {number[]} steps each place's colour step
 */
export function smallGlobe(world, land, places, steps, size) {
  const drawn = places.map((place, i) => ({ ...place, step: steps[i] })).filter((place) => place.drawn);
  const countries = feature(world, world.objects.countries).features;
  const shapes = drawn.map((place) => ({ step: place.step, feature: countries.find((c) => c.properties.name === place.name) }));
  const mids = shapes.map((s) => geoCentroid(s.feature));
  const [lon, lat] = mids.length ? mids.reduce(([a, b], [x, y]) => [a + x / mids.length, b + y / mids.length], [0, 0]) : [0, 0];
  const projection = geoOrthographic().rotate([-lon, -lat]).scale(size / 2 - 1).translate([size / 2, size / 2]);
  const path = geoPath(projection).digits(0);
  return {
    sphere: path({ type: 'Sphere' }),
    land: path(feature(land, land.objects.land)),
    shapes: shapes.map((s) => ({ step: s.step, d: path(s.feature) })).filter((s) => s.d),
  };
}
