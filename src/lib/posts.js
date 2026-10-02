// Which posts show where, and in what order. Pure functions over { id, data } entries, so tests can cover them.

/**
 * @typedef {{ id: string, data: { title: string, date: Date, updated?: Date, topic: string, tags: string[], draft?: boolean, hidden?: boolean, pinned?: boolean } }} PostLike
 */

// Folder names a post can't use: the site's own pages and files already live at these addresses.
export const RESERVED_SLUGS = ['about', 'archives', 'tags', 'writing', 'page', 'games', 'fonts', 'pagefind', '_astro', '404', 'lab', 'random', 'collections', 'travel'];

/** Newest first; same-moment posts fall back to id order so the result never depends on file order. */
export const byNewest = (/** @type {PostLike} */ a, /** @type {PostLike} */ b) => b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id);

/**
 * Every post that has its own page: hidden posts included, drafts only when asked (local preview).
 * @template {PostLike} T @param {T[]} posts @param {{ includeDrafts?: boolean }} [options] @returns {T[]}
 */
export function published(posts, { includeDrafts = false } = {}) {
  return posts.filter((p) => includeDrafts || !p.data.draft).sort(byNewest);
}

/**
 * The posts that appear in lists, feeds, search and the sitemap: published and not hidden.
 * @template {PostLike} T @param {T[]} posts @param {{ includeDrafts?: boolean }} [options] @returns {T[]}
 */
export function listed(posts, options) {
  return published(posts, options).filter((p) => !p.data.hidden);
}

/** @template {PostLike} T @param {T[]} listedPosts @returns {T[]} */
export const pinned = (listedPosts) => listedPosts.filter((p) => p.data.pinned);

/**
 * @template T @param {T[]} items @param {number} perPage
 * @returns {{ page: number, pages: number, items: T[], start: number }[]}
 */
export function paginate(items, perPage) {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  return Array.from({ length: pages }, (_, i) => ({ page: i + 1, pages, start: i * perPage, items: items.slice(i * perPage, (i + 1) * perPage) }));
}

/** Home is page 1; the rest keep the old Hexo addresses (/page/2/). @param {number} page */
export const homePageUrl = (page) => (page === 1 ? '/' : `/page/${page}/`);

/**
 * @template {PostLike} T @param {T[]} listedPosts @param {T} post
 * @returns {{ newer: T | null, older: T | null }}
 */
export function neighbours(listedPosts, post) {
  const i = listedPosts.findIndex((p) => p.id === post.id);
  if (i < 0) return { newer: null, older: null };
  return { newer: listedPosts[i - 1] ?? null, older: listedPosts[i + 1] ?? null };
}

/** Same topic, newest first. @template {PostLike} T @param {T[]} listedPosts @param {T} post */
export const related = (listedPosts, post, count = 3) => listedPosts.filter((p) => p.id !== post.id && p.data.topic === post.data.topic).slice(0, count);

/** @template {PostLike} T @param {T[]} listedPosts @param {T} post */
export const recent = (listedPosts, post, count = 5) => listedPosts.filter((p) => p.id !== post.id).slice(0, count);

/**
 * "Check these too!" under a post: the same topic first, then the newest, each once, never the post itself.
 * @template {PostLike} T @param {T[]} listedPosts @param {T} post
 */
export const checkThese = (listedPosts, post, count = 4) => [...new Set([...related(listedPosts, post, count), ...recent(listedPosts, post, count)])].slice(0, count);

/** @param {PostLike[]} listedPosts @returns {{ tag: string, count: number }[]} alphabetical */
export function tagCounts(listedPosts) {
  const counts = new Map();
  for (const p of listedPosts) for (const tag of p.data.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * @template {{ id: string }} Topic @param {PostLike[]} listedPosts @param {Topic[]} topics
 * @returns {(Topic & { count: number })[]}
 */
export const topicCounts = (listedPosts, topics) => topics.map((t) => ({ ...t, count: listedPosts.filter((p) => p.data.topic === t.id).length }));

/** The most recent publish or update date, or undefined when there are no posts. @param {PostLike[]} listedPosts */
export function lastUpdated(listedPosts) {
  const times = listedPosts.map((p) => Math.max(p.data.date.getTime(), p.data.updated?.getTime() ?? 0));
  return times.length ? new Date(Math.max(...times)) : undefined;
}
