// Which places on the map a list of visited places means. The map knows countries by the English names its data
// gives them (Natural Earth's), some of them shortened ("Dominican Rep."). Names are matched ignoring capital
// letters and accents, and a few everyday names are understood too. Tested by tests/travel.test.js.

/** Everyday names, in small letters without accents, and the map's own name for each. */
export const ALSO = {
  usa: 'United States of America',
  us: 'United States of America',
  'united states': 'United States of America',
  america: 'United States of America',
  uk: 'United Kingdom',
  britain: 'United Kingdom',
  'great britain': 'United Kingdom',
  england: 'United Kingdom',
  korea: 'South Korea',
  'czech republic': 'Czechia',
  macau: 'Macao',
  burma: 'Myanmar',
  holland: 'Netherlands',
  uae: 'United Arab Emirates',
  'north macedonia': 'Macedonia',
  turkiye: 'Turkey',
  swaziland: 'eSwatini',
  'ivory coast': "Côte d'Ivoire",
  'cape verde': 'Cabo Verde',
  'east timor': 'Timor-Leste',
  'vatican city': 'Vatican',
  bosnia: 'Bosnia and Herz.',
  'bosnia and herzegovina': 'Bosnia and Herz.',
  'dominican republic': 'Dominican Rep.',
  'dr congo': 'Dem. Rep. Congo',
  'democratic republic of the congo': 'Dem. Rep. Congo',
  'central african republic': 'Central African Rep.',
  'equatorial guinea': 'Eq. Guinea',
  'south sudan': 'S. Sudan',
  'western sahara': 'W. Sahara',
  'northern cyprus': 'N. Cyprus',
  'solomon islands': 'Solomon Is.',
  'french polynesia': 'Fr. Polynesia',
  'faroe islands': 'Faeroe Is.',
  'falkland islands': 'Falkland Is.',
  'cayman islands': 'Cayman Is.',
  'cook islands': 'Cook Is.',
  'marshall islands': 'Marshall Is.',
};

/** A name without its capital letters, accents and outer spaces, for comparing. @param {string} name */
const plain = (name) => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** How many single-letter changes turn one word into the other, for "did you mean". */
function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

/**
 * The visited list as places the map knows, in the order listed. Each has `said` (the name as listed, for showing),
 * `name` (the map's own) and `drawn`: whether the map draws it. `drawn` are the names of the countries the map has
 * shapes for; `known` adds the places too small for it (Singapore, Hong Kong), which are only named under the map.
 * A name the map doesn't know, or one listed twice, is a plain error that says how to fix it.
 * @param {string[]} visited @param {string[]} drawn @param {string[]} known
 * @returns {{ said: string, name: string, drawn: boolean }[]}
 */
export function placesFor(visited, drawn, known) {
  const byPlain = new Map(known.map((name) => [plain(name), name]));
  const places = [];
  for (const said of visited) {
    const key = plain(said);
    const name = byPlain.get(key) ?? (ALSO[key] && byPlain.get(plain(ALSO[key])));
    if (!name) {
      const near = known.filter((k) => distance(plain(k), key) <= 2 || plain(k).startsWith(key)).slice(0, 3);
      throw new Error(`Travel Map: "${said}" isn't a place the map knows.${near.length ? ` Did you mean ${near.join(' or ')}?` : ''} Fix it in src/content/travel/visited.yaml.`);
    }
    const twice = places.find((place) => place.name === name);
    if (twice) throw new Error(`Travel Map: ${name} is listed twice ("${twice.said}" and "${said}"). Take one out of src/content/travel/visited.yaml.`);
    places.push({ said, name, drawn: drawn.includes(name) });
  }
  return places;
}
