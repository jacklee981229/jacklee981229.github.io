// The check at the end of every build: the pages built and the addresses in sitemap.xml must be the same list, so a
// new page can't be forgotten in publicPages() (src/lib/collections.ts) and a removed one can't linger there.

/** A built file's address: "lab/index.html" is "/lab/", "index.html" is "/". */
export const addressOf = (file) => `/${file.replace(/\\/g, '/').replace(/(^|\/)index\.html$/, '$1')}`;

/** Pages that are meant to stay out of the sitemap: redirects (they only forward) and pages marked noindex. */
export function staysOut(html) {
  return /<meta[^>]+http-equiv=["']refresh["']/i.test(html) || /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
}

/** The addresses listed in a sitemap, without the site's own part. */
export function sitemapAddresses(xml, site) {
  const base = site.replace(/\/$/, '');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&')).map((url) => (url.startsWith(base) ? url.slice(base.length) || '/' : url));
}

/**
 * Compares the built pages (each its file inside the build, and its HTML) with the sitemap. Only "index.html" files
 * are pages: 404.html and the like are left alone.
 * @param {{ file: string, html: string }[]} pages @param {string} xml @param {string} site
 * @returns {{ unlisted: string[], missing: string[] }} built but not listed; listed but not built (or a redirect or noindex)
 */
export function compareSitemap(pages, xml, site) {
  const built = pages.filter((p) => /(^|[/\\])index\.html$/.test(p.file) && !staysOut(p.html)).map((p) => addressOf(p.file));
  const listed = sitemapAddresses(xml, site);
  return {
    unlisted: built.filter((a) => !listed.includes(a)).sort(),
    missing: listed.filter((a) => !built.includes(a)).sort(),
  };
}

/** The message that stops the build, or nothing when the two lists agree. */
export function sitemapProblem({ unlisted, missing }) {
  const lines = [];
  if (unlisted.length) lines.push(`Built but not in the sitemap (add them to publicPages() in src/lib/collections.ts, or mark the page noindex): ${unlisted.join(', ')}`);
  if (missing.length) lines.push(`In the sitemap but not built, or a redirect or noindex (take them out of publicPages() in src/lib/collections.ts): ${missing.join(', ')}`);
  return lines.length ? `Sitemap check failed.\n${lines.join('\n')}` : '';
}
