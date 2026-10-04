// The Lab's Most Popular: which Lab pages are visited most, from GoatCounter's public page counts. The site reads the
// counts while it is built (on every publish, and once a day), so the ranking is part of the page: nothing loads
// later, nothing jumps, and an ad-blocker can't hide it.

/** GoatCounter's formatted count ("1,234" or "1 234") as a number. @param {string} text */
export const parseCount = (text) => Number(String(text).replace(/\D/g, '')) || 0;

/** A page's address as GoatCounter keeps it: it trims the slashes off both ends ("/lab/count-words/" becomes "/lab/count-words"). @param {string} path */
export const countedPath = (path) => `/${path.replace(/^\/+|\/+$/g, '')}`;

/**
 * Each page's visits, read from GoatCounter's public counter at `base` (the site's GoatCounter address). A page nobody
 * has visited answers 404, which counts as 0. Anything else going wrong (the public counter switched off, no network,
 * a slow answer) gives null: no ranking rather than a wrong one, and never a failed build.
 * @param {string[]} paths @param {string} base @returns {Promise<Map<string, number> | null>}
 */
export async function pageVisits(paths, base, fetcher = fetch) {
  try {
    const entries = await Promise.all(paths.map(async (path) => {
      const answer = await fetcher(`${base}/counter/${encodeURIComponent(countedPath(path))}.json`, { signal: AbortSignal.timeout(8000) });
      if (answer.status === 404) return /** @type {[string, number]} */ ([path, 0]);
      if (!answer.ok) throw new Error(`GoatCounter answered ${answer.status}`);
      return /** @type {[string, number]} */ ([path, parseCount((await answer.json()).count)]);
    }));
    return new Map(entries);
  } catch {
    return null;
  }
}

/**
 * The `count` most visited of `items`, most visited first; equal visits keep the Lab's own order. Empty unless that
 * many items have been visited at all: ranking unvisited pages would only repeat the Lab's order.
 * @template {{ path: string }} T
 * @param {T[]} items in the Lab's order @param {Map<string, number> | null} visits by path @returns {T[]}
 */
export function mostPopular(items, visits, count = 4) {
  if (!visits) return [];
  const visited = items.filter((item) => (visits.get(item.path) ?? 0) > 0);
  if (visited.length < count) return [];
  return visited
    .map((item, order) => ({ item, order, n: visits.get(item.path) ?? 0 }))
    .sort((a, b) => b.n - a.n || a.order - b.order)
    .slice(0, count)
    .map((x) => x.item);
}

/**
 * The most visited of `items` (all one kind), or the first when none has been visited or there are no counts.
 * @template {{ path: string }} T @param {T[]} items in the Lab's order @param {Map<string, number> | null} visits
 * @returns {T | undefined}
 */
export function bestOf(items, visits) {
  let best = items[0];
  let most = 0;
  for (const item of items) {
    const n = visits?.get(item.path) ?? 0;
    if (n > most) {
      best = item;
      most = n;
    }
  }
  return best;
}
