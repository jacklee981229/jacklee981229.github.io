// The plain-text sitemap the old site also had: one address per line.
import type { APIRoute } from 'astro';
import { publicPages } from '../lib/collections';

export const GET: APIRoute = async ({ site }) => {
  const base = String(site).replace(/\/$/, '');
  const text = (await publicPages()).map(({ path }) => base + path).join('\n');
  return new Response(`${text}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
