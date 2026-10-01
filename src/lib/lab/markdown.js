// Markdown Preview's rule: Markdown in, a formatted page (HTML) out. The reader is micromark with its GitHub add-on
// (tables, task lists, strikethrough, links typed bare), the same engine this site's posts are built with.
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';

/**
 * The page a piece of Markdown makes. Safe to show as it is: HTML typed into the Markdown comes out as text (so a
 * pasted script never runs), and links keep only ordinary addresses (http, https, mailto and the like).
 * @param {string} markdown
 */
export const toHtml = (markdown) => micromark(markdown, { extensions: [gfm()], htmlExtensions: [gfmHtml()] });
