// Small text helpers: post summaries, URL slugs and XML escaping.

/**
 * A plain-text summary of a post's Markdown for cards, search and the feed: code, images, markup and headings removed,
 * cut at a word boundary.
 * @param {string} markdown @param {number} [max]
 */
export function excerpt(markdown, max = 160) {
  const text = markdown
    .replace(/^(```|~~~)[\s\S]*?^\1/gm, ' ')
    .replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s.*$/gm, ' ')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–-]+$/, '')}…`;
}

/**
 * "Flutter Get Started!" -> "flutter-get-started". Throws when nothing usable is left, so a bad title fails loudly.
 * @param {string} text
 */
export function slugify(text) {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) throw new Error(`Can't make a web address from "${text}". Use a title with some English letters or numbers.`);
  return slug;
}

/** @param {string} text */
export function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
