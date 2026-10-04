// Lets every crawler in, and tells it where the sitemap is. The address comes from `site` in astro.config.mjs.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site)}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
