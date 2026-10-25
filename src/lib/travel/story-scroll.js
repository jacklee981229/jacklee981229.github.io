// How a travel story steps (src/components/TravelStory.astro): the story is a run of full-screen stops, one per photo,
// with the opening and closing words as stops of their own. Each scroll moves one stop; arriving at a stop plays its
// change of photo and words.

/**
 * The story's stops, in order: the opening words (over a photo dimmed to fill the screen), one per photo, words on
 * their own after a group that has them (over its last photo's blur), and the closing words (the same way as the
 * opening). Each says which photo it shows and which words.
 * @param {{ first: number, count: number, after?: boolean }[]} groups the moments in groups (story.js groupsOf), and
 *   whether words on their own follow each
 * @param {{ intro?: number | null, outro?: number | null }} ends the photo behind the opening and the closing words,
 *   or null for a story without them
 * @returns {{ photo: number, say: number | string, place: number }[]} `say` is the group whose words show, or
 *   'intro', 'outro' or `after-<group>`; `place` is the photo's place in its group, from 0
 */
export function stopsOf(groups, { intro = null, outro = null } = {}) {
  const stops = [];
  if (intro !== null && groups.length) stops.push({ photo: intro, say: 'intro', place: 0 });
  groups.forEach(({ first, count, after }, g) => {
    for (let j = 0; j < count; j++) stops.push({ photo: first + j, say: g, place: j });
    if (after) stops.push({ photo: first + count - 1, say: `after-${g}`, place: 0 });
  });
  if (outro !== null && groups.length) stops.push({ photo: outro, say: 'outro', place: 0 });
  return stops;
}

/**
 * Which moment's photo goes behind the opening or closing words: the one Jack picked, else the fallback.
 * @param {{ id: string }[]} moments @param {string | undefined} id @param {number} fallback
 */
export function photoFor(moments, id, fallback) {
  const k = id ? moments.findIndex((m) => m.id === id) : -1;
  return k >= 0 ? k : fallback;
}

/**
 * The stop on show: the nearest one.
 * @param {number} depth how far into the story the screen is, in stops: 0 when the first fills the screen, below 0 while
 *   the story is still coming up @param {number} count
 */
export function stopAt(depth, count) {
  return Math.max(0, Math.min(count - 1, Math.round(depth)));
}

/**
 * Where one scroll (a wheel turn, a swipe, an arrow key) takes the reader: the next stop that way, so a small scroll
 * goes straight to the next photo; the first stop when the story is coming up from either side; or null to let the
 * page scroll on as usual (past either end, or with the story less than half on screen).
 * @param {number} depth as for stopAt @param {number} count @param {1 | -1} way 1 down, -1 up
 * @returns {number | null}
 */
export function stepTo(depth, count, way) {
  if (!count || depth < -0.5 || depth > count - 0.5) return null;
  const k = stopAt(depth, count);
  // Half way between two stops (after dragging the scrollbar, say), the first scroll settles on the one that way.
  const between = Math.abs(depth - k) > 0.02;
  if (way > 0) {
    if (depth < -0.02) return 0;
    if (between && depth < k) return k;
    return k < count - 1 ? k + 1 : null;
  }
  if (depth > count - 1 + 0.02) return count - 1;
  if (between && depth > k) return k;
  return k > 0 ? k - 1 : null;
}
