// The menu's Dashboard link (Header.astro), only in a browser logged in to the Now editor: its icon takes the colour of
// the dashboard's most urgent state, red for something to do now, amber for soon, the site's teal when all is well.
// Base.astro's head shows the link and the last state before the page paints; this reads the latest from the Worker.
import { draftCall, draftPass } from './drafts-api';
import { attention, worst, type Todo } from './dashboard.js';
import { LEVEL_KEY } from './now-command.js';

/** How long a read state stands before a page asks the Worker again (two calls), so moving between pages costs none. */
const FRESH = 5 * 60_000;

/** The link's colour for a state, kept for the next pages. */
export function showLevel(level: string) {
  document.documentElement.dataset.dash = level;
  try { localStorage.setItem(LEVEL_KEY, JSON.stringify({ level, at: Date.now() })); } catch { /* blocked: asks again next page */ }
}

/** The dashboard's state from the Worker, unless the kept one is still fresh. Without a snapshot or a working login,
 *  the link stays but has no colour. */
export async function refreshLevel() {
  if (!draftPass()) return;
  try {
    const kept = JSON.parse(localStorage.getItem(LEVEL_KEY) ?? 'null');
    if (kept && Date.now() - kept.at < FRESH) return;
  } catch { /* unreadable: ask */ }
  const [dash, list] = await Promise.allSettled([draftCall<{ snapshot: any }>('/api/dashboard'), draftCall<{ items: Todo[] }>('/api/todos')]);
  if (dash.status === 'rejected' || !dash.value.snapshot) {
    delete document.documentElement.dataset.dash;
    try { localStorage.removeItem(LEVEL_KEY); } catch { /* nothing kept */ }
    return;
  }
  showLevel(worst(attention(dash.value.snapshot, list.status === 'fulfilled' ? list.value.items : null, Date.now())));
}
