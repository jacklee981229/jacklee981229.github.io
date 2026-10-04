// Visitor numbers from GoatCounter's public counter (its "Allow adding visitor counts on your website" setting must
// stay on), for Site info and each post's views. One place, so the numbers are easy to move when pages change.
// GoatCounter answers {"count": "1,234", "count_unique": "1,234"}: the two have always been the same number here (it
// counts visits), so one number is shown. Counting started on 1 Oct 2026, when GoatCounter was added.

/** The counter's address for a page's path, or "TOTAL" for the whole site. @param {string} base @param {string} path */
export const counterUrl = (base, path) => `${base.replace(/\/$/, '')}/counter/${encodeURIComponent(path)}.json`;

/**
 * The number GoatCounter gives, as it gives it ("1,234"), or nothing when it can't be had (a page never visited,
 * the setting off, no network).
 * @param {string} base the GoatCounter site's address @param {string} path a page's path, or "TOTAL"
 * @returns {Promise<string | null>}
 */
export async function visits(base, path) {
  try {
    const answer = await fetch(counterUrl(base, path));
    if (!answer.ok) return null;
    const { count } = await answer.json();
    return typeof count === 'string' || typeof count === 'number' ? String(count) : null;
  } catch {
    return null;
  }
}

/**
 * Fills every `[data-visits="<path or TOTAL>"]` on the page, live site only. It shows once its number has come
 * (into its `[data-visits-number]`), and is hidden for good if none comes. Away from the live site, one marked
 * `data-local` says "live site only" instead; the others stay hidden.
 * @param {string} base the GoatCounter site's address @param {string} liveHost the live site's host name
 */
export function showVisits(base, liveHost) {
  const live = location.hostname === liveHost;
  for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-visits]:not([data-visits-done])'))) {
    el.dataset.visitsDone = '';
    const number = el.querySelector('[data-visits-number]');
    if (!live) {
      if ('local' in el.dataset && number) {
        number.textContent = 'live site only';
        number.classList.add('local');
        el.hidden = false;
      } else el.hidden = true;
      continue;
    }
    visits(base, /** @type {string} */ (el.dataset.visits)).then((count) => {
      if (count && number) {
        number.textContent = count;
        el.hidden = false;
      } else el.hidden = true;
    });
  }
}
