// The browser tab icon: the site's logo (src/lib/logo.js), made in the build so it stays the menu bar's drawing.
import type { APIRoute } from 'astro';
import { logoSvg } from '../lib/logo.js';

export const GET: APIRoute = () => new Response(logoSvg('icon'), { headers: { 'Content-Type': 'image/svg+xml' } });
