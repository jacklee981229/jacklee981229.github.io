// The feed, at the old site's address and in the same Atom format, so existing subscribers keep receiving posts.
import type { APIRoute } from 'astro';
import { listedPosts, postUrl, summaryOf } from '../lib/collections';
import { lastUpdated } from '../lib/posts.js';
import { escapeXml } from '../lib/text.js';
import { SITE } from '../site';

const FEED_SIZE = 20;

export const GET: APIRoute = async ({ site }) => {
  const posts = await listedPosts();
  const base = String(site).replace(/\/$/, '');
  const url = (path: string) => `${base}${path}`;
  const entries = posts.slice(0, FEED_SIZE).map((post) => {
    // Feed readers need full addresses; images are left out because the stored HTML only has placeholders for them.
    const html = (post.rendered?.html ?? '')
      .replace(/<img\b[^>]*>/g, '')
      .replace(/<figcaption class="code-bar">[\s\S]*?<\/figcaption>/g, '')
      .replace(/\b(src|href)="\/(?!\/)/g, `$1="${base}/`);
    return [
      '  <entry>',
      `    <title>${escapeXml(post.data.title)}</title>`,
      `    <link href="${url(postUrl(post))}"/>`,
      `    <id>${url(postUrl(post))}</id>`,
      `    <published>${post.data.date.toISOString()}</published>`,
      `    <updated>${(post.data.updated ?? post.data.date).toISOString()}</updated>`,
      `    <summary>${escapeXml(summaryOf(post))}</summary>`,
      `    <content type="html">${escapeXml(html)}</content>`,
      ...post.data.tags.map((tag) => `    <category term="${escapeXml(tag)}"/>`),
      '  </entry>',
    ].join('\n');
  });
  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${escapeXml(SITE.title)}</title>`,
    `  <subtitle>${escapeXml(SITE.tagline)}</subtitle>`,
    `  <link href="${url('/atom.xml')}" rel="self"/>`,
    `  <link href="${url('/')}"/>`,
    `  <id>${url('/')}</id>`,
    `  <updated>${(lastUpdated(posts) ?? new Date(`${SITE.started}T00:00:00+08:00`)).toISOString()}</updated>`,
    `  <author><name>${escapeXml(SITE.author)}</name></author>`,
    ...entries,
    '</feed>',
    '',
  ].join('\n');
  return new Response(xml, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
};
