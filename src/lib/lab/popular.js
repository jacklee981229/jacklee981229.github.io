// Pages' visits from GoatCounter's public page counts, read while the site is built (the Build Log and Writing
// Islands), so the numbers are part of the page: nothing loads later, nothing jumps, and an ad-blocker can't hide it.

/** GoatCounter's formatted count ("1,234" or "1 234") as a number. @param {string} text */
export const parseCount = (text) => Number(String(text).replace(/\D/g, '')) || 0;

/** A page's address as GoatCounter keeps it: it trims the slashes off both ends ("/lab/count-words/" becomes "/lab/count-words"). @param {string} path */
export const countedPath = (path) => `/${path.replace(/^\/+|\/+$/g, '')}`;

/**
 * Each page's visits, read from GoatCounter's public counter at `base` (the site's GoatCounter address). A page nobody
 * has visited answers 404, which counts as 0. Anything else going wrong (the public counter switched off, no network,
 * a slow answer) gives null: no numbers rather than wrong ones, and never a failed build.
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
