// The sitemap at the old site's address, so Google Search Console keeps reading it.
import type { APIRoute } from 'astro';
import { publicPages } from '../lib/collections';
import { isoDay } from '../lib/dates.js';
import { escapeXml } from '../lib/text.js';

export const GET: APIRoute = async ({ site }) => {
  const base = String(site).replace(/\/$/, '');
  const urls = (await publicPages()).map(({ path, lastmod }) => `  <url><loc>${escapeXml(base + path)}</loc>${lastmod ? `<lastmod>${isoDay(lastmod)}</lastmod>` : ''}</url>`);
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, '</urlset>', ''].join('\n');
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
