// Share images (the picture a link preview shows): which ones a build makes, and the check that every page's points
// to a file that's there. A page with a cover shares its cover; every other page gets a picture made for it at the
// end of the build (share-image.js), from what the page itself says: its title, its description and its section.

/** The file a page's own share picture is made into: "/" is "index", "/lab/count-words/" is "lab/count-words". */
export const shareKey = (pathname) => pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '') || 'index';

/** The address of that picture, under /og/. @param {string} pathname */
export const sharePath = (pathname) => `/og/${shareKey(pathname)}.png`;

/**
 * The small label at the top of a page's share picture, from where the page lives.
 * @param {string} pathname @param {string} [topic] a post's topic name
 */
export function shareLabel(pathname, topic) {
  const p = pathname.replace(/\/?$/, '/');
  if (p === '/') return 'Home';
  if (p === '/lab/') return 'Lab';
  if (p.startsWith('/lab/effect/')) return 'Lab · Effect';
  if (p.startsWith('/lab/game/')) return 'Lab · Game';
  if (p === '/random/') return 'Lab · Random';
  if (p.startsWith('/lab/')) return 'Lab · Tool';
  if (p === '/writing/') return 'Writing';
  if (p.startsWith('/tags/')) return 'Writing · Tag';
  const pages = { '/collections/': 'Collection', '/travel/': 'Travel', '/about/': 'About', '/now/': 'Now', '/changelog/': 'Changelog', '/404/': 'Not found' };
  if (pages[p]) return pages[p];
  return topic ? `Writing · ${topic}` : 'Writing';
}

/** The text of an HTML attribute, its character references undone. @param {string} text */
export const unescapeHtml = (text) =>
  text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/** A meta tag's content, by its property or name, or nothing. @param {string} html @param {string} key */
export function metaOf(html, key) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    // Each value runs to the quote it opened with, so "Jack's" stays whole.
    const attr = (name) => tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find((v) => v !== undefined);
    const named = attr('property') ?? attr('name');
    if (named === key) return unescapeHtml(attr('content') ?? '');
  }
  return undefined;
}

/**
 * Which built pages ask for a picture to be made (their og:image is one of ours under /og/), with what to put on it.
 * @param {{ file: string, html: string }[]} pages @param {string} site
 */
export function picturesToMake(pages, site) {
  const base = site.replace(/\/$/, '');
  return pages.flatMap(({ html }) => {
    const image = metaOf(html, 'og:image') ?? '';
    if (!image.startsWith(`${base}/og/`)) return [];
    return [{ path: image.slice(base.length), title: metaOf(html, 'og:title') ?? '', description: metaOf(html, 'og:description') ?? '', label: metaOf(html, 'share:label') ?? '', accent: metaOf(html, 'share:accent') }];
  });
}

/**
 * The pages whose og:image isn't a file in the build: the build stops on any.
 * @param {{ file: string, html: string }[]} pages @param {string} site @param {(path: string) => boolean} exists
 */
export function missingPictures(pages, site, exists) {
  const base = site.replace(/\/$/, '');
  return pages.flatMap(({ file, html }) => {
    if (/<meta[^>]+http-equiv=["']refresh["']/i.test(html)) return [];
    const image = metaOf(html, 'og:image');
    if (!image) return [`${file} (no og:image)`];
    if (!image.startsWith(`${base}/`)) return [`${file} (${image} is not on this site)`];
    return exists(decodeURIComponent(image.slice(base.length))) ? [] : [`${file} (${image})`];
  });
}
